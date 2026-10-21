import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import webpush from "web-push";
import {clients,checked,identity} from "../../scripts/local-supabase.mjs";
test("J6 : notifications, rappels, RLS, baux et reprise",async t=>{
  const {admin,anonymous}=clients();const actors=[];const sessions=[];const outbox=[];
  const group=checked(await admin.from("groups").select("id").single());
  for(const label of ["auteur","destinataire","admin","externe"])actors.push(await identity(admin,anonymous,`notifications-${label}`));
  const [owner,player,manager,outsider]=actors;
  checked(await admin.from("profiles").insert(actors.slice(0,3).map(p=>({user_id:p.user.id,display_name:"Recette notifications"}))));
  const members=checked(await admin.from("memberships").insert(actors.slice(0,3).map(p=>({group_id:group.id,user_id:p.user.id,role:p===manager?"admin":"member"}))).select("*"));
  const member=p=>members.find(m=>m.user_id===p.user.id);
  const sql=q=>execFileSync("docker",["exec","supabase_db_OnJoueQuand","psql","-U","postgres","-d","postgres","-Atc",q],{encoding:"utf8"}).trim();
  const notify=(c,command,payload,expected_revision=null)=>c.rpc("notification_command",{command,payload,expected_revision});
  const endpoint=`https://fcm.googleapis.com/fcm/send/${randomUUID()}`;
  const keys={p256dh:webpush.generateVAPIDKeys().publicKey,auth:Buffer.alloc(16,1).toString("base64url")};
  const create=async()=>{const start=Math.ceil((Date.now()+7*86400000)/900000)*900000;const id=checked(await owner.client.rpc("create_session",{session_title:"Recette notification",session_description:"",selected_game:null,player_threshold:2,candidate_slots:[0,1].map(n=>({starts_at:new Date(start+n*86400000).toISOString(),ends_at:new Date(start+n*86400000+3600000).toISOString()})),deadline:null,request_id:randomUUID()}));sessions.push(id);checked(await owner.client.rpc("session_command",{target_id:id,command:"publish",expected_revision:1,payload:{}}));return id;};
  const materialize=async(reference_time)=>checked(await admin.rpc("materialize_notifications",{batch_size:100,...(reference_time?{reference_time}:{})}));
  const notes=async(c,id)=>checked(await c.from("notifications").select("*").eq("resource_id",id));
  let main,sub;
  try{
    await t.test("préférences révisées, appareils propres au JWT et endpoints protégés",async()=>{
      checked(await notify(player.client,"preferences",{reminders_enabled:true,push_enabled:false}));
      assert.ok((await notify(player.client,"preferences",{reminders_enabled:false,push_enabled:false})).error);
      checked(await notify(player.client,"preferences",{reminders_enabled:true,push_enabled:false},1));
      for(const url of ["https://127.0.0.1/secret","https://fcm.googleapis.com.evil.test/fcm/send/xxx","https://fcm.googleapis.com:443/fcm/send/xxx"])
        assert.ok((await notify(player.client,"subscribe",{endpoint:url,...keys})).error);
      sub=checked(await notify(player.client,"subscribe",{endpoint,...keys}));
      assert.equal(checked(await player.client.from("notification_preferences").select("push_enabled").single()).push_enabled,true);
      assert.deepEqual(checked(await owner.client.from("push_subscriptions").select("*").eq("id",sub)),[]);
      assert.ok((await notify(owner.client,"subscribe",{endpoint,...keys})).error);
      assert.ok((await owner.client.from("push_subscriptions").delete().eq("id",sub)).error);
    });
    await t.test("outbox matérialisée une seule fois et lecture privée",async()=>{
      main=await create();await Promise.all([materialize(),materialize()]);
      assert.equal((await notes(owner.client,main)).length,0);assert.equal((await notes(player.client,main)).length,1);
      const note=(await notes(player.client,main))[0];assert.equal(note.type,"session.published");
      assert.deepEqual(checked(await owner.client.from("notifications").select("*").eq("id",note.id)),[]);
      for(const c of [anonymous(),outsider.client]){
        for(const table of ["notifications","notification_preferences","push_subscriptions"]){const r=await c.from(table).select("*");assert.ok(r.error||!r.data.length);}
        assert.ok((await c.rpc("materialize_notifications")).error);assert.ok((await c.rpc("claim_notification_deliveries")).error);assert.ok((await c.rpc("begin_notification_job")).error);
      }
      assert.ok((await notify(owner.client,"read",{id:note.id},note.revision)).error);
      assert.ok((await player.client.from("notifications").update({read_at:new Date().toISOString()}).eq("id",note.id)).error);
    });
    await t.test("baux exclusifs, interruption après envoi, ancien acquittement refusé",async()=>{
      const batches=await Promise.all([admin.rpc("claim_notification_deliveries",{batch_size:20}),admin.rpc("claim_notification_deliveries",{batch_size:20})]);
      const claims=batches.flatMap(checked);assert.equal(new Set(claims.map(d=>d.id)).size,claims.length);
      const own=claims.find(d=>sql(`select exists(select 1 from private.notification_deliveries where id='${d.id}' and subscription_id='${sub}')`)==="t");assert.ok(own);
      const payload=checked(await admin.rpc("prepare_notification_delivery",{delivery_id:own.id,token:own.lease_token}));assert.equal(payload.endpoint,endpoint);assert.equal(payload.attempts,1);
      // Le réseau a pu réussir, puis le processus s'interrompre avant l'acquittement.
      sql(`update private.notification_deliveries set lease_until=clock_timestamp()-interval '1 second' where id='${own.id}'`);
      const resumed=checked(await admin.rpc("claim_notification_deliveries",{batch_size:20})).find(d=>d.id===own.id);assert.ok(resumed);assert.notEqual(resumed.lease_token,own.lease_token);
      assert.equal(checked(await admin.rpc("finish_notification_delivery",{delivery_id:own.id,token:own.lease_token,outcome:"sent"})),false);
      checked(await admin.rpc("prepare_notification_delivery",{delivery_id:resumed.id,token:resumed.lease_token}));
      checked(await admin.rpc("finish_notification_delivery",{delivery_id:resumed.id,token:resumed.lease_token,outcome:"retry",error_code:"429",retry_seconds:300}));
      assert.equal(sql(`select status||':'||last_error_code from private.notification_deliveries where id='${own.id}'`),"pending:429");
      sql(`update private.notification_deliveries set next_attempt_at=clock_timestamp() where id='${own.id}'`);
      const gone=checked(await admin.rpc("claim_notification_deliveries",{batch_size:20})).find(d=>d.id===own.id);checked(await admin.rpc("prepare_notification_delivery",{delivery_id:gone.id,token:gone.lease_token}));
      checked(await admin.rpc("finish_notification_delivery",{delivery_id:gone.id,token:gone.lease_token,outcome:"gone",error_code:"410"}));
      assert.equal(checked(await player.client.from("push_subscriptions").select("*").eq("id",sub)).length,0);
    });
    await t.test("lecture explicite, informations obsolètes et désactivation avant envoi",async()=>{
      const note=(await notes(player.client,main))[0];checked(await notify(player.client,"read",{id:note.id},note.revision));assert.ok((await notify(player.client,"read",{id:note.id},note.revision)).error);
      sub=checked(await notify(player.client,"subscribe",{endpoint,...keys}));
      const id=await create();await materialize();
      const pref=checked(await player.client.from("notification_preferences").select("revision").single());checked(await notify(player.client,"preferences",{reminders_enabled:true,push_enabled:false},pref.revision));
      const claims=checked(await admin.rpc("claim_notification_deliveries",{batch_size:20}));
      for(const c of claims)assert.equal(checked(await admin.rpc("prepare_notification_delivery",{delivery_id:c.id,token:c.lease_token})),null);
      checked(await owner.client.rpc("session_command",{target_id:id,command:"cancel",expected_revision:2,payload:{}}));await materialize();
      assert.equal((await notes(player.client,id)).filter(n=>n.type==="session.cancelled").length,1);
      const stale=await create();checked(await owner.client.rpc("session_command",{target_id:stale,command:"cancel",expected_revision:2,payload:{}}));await materialize();
      assert.deepEqual((await notes(player.client,stale)).map(n=>n.type),["session.cancelled"]);
    });
    await t.test("rappels du dimanche et lundi : même semaine, complétude et rattrapage borné",async()=>{
      const sunday="2026-10-25T17:00:00Z",monday="2026-10-26T17:00:00Z";
      const enqueue=async reference_time=>checked(await admin.rpc("enqueue_availability_reminders",{reference_time}));
      await enqueue("2026-10-25T16:59:59Z");assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${member(player).id}' and type='availability.reminder'`),"0");
      await Promise.all([enqueue(sunday),enqueue(sunday)]);
      outbox.push(member(player).id,member(owner).id,member(manager).id);
      assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${member(player).id}' and event_key like '%:sunday'`),"1");
      await materialize(sunday);const n=(await notes(player.client,member(player).id))[0];assert.equal(n.payload.week,"2026-10-26");
      // Une semaine complète ne reçoit plus la relance du lundi.
      checked(await admin.from("availability_days").insert(Array.from({length:7},(_,i)=>({group_id:group.id,membership_id:member(player).id,local_date:i===6?"2026-11-01":`2026-10-${26+i}`,status:"unavailable",mode:null}))));
      await enqueue(monday);await materialize(monday);
      assert.equal((await notes(player.client,member(player).id)).length,1);
      assert.equal(await enqueue("2026-10-27T17:00:00Z"),0);
      // Une panne qui saute le dimanche ne produit que l'étape du lundi.
      await enqueue("2026-11-02T17:00:00Z");assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${member(player).id}' and event_key like '%2026-11-02:sunday'`),"0");
      assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${member(player).id}' and event_key like '%2026-11-02:monday'`),"1");
      await enqueue("2026-07-05T16:00:00Z");assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${member(player).id}' and event_key like '%2026-07-06:sunday'`),"1");
      await enqueue("2027-01-03T17:00:00Z");assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${member(player).id}' and event_key like '%2027-01-04:sunday'`),"1");
    });
    await t.test("les erreurs temporaires cessent après cinq tentatives",async()=>{
      const existing=checked(await player.client.from("push_subscriptions").select("revision").eq("id",sub).single());checked(await notify(player.client,"subscribe",{endpoint,...keys},existing.revision));
      const id=await create();await materialize();const note=(await notes(player.client,id))[0];
      const delivery=sql(`select id from private.notification_deliveries where notification_id='${note.id}' and subscription_id='${sub}'`);assert.match(delivery,/^[\da-f-]{36}$/);
      sql(`update private.notification_deliveries set attempts=4 where id='${delivery}'`);
      const claim=checked(await admin.rpc("claim_notification_deliveries",{batch_size:20})).find(c=>c.id===delivery);assert.ok(claim);
      const prepared=checked(await admin.rpc("prepare_notification_delivery",{delivery_id:claim.id,token:claim.lease_token}));assert.equal(prepared.attempts,5);
      checked(await admin.rpc("finish_notification_delivery",{delivery_id:claim.id,token:claim.lease_token,outcome:"retry",error_code:"503",retry_seconds:1}));
      assert.equal(sql(`select status from private.notification_deliveries where id='${delivery}'`),"failed");assert.ok(!checked(await admin.rpc("claim_notification_deliveries",{batch_size:20})).some(c=>c.id===delivery));
    });
    await t.test("révocation supprime les appareils et bloque les anciennes notifications",async()=>{
      checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("id",member(player).id));
      assert.deepEqual(checked(await player.client.from("notifications").select("*")),[]);assert.deepEqual(checked(await player.client.from("push_subscriptions").select("*")),[]);
      assert.equal(checked(await admin.from("push_subscriptions").select("*").eq("membership_id",member(player).id)).length,0);
      assert.ok((await notify(player.client,"preferences",{reminders_enabled:true,push_enabled:true})).error);
    });
    await t.test("heartbeat avec bail, état administrateur et cron désactivé",async()=>{
      const results=await Promise.all([admin.rpc("begin_notification_job"),admin.rpc("begin_notification_job")]);const jobs=results.map(checked).filter(Boolean);assert.equal(jobs.length,1);
      checked(await admin.rpc("finish_notification_job",{job_id:jobs[0],success:true,counts:{sent:0}}));
      assert.ok((await player.client.rpc("notification_job_status")).error);const status=checked(await manager.client.rpc("notification_job_status"));assert.equal(status.last_run.status,"completed");
      assert.equal(sql("select schedule||':'||active from cron.job where jobname='ojq-notifications'"),"*/5 * * * *:false");
      sql(`delete from private.job_runs where id='${jobs[0]}'`);
      const interrupted=checked(await admin.rpc("begin_notification_job"));sql(`update private.job_runs set lease_until=clock_timestamp()-interval '1 second' where id='${interrupted}'`);
      const resumed=checked(await admin.rpc("begin_notification_job"));assert.notEqual(resumed,interrupted);assert.equal(sql(`select status from private.job_runs where id='${interrupted}'`),"abandoned");
      checked(await admin.rpc("finish_notification_job",{job_id:interrupted,success:true,counts:{}}));assert.equal(sql(`select status from private.job_runs where id='${interrupted}'`),"abandoned");
      checked(await admin.rpc("finish_notification_job",{job_id:resumed,success:true,counts:{}}));sql(`delete from private.job_runs where id in ('${interrupted}','${resumed}')`);
    });
  }finally{
    const all=[...sessions,...outbox];if(all.length){const list=all.map(id=>`'${id}'`).join(",");sql(`delete from private.notification_outbox where resource_id in (${list});delete from private.audit_events where resource_id in (${list})`);}
    if(sessions.length)checked(await admin.from("sessions").delete().in("id",sessions));
    checked(await admin.from("notifications").delete().in("membership_id",members.map(m=>m.id)));
    checked(await admin.from("availability_days").delete().in("membership_id",members.map(m=>m.id)));
    checked(await admin.from("memberships").delete().in("id",members.map(m=>m.id)));checked(await admin.from("profiles").delete().in("user_id",actors.map(p=>p.user.id)));
    for(const p of actors)checked(await admin.auth.admin.deleteUser(p.user.id));
  }
});
