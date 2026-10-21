begin;
set local timezone='Pacific/Honolulu';
create function pg_temp.ensure(ok boolean,label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Recette conservation : %',label; end if; end; $$;
create temporary table fixture_context as select :'actor'::uuid actor, :'group'::uuid gid,
  (select id from public.memberships where user_id=:'actor'::uuid) member,
  '2026-10-25T23:30:00Z'::timestamptz reference_time;
create temporary table fixture_ids(name text primary key,id uuid default gen_random_uuid());
insert into fixture_ids(name) values ('old_day'),('boundary_day'),('old_draft'),('fresh_draft'),('old_cancelled'),('fresh_cancelled'),('completed'),('future'),('slot'),('completed_slot'),('note'),('leased_note'),('sub'),('delivery'),('leased_delivery'),('old_event'),('alive_event'),('old_job'),('alive_job'),('expired_invite'),('fresh_invite');

insert into public.availability_days(id,group_id,membership_id,local_date,status,mode)
select i.id,c.gid,c.member,case when i.name='old_day' then '2026-08-02'::date else '2026-08-03'::date end,
  case when i.name='old_day' then 'available' else 'unavailable' end,case when i.name='old_day' then 'quick' end
from fixture_ids i cross join fixture_context c where i.name in ('old_day','boundary_day');
insert into public.availability_intervals(group_id,membership_id,day_id,starts_at,ends_at)
select gid,member,(select id from fixture_ids where name='old_day'),'2026-08-02T18:00Z','2026-08-02T21:00Z' from fixture_context;

-- Les fixtures historiques contournent les triggers de création, jamais les commandes testées.
set local session_replication_role=replica;
insert into public.sessions(id,group_id,created_by,title,status,idempotency_key,confirmed_slot_id,published_at)
select i.id,c.gid,c.member,'Recette conservation',case i.name when 'completed' then 'completed' when 'future' then 'confirmed' when 'old_cancelled' then 'cancelled' when 'fresh_cancelled' then 'cancelled' else 'draft' end,
  gen_random_uuid(),case i.name when 'completed' then (select id from fixture_ids where name='completed_slot') when 'future' then (select id from fixture_ids where name='slot') end,
  case when i.name in ('completed','future') then now() end
from fixture_ids i cross join fixture_context c where i.name in ('old_draft','fresh_draft','old_cancelled','fresh_cancelled','completed','future');
insert into public.session_slots(id,group_id,session_id,starts_at,ends_at)
select sl.id,c.gid,s.id,case when s.name='completed' then '2025-01-01T19:00Z'::timestamptz else '2028-01-01T19:00Z'::timestamptz end,
  case when s.name='completed' then '2025-01-01T20:00Z'::timestamptz else '2028-01-01T20:00Z'::timestamptz end
from fixture_context c join fixture_ids s on s.name in ('completed','future') join fixture_ids sl on sl.name=case when s.name='completed' then 'completed_slot' else 'slot' end;
-- Préparer l'historique sans simuler l'horloge globale. Seulement dans cette transaction synthétique.
set local session_replication_role=replica;
update public.sessions s set updated_at='2024-01-01T00:00Z',terminal_at=(case when i.name in ('completed','old_cancelled') then '2024-01-01T00:00Z' else '2026-10-20T00:00Z' end)::timestamptz
from fixture_ids i where s.id=i.id and i.name in ('old_draft','old_cancelled','fresh_cancelled','completed','future');
set local session_replication_role=origin;
update public.sessions set updated_at='2024-01-01T00:00Z' where id=(select id from fixture_ids where name='fresh_draft');
select pg_temp.ensure((select updated_at>now()-interval '1 minute' from public.sessions where id=(select id from fixture_ids where name='fresh_draft')),'horodatage de modification non falsifiable');
update public.sessions set terminal_at='2024-01-01T00:00Z' where id=(select id from fixture_ids where name='fresh_cancelled');
select pg_temp.ensure((select terminal_at='2026-10-20T00:00Z'::timestamptz from public.sessions where id=(select id from fixture_ids where name='fresh_cancelled')),'annulation récente préservée malgré création ancienne');

insert into public.invitations(id,group_id,normalized_email,invited_by,status,expires_at,idempotency_key)
select i.id,c.gid,i.id::text||'@example.test',c.actor,'pending',case when i.name='expired_invite' then '2024-01-01T00:00Z'::timestamptz else '2028-01-01T00:00Z'::timestamptz end,gen_random_uuid()
from fixture_ids i cross join fixture_context c where i.name in ('expired_invite','fresh_invite');
insert into public.notifications(id,membership_id,membership_epoch,event_key,type,resource_id,created_at,expires_at)
select i.id,c.member,1,i.id::text,'session.confirmed',gen_random_uuid(),'2024-01-01T00:00Z','2024-01-02T00:00Z'
from fixture_ids i cross join fixture_context c where i.name in ('note','leased_note');
insert into public.push_subscriptions(id,membership_id,endpoint,p256dh,auth)
select i.id,c.member,'https://fcm.googleapis.com/fcm/send/'||i.id::text,repeat('a',87),repeat('a',22) from fixture_ids i cross join fixture_context c where i.name='sub';
insert into private.notification_deliveries(id,notification_id,subscription_id,status,lease_until,lease_token)
select d.id,n.id,(select id from fixture_ids where name='sub'),'sending',case when d.name='delivery' then c.reference_time-interval '1 hour' else c.reference_time+interval '1 hour' end,gen_random_uuid()
from fixture_context c join fixture_ids d on d.name in ('delivery','leased_delivery') join fixture_ids n on n.name=case when d.name='delivery' then 'note' else 'leased_note' end;
insert into private.notification_outbox(id,event_key,type,resource_id,status,available_at,expires_at,lease_until)
select i.id,i.id::text,'session.confirmed',gen_random_uuid(),'processing','2024-01-01T00:00Z','2024-01-02T00:00Z',case when i.name='old_event' then c.reference_time-interval '1 hour' else c.reference_time+interval '1 hour' end
from fixture_ids i cross join fixture_context c where i.name in ('old_event','alive_event');
insert into private.job_runs(id,started_at,finished_at,status,lease_until)
select i.id,'2024-01-01T00:00Z',case when i.name='old_job' then '2024-01-01T00:00Z'::timestamptz end,case when i.name='old_job' then 'completed' else 'running' end,c.reference_time+interval '1 hour'
from fixture_ids i cross join fixture_context c where i.name in ('old_job','alive_job');
insert into private.audit_events(actor_id,action,resource_id,created_at) select actor,'retention.fixture',actor,'2024-01-01T00:00Z' from fixture_context;

select public.purge_retained_data(500,reference_time) from fixture_context;
select pg_temp.ensure(not exists(select 1 from public.availability_days where id=(select id from fixture_ids where name='old_day')),'journée antérieure aux douze semaines supprimée');
select pg_temp.ensure(not exists(select 1 from public.availability_intervals where day_id=(select id from fixture_ids where name='old_day')),'intervalles supprimés en cascade');
select pg_temp.ensure(exists(select 1 from public.availability_days where id=(select id from fixture_ids where name='boundary_day')),'frontière lundi préservée malgré UTC dimanche et changement d’heure');
select pg_temp.ensure(not exists(select 1 from public.sessions s join fixture_ids i on s.id=i.id where i.name in ('old_draft','old_cancelled','completed')),'sessions terminales et brouillon anciens supprimés');
select pg_temp.ensure((select count(*)=3 from public.sessions s join fixture_ids i on s.id=i.id where i.name in ('fresh_draft','fresh_cancelled','future')),'brouillon modifié, annulation récente et session future préservés');
select pg_temp.ensure(not exists(select 1 from public.session_slots where id=(select id from fixture_ids where name='completed_slot')),'créneau confirmé purgé en cascade');
select pg_temp.ensure(not exists(select 1 from public.invitations where id=(select id from fixture_ids where name='expired_invite')),'invitation expirée terminalisée avant purge');
select pg_temp.ensure(exists(select 1 from public.invitations where id=(select id from fixture_ids where name='fresh_invite')),'invitation valide préservée');
select pg_temp.ensure(not exists(select 1 from public.notifications where id=(select id from fixture_ids where name='note')),'ancienne notification et livraison expirée supprimées');
select pg_temp.ensure(exists(select 1 from public.notifications where id=(select id from fixture_ids where name='leased_note')),'notification avec livraison vivante préservée');
select pg_temp.ensure(exists(select 1 from private.notification_deliveries where id=(select id from fixture_ids where name='leased_delivery')),'bail vivant préservé');
select pg_temp.ensure(not exists(select 1 from private.notification_outbox where id=(select id from fixture_ids where name='old_event')),'outbox expirée clôturée puis purgée');
select pg_temp.ensure(exists(select 1 from private.notification_outbox where id=(select id from fixture_ids where name='alive_event') and status='processing'),'outbox avec bail vivant préservée');
select pg_temp.ensure(not exists(select 1 from private.job_runs where id=(select id from fixture_ids where name='old_job')),'job terminé ancien supprimé');
select pg_temp.ensure(exists(select 1 from private.job_runs where id=(select id from fixture_ids where name='alive_job') and status='running'),'job vivant préservé');
select pg_temp.ensure(not exists(select 1 from private.audit_events where action='retention.fixture' and actor_id=(select actor from fixture_context)),'audit ancien supprimé');
-- Second passage : pas de nouveau travail éligible dans les fixtures.
select public.purge_retained_data(500,reference_time) from fixture_context;
select pg_temp.ensure((select count(*)=3 from public.sessions s join fixture_ids i on s.id=i.id where i.name in ('fresh_draft','fresh_cancelled','future')),'réexécution sans suppression supplémentaire');
rollback;
