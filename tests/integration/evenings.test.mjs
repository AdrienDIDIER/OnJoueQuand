import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID,createECDH,randomBytes} from "node:crypto";
import {execFileSync} from "node:child_process";
import {clients,checked,identity} from "../../scripts/local-supabase.mjs";

test("soirées directes et test Push : transactions, droits et concurrence",async t=>{
  const {admin,anonymous}=clients(),actors=[],ids=[];
  const group=checked(await admin.from("groups").select("id").single());
  for(const label of ["owner","player","outside","revoked"])actors.push(await identity(admin,anonymous,`evening-${label}`));
  const [owner,player,outside,revoked]=actors;
  checked(await admin.from("profiles").insert(actors.slice(0,2).concat(revoked).map(actor=>({user_id:actor.user.id,display_name:"Recette soirée"}))));
  const members=checked(await admin.from("memberships").insert([owner,player,revoked].map(actor=>({user_id:actor.user.id,group_id:group.id}))).select("*"));
  checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("user_id",revoked.user.id));
  const base=Math.ceil((Date.now()+7*86400000)/900000)*900000;
  const args={evening_title:"Soirée de recette",selected_game:null,starts_at:new Date(base).toISOString(),ends_at:new Date(base+3*3600000).toISOString(),request_id:randomUUID()};
  const sql=query=>execFileSync("docker",["exec","supabase_db_OnJoueQuand","psql","-U","postgres","-d","postgres","-Atc",query],{encoding:"utf8"}).trim();
  try{
    await t.test("refus des comptes non autorisés et des horaires invalides sans création partielle",async()=>{
      for(const client of [anonymous(),outside.client,revoked.client])assert.ok((await client.rpc("create_evening",args)).error);
      for(const patch of [{starts_at:new Date(Date.now()-60000).toISOString()},{ends_at:args.starts_at},{ends_at:new Date(base+26*3600000).toISOString()},{selected_game:randomUUID()}]){
        const request_id=randomUUID();assert.ok((await owner.client.rpc("create_evening",{...args,...patch,request_id})).error);
        assert.equal(checked(await admin.from("sessions").select("id").eq("idempotency_key",request_id)).length,0);
      }
    });
    let evening;
    await t.test("double envoi : une soirée confirmée, un horaire, un événement et aucun RSVP implicite",async()=>{
      const responses=await Promise.all([owner.client.rpc("create_evening",args),owner.client.rpc("create_evening",args)]);
      evening=checked(responses[0]);ids.push(evening);assert.equal(checked(responses[1]),evening);
      const row=checked(await player.client.from("sessions").select("*,slots:session_slots!session_slots_parent(*),rsvps:session_rsvps!rsvps_parent(*)").eq("id",evening).single());
      assert.equal(row.status,"confirmed");assert.equal(row.vote_deadline,null);assert.equal(row.slots.length,1);assert.equal(row.confirmed_slot_id,row.slots[0].id);assert.equal(row.rsvps.length,0);
      assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${evening}' and type='session.confirmed'`),"1");
      assert.ok((await player.client.rpc("create_evening",args)).error);
    });
    await t.test("réponses explicites et refus d’un double engagement",async()=>{
      const second=checked(await owner.client.rpc("create_evening",{...args,request_id:randomUUID()}));ids.push(second);
      const command=id=>player.client.rpc("session_command",{target_id:id,command:"rsvp",expected_revision:2,payload:{response:"attending",expected_rsvp_revision:null}});
      const results=await Promise.all([command(evening),command(second)]);assert.equal(results.filter(row=>!row.error).length,1);
      assert.ok((await player.client.rpc("session_command",{target_id:evening,command:"cancel",expected_revision:2})).error);
    });
    await t.test("test Push réservé à son appareil, préférence respectée, limite concurrente d’une minute",async()=>{
      const key=createECDH("prime256v1");key.generateKeys();
      const endpoint=`https://web.push.apple.com/recette/${randomUUID()}`;
      checked(await owner.client.rpc("notification_command",{command:"subscribe",expected_revision:null,payload:{endpoint,p256dh:key.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}}));
      for(const client of [anonymous(),outside.client,revoked.client])assert.ok((await client.rpc("reserve_push_test",{target_endpoint:endpoint})).error);
      assert.equal(checked(await player.client.rpc("reserve_push_test",{target_endpoint:endpoint})).error,"device");
      const results=await Promise.all([owner.client.rpc("reserve_push_test",{target_endpoint:endpoint}),owner.client.rpc("reserve_push_test",{target_endpoint:endpoint})]);
      assert.equal(results.map(checked).filter(row=>row.endpoint===endpoint).length,1);
      assert.equal(results.map(checked).filter(row=>row.error==="limited").length,1);
      const member=members.find(row=>row.user_id===owner.user.id);
      checked(await admin.from("notification_preferences").update({push_enabled:false}).eq("membership_id",member.id));
      assert.equal(checked(await owner.client.rpc("reserve_push_test",{target_endpoint:endpoint})).error,"disabled");
    });
  }finally{
    if(ids.length){checked(await admin.from("sessions").delete().in("id",ids));const keys=ids.map(id=>`'${id}'`).join(",");sql(`delete from private.notification_outbox where resource_id in (${keys}); delete from private.audit_events where resource_id in (${keys})`);}
    checked(await admin.from("memberships").delete().in("id",members.map(row=>row.id)));
    checked(await admin.from("profiles").delete().in("user_id",actors.map(actor=>actor.user.id)));
    for(const actor of actors)checked(await admin.auth.admin.deleteUser(actor.user.id));
  }
});
