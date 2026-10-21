import {test} from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {clients,checked,identity} from "../../scripts/local-supabase.mjs";

test("J5 : propositions, votes, confirmations, RSVP et RLS réels",async t=>{
  const {admin,anonymous}=clients();const actors=[];const ids=[],games=[];
  const group=checked(await admin.from("groups").select("id").single());
  for(const label of ["organisateur","joueur","administrateur","externe"])actors.push(await identity(admin,anonymous,`sessions-${label}`));
  const [owner,player,manager,outsider]=actors;
  checked(await admin.from("profiles").insert(actors.slice(0,3).map(p=>({user_id:p.user.id,display_name:"Recette sessions"}))));
  const members=checked(await admin.from("memberships").insert(actors.slice(0,3).map(p=>({group_id:group.id,user_id:p.user.id,role:p===manager?"admin":"member"}))).select("*"));
  const member=p=>members.find(m=>m.user_id===p.user.id);
  const base=Math.ceil((Date.now()+7*86400000)/900000)*900000;
  const slots=[0,1].map(n=>({starts_at:new Date(base+n*86400000).toISOString(),ends_at:new Date(base+n*86400000+3600000).toISOString()}));
  const read=async id=>checked(await admin.from("sessions").select("*,slots:session_slots!session_slots_parent(*),ballots:session_ballots!ballots_parent(*,votes:session_votes!votes_ballot(*)),rsvps:session_rsvps!rsvps_parent(*)").eq("id",id).single());
  const create=async(c=owner.client,candidates=slots)=>{const id=checked(await c.rpc("create_session",{session_title:"Session de recette",session_description:"",selected_game:null,player_threshold:2,candidate_slots:candidates,deadline:null,request_id:randomUUID()}));ids.push(id);return id;};
  const command=async(c,id,cmd,payload={},revision)=>c.rpc("session_command",{target_id:id,command:cmd,expected_revision:revision??(await read(id)).revision,payload});
  const publish=async id=>checked(await command(owner.client,id,"publish"));
  const confirm=async id=>{await publish(id);const s=await read(id);checked(await command(owner.client,id,"confirm",{slot_id:[...s.slots].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at))[0].id}));};
  const sql=q=>execFileSync("docker",["exec","supabase_db_OnJoueQuand","psql","-U","postgres","-d","postgres","-Atc",q],{encoding:"utf8"}).trim();
  let main;
  try{
    await t.test("brouillons privés, annulation privée, accès externes et DML refusés",async()=>{
      main=await create();
      assert.equal(checked(await player.client.from("sessions").select("*").eq("id",main)).length,0);
      assert.equal(checked(await manager.client.from("sessions").select("*").eq("id",main)).length,1);
      for(const c of [anonymous(),outsider.client]){
        for(const table of ["sessions","session_slots","session_ballots","session_votes","session_rsvps"]){const r=await c.from(table).select("*");assert.ok(r.error||r.data.length===0);}
        assert.ok((await command(c,main,"publish")).error);assert.ok((await c.rpc("session_clock")).error);
        const busy=await c.rpc("read_confirmed_commitments",{member_ids:[member(owner).id],period_start:slots[0].starts_at,period_end:slots[1].ends_at});assert.ok(busy.error||busy.data.length===0);
      }
      assert.ok((await player.client.from("sessions").update({title:"Vol"}).eq("id",main)).error);
      const cancelled=await create();checked(await command(owner.client,cancelled,"cancel"));
      assert.equal(checked(await player.client.from("sessions").select("*").eq("id",cancelled)).length,0);
      const empty=await create(owner.client,[]);assert.ok((await command(owner.client,empty,"publish")).error);
      assert.ok((await command(player.client,main,"publish")).error);
    });
    await t.test("création idempotente, édition révisée et validation de publication",async()=>{
      const args={session_title:"Brouillon révisé",session_description:"",selected_game:null,player_threshold:2,candidate_slots:slots,deadline:null,request_id:randomUUID()};
      const id=checked(await owner.client.rpc("create_session",args));ids.push(id);assert.equal(checked(await owner.client.rpc("create_session",args)),id);
      const payload={title:"Brouillon modifié",description:"",game_id:null,minimum_players:3,slots,vote_deadline:null};
      assert.ok((await command(player.client,id,"update",payload)).error);checked(await command(owner.client,id,"update",payload,1));assert.ok((await command(owner.client,id,"update",payload,1)).error);assert.equal((await read(id)).title,payload.title);
      const single=await create(owner.client,slots.slice(0,1));assert.ok((await command(owner.client,single,"publish")).error);
      const invalid=checked(await owner.client.rpc("create_session",{...args,deadline:new Date(base+1000).toISOString(),request_id:randomUUID()}));ids.push(invalid);assert.ok((await command(owner.client,invalid,"publish")).error);
      for(const candidate_slots of [[slots[0],slots[0]],[{starts_at:slots[0].ends_at,ends_at:slots[0].starts_at}],[{starts_at:new Date(base+1000).toISOString(),ends_at:slots[0].ends_at}]])assert.ok((await owner.client.rpc("create_session",{...args,candidate_slots,request_id:randomUUID()})).error);
      const game=checked(await owner.client.rpc("create_game",{game_name:"Jeu de session",game_description:"",request_id:randomUUID()}));games.push(game);
      const archived=checked(await owner.client.rpc("create_session",{...args,selected_game:game,request_id:randomUUID()}));ids.push(archived);checked(await owner.client.rpc("archive_game",{target_id:game,expected_revision:1}));assert.ok((await command(owner.client,archived,"publish")).error);
    });
    await t.test("publication immuable, votes multiples et bulletin vide distinct d’une absence",async()=>{
      await publish(main);const s=await read(main);assert.equal(s.status,"voting");assert.equal(s.ballots.length,0);
      assert.ok((await admin.from("session_slots").update({ends_at:new Date(base+7200000).toISOString()}).eq("id",s.slots[0].id)).error);
      checked(await command(player.client,main,"vote",{choices:s.slots.map(x=>x.id),expected_ballot_revision:null}));
      let r=await read(main);assert.equal(r.ballots[0].votes.length,2);
      assert.ok((await command(player.client,main,"vote",{choices:[],expected_ballot_revision:null})).error);
      checked(await command(player.client,main,"vote",{choices:[],expected_ballot_revision:1}));
      r=await read(main);assert.equal(r.ballots.length,1);assert.equal(r.ballots[0].votes.length,0);
      const foreign=await create();const other=await read(foreign);
      assert.ok((await command(player.client,main,"vote",{choices:[other.slots[0].id],expected_ballot_revision:2})).error);
      assert.ok((await player.client.from("session_votes").insert({group_id:group.id,session_id:main,ballot_id:r.ballots[0].id,slot_id:s.slots[0].id})).error);
    });
    await t.test("vote et clôture concurrents, confirmation unique sans RSVP implicite",async()=>{
      const s=await read(main);
      const results=await Promise.all([command(player.client,main,"vote",{choices:[s.slots[0].id],expected_ballot_revision:2},s.revision),command(owner.client,main,"close",{},s.revision)]);
      assert.equal(results[1].error,null);
      assert.ok((await command(player.client,main,"vote",{choices:[],expected_ballot_revision:3})).error);
      const closed=await read(main);
      const foreign=await create();assert.ok((await command(owner.client,main,"confirm",{slot_id:(await read(foreign)).slots[0].id})).error);
      const confirmed=await Promise.all(closed.slots.map(slot=>command(owner.client,main,"confirm",{slot_id:slot.id},closed.revision)));
      assert.equal(confirmed.filter(r=>!r.error).length,1);assert.equal((await read(main)).rsvps.length,0);
      assert.equal(sql(`select count(*) from private.notification_outbox where resource_id='${main}' and type='session.confirmed'`),"1");
      assert.ok((await command(player.client,main,"cancel")).error);
    });
    await t.test("échéance PostgreSQL opposable avant cron et confirmation après clôture effective",async()=>{
      const id=await create();await publish(id);checked(await admin.from("sessions").update({vote_deadline:new Date(Date.now()-1000).toISOString()}).eq("id",id));
      assert.ok((await command(player.client,id,"vote",{choices:[],expected_ballot_revision:null})).error);
      const s=await read(id);assert.equal(s.status,"voting");checked(await command(owner.client,id,"confirm",{slot_id:s.slots[0].id},s.revision));assert.equal((await read(id)).status,"confirmed");
    });
    await t.test("RSVP concurrents : un seul engagement, refus des réponses obsolètes, frontières contiguës",async()=>{
      const a=await create(),b=await create();await confirm(a);await confirm(b);
      const results=await Promise.all([a,b].map(id=>command(player.client,id,"rsvp",{response:"attending",expected_rsvp_revision:null})));
      assert.equal(results.filter(r=>!r.error).length,1);
      const accepted=results[0].error?b:a,refused=accepted===a?b:a;
      assert.ok((await command(player.client,accepted,"rsvp",{response:"declined",expected_rsvp_revision:null})).error);
      const busyArgs={member_ids:[member(player).id],period_start:new Date(base-3600000).toISOString(),period_end:new Date(base+7200000).toISOString()};
      assert.equal(checked(await owner.client.rpc("read_confirmed_commitments",busyArgs)).length,1);
      const adjacent=await create(owner.client,slots.map(s=>({starts_at:new Date(Date.parse(s.ends_at)).toISOString(),ends_at:new Date(Date.parse(s.ends_at)+3600000).toISOString()})));await confirm(adjacent);
      checked(await command(player.client,adjacent,"rsvp",{response:"attending",expected_rsvp_revision:null}));
      checked(await command(player.client,accepted,"rsvp",{response:"declined",expected_rsvp_revision:1}));
      checked(await command(player.client,refused,"rsvp",{response:"attending",expected_rsvp_revision:null}));
      checked(await command(owner.client,refused,"cancel"));
      assert.equal(checked(await owner.client.rpc("read_confirmed_commitments",busyArgs)).length,1);
    });
    await t.test("révocation puis réinvitation n’activent pas d’anciens RSVP",async()=>{
      const epoch=member(player).participation_epoch;
      checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("id",member(player).id));
      assert.deepEqual(checked(await player.client.from("sessions").select("*")),[]);assert.ok((await command(player.client,main,"rsvp",{response:"attending",expected_rsvp_revision:null})).error);
      checked(await admin.from("memberships").update({status:"active",revoked_at:null}).eq("id",member(player).id));
      assert.equal(checked(await admin.from("memberships").select("participation_epoch").eq("id",member(player).id).single()).participation_epoch,epoch+2);
      const args={member_ids:[member(player).id],period_start:new Date(base-3600000).toISOString(),period_end:new Date(base+3*86400000).toISOString()};
      assert.deepEqual(checked(await owner.client.rpc("read_confirmed_commitments",args)),[]);
      const oldRows=checked(await admin.from("session_rsvps").select("*").eq("membership_id",member(player).id).eq("response","attending"));
      let restored=false;
      for(const old of oldRows){const session=await read(old.session_id);if(session.status!=="confirmed")continue;
        checked(await command(player.client,session.id,"rsvp",{response:"attending",expected_rsvp_revision:old.revision}));restored=true;break;}
      assert.equal(restored,true);assert.equal(checked(await owner.client.rpc("read_confirmed_commitments",args)).length,1);
    });
    await t.test("début passé interdit, fin et expiration rattrapées par le job",async()=>{
      const past=Math.floor((Date.now()-7200000)/900000)*900000;
      const fixture=async(status,start,end)=>{
        const id=await create(owner.client,[]);const slot=checked(await admin.from("session_slots").insert({group_id:group.id,session_id:id,starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString()}).select("id").single());
        checked(await admin.from("sessions").update({status,published_at:new Date(past-3600000).toISOString(),vote_deadline:new Date(past-3600000).toISOString(),confirmed_slot_id:status==="confirmed"?slot.id:null}).eq("id",id));return id;
      };
      const ongoing=await fixture("confirmed",past,base);
      assert.ok((await command(player.client,ongoing,"rsvp",{response:"attending",expected_rsvp_revision:null})).error);
      const ended=await fixture("confirmed",past,past+3600000),expired=await fixture("closed",past,past+3600000),closed=await create();await publish(closed);
      checked(await admin.from("sessions").update({vote_deadline:new Date(past).toISOString()}).eq("id",closed));
      checked(await admin.rpc("advance_sessions",{batch_size:200}));
      assert.equal((await read(ended)).status,"completed");assert.equal((await read(expired)).status,"expired");assert.equal((await read(closed)).status,"closed");assert.equal((await read(ongoing)).status,"confirmed");
    });
    await t.test("administrateur remplace un créateur révoqué et job réservé au backend",async()=>{
      const id=await create();await publish(id);
      checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("id",member(owner).id));
      const s=await read(id);checked(await command(manager.client,id,"confirm",{slot_id:s.slots[0].id}));
      for(const c of [anonymous(),player.client,outsider.client])assert.ok((await c.rpc("advance_sessions",{batch_size:1})).error);
      checked(await admin.rpc("advance_sessions",{batch_size:100}));
    });
  }finally{
    if(ids.length){checked(await admin.from("sessions").delete().in("id",ids));sql(`delete from private.notification_outbox where resource_id in (${ids.map(id=>`'${id}'`).join(",")}); delete from private.audit_events where resource_id in (${ids.map(id=>`'${id}'`).join(",")})`);}
    if(games.length)checked(await admin.from("games").delete().in("id",games));
    checked(await admin.from("memberships").delete().in("id",members.map(m=>m.id)));checked(await admin.from("profiles").delete().in("user_id",actors.map(p=>p.user.id)));
    for(const p of actors)checked(await admin.auth.admin.deleteUser(p.user.id));
  }
});
