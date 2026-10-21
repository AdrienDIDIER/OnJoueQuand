import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { clients,checked,identity } from "../../scripts/local-supabase.mjs";
test("J4 : jeux, favoris, droits et concurrence",async(t)=>{
  const {admin,anonymous}=clients();
  const owner=await identity(admin,anonymous,"jeux-createur");
  const player=await identity(admin,anonymous,"jeux-membre");
  const manager=await identity(admin,anonymous,"jeux-admin");
  const outsider=await identity(admin,anonymous,"jeux-externe");
  let group=checked(await admin.from("groups").select("id").maybeSingle());
  if(!group) group=checked(await admin.from("groups").insert({}).select("id").single());
  checked(await admin.from("profiles").insert([owner,player,manager].map(p=>({user_id:p.user.id,display_name:"Recette jeux"}))));
  const members=checked(await admin.from("memberships").insert([owner,player,manager].map(p=>({group_id:group.id,user_id:p.user.id,role:p===manager?"admin":"member"}))).select("*"));
  const ownerMember=members.find(m=>m.user_id===owner.user.id), playerMember=members.find(m=>m.user_id===player.user.id);
  const gameIds=[]; let game;
  try {
    await t.test("création idempotente et lectures réservées aux membres",async()=>{
      const args={game_name:"Jeu coopératif",game_description:"Soirée du groupe",request_id:randomUUID()};
      game=checked(await owner.client.rpc("create_game",args)); gameIds.push(game);
      assert.equal(checked(await owner.client.rpc("create_game",args)),game);
      assert.equal(checked(await player.client.from("games").select("name").eq("id",game).single()).name,"Jeu coopératif");
      for(const client of [anonymous(),outsider.client]) {
        const read=await client.from("games").select("*"); assert.ok(read.error||read.data.length===0);
        const favorites=await client.from("game_favorites").select("*"); assert.ok(favorites.error||favorites.data.length===0);
        assert.ok((await client.rpc("create_game",{...args,request_id:randomUUID()})).error);
        assert.ok((await client.rpc("set_game_favorite",{target_id:game,favorite:true,expected_favorite:false})).error);
      }
      assert.ok((await player.client.from("games").insert({group_id:group.id,created_by:playerMember.id,name:"Injection",idempotency_key:randomUUID()})).error);
    });
    await t.test("créateur ou admin seulement, révisions opposables et contraintes de texte",async()=>{
      assert.ok((await player.client.rpc("update_game",{target_id:game,game_name:"Vol",game_description:"",expected_revision:1})).error);
      assert.ok((await player.client.rpc("archive_game",{target_id:game,expected_revision:1})).error);
      checked(await owner.client.rpc("update_game",{target_id:game,game_name:"Jeu renommé",game_description:"",expected_revision:1}));
      assert.ok((await owner.client.rpc("update_game",{target_id:game,game_name:"Écrasement",game_description:"",expected_revision:1})).error);
      checked(await manager.client.rpc("update_game",{target_id:game,game_name:"Jeu validé",game_description:"Description",expected_revision:2}));
      for(const name of [" ","a".repeat(81)]) assert.ok((await owner.client.rpc("create_game",{game_name:name,game_description:"",request_id:randomUUID()})).error);
    });
    await t.test("favoris propres au JWT, unicité et ajout concurrent",async()=>{
      const args={target_id:game,favorite:true,expected_favorite:false};
      const results=await Promise.all([1,2].map(()=>owner.client.rpc("set_game_favorite",args)));
      assert.equal(results.filter(r=>!r.error).length,1);
      checked(await player.client.rpc("set_game_favorite",args));
      const favorites=checked(await owner.client.from("game_favorites").select("membership_id").eq("game_id",game));
      assert.deepEqual(favorites.map(f=>f.membership_id).sort(),[ownerMember.id,playerMember.id].sort());
      assert.ok((await player.client.from("game_favorites").delete().eq("membership_id",ownerMember.id)).error);
      checked(await player.client.rpc("set_game_favorite",{...args,favorite:false,expected_favorite:true}));
      assert.equal(checked(await owner.client.from("game_favorites").select("*").eq("game_id",game)).length,1);
    });
    await t.test("édition concurrente à l’archivage, sans suppression de l’historique",async()=>{
      const result=await Promise.all([
        owner.client.rpc("update_game",{target_id:game,game_name:"Dernier nom",game_description:"",expected_revision:3}),
        manager.client.rpc("archive_game",{target_id:game,expected_revision:3}),
      ]);
      assert.equal(result.filter(r=>!r.error).length,1);
      let row=checked(await owner.client.from("games").select("*").eq("id",game).single());
      if(!row.archived_at) checked(await manager.client.rpc("archive_game",{target_id:game,expected_revision:row.revision}));
      row=checked(await owner.client.from("games").select("*").eq("id",game).single());
      assert.ok(row.archived_at);
      assert.equal(checked(await owner.client.from("game_favorites").select("*").eq("game_id",game)).length,1);
      assert.ok((await player.client.rpc("set_game_favorite",{target_id:game,favorite:true,expected_favorite:false})).error);
      assert.ok((await owner.client.rpc("update_game",{target_id:game,game_name:"Réouverture",game_description:"",expected_revision:row.revision})).error);
      checked(await owner.client.rpc("set_game_favorite",{target_id:game,favorite:false,expected_favorite:true}));
    });
    await t.test("membre révoqué sans lecture ni mutation malgré son jeton",async()=>{
      checked(await admin.from("memberships").update({status:"revoked",revoked_at:new Date().toISOString()}).eq("id",ownerMember.id));
      assert.deepEqual(checked(await owner.client.from("games").select("*")),[]);
      assert.deepEqual(checked(await owner.client.from("game_favorites").select("*")),[]);
      assert.ok((await owner.client.rpc("create_game",{game_name:"Retour",game_description:"",request_id:randomUUID()})).error);
    });
  } finally {
    if(gameIds.length) {checked(await admin.from("game_favorites").delete().in("game_id",gameIds));checked(await admin.from("games").delete().in("id",gameIds));}
    checked(await admin.from("memberships").delete().in("id",members.map(m=>m.id)));
    checked(await admin.from("profiles").delete().in("user_id",[owner,player,manager].map(p=>p.user.id)));
    for(const p of [owner,player,manager,outsider]) checked(await admin.auth.admin.deleteUser(p.user.id));
  }
});
