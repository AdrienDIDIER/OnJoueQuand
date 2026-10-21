create table public.notification_preferences (
  membership_id uuid primary key references public.memberships(id) on delete cascade,
  reminders_enabled boolean not null default true, push_enabled boolean not null default false,
  revision integer not null default 1 check(revision>0)
);
create function private.valid_push_endpoint(endpoint text) returns boolean language sql immutable set search_path='' as $$
  select length(endpoint) between 30 and 2048 and endpoint ~ '^https://(fcm[.]googleapis[.]com/(fcm/send|wp)/[A-Za-z0-9:_=-]+|updates[.]push[.]services[.]mozilla[.]com/wpush/v2/[A-Za-z0-9=_-]+|web[.]push[.]apple[.]com/[A-Za-z0-9/_=-]+)$';
$$;
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.memberships(id) on delete cascade,
  endpoint text not null unique check(private.valid_push_endpoint(endpoint)),
  p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}$'), auth text not null check(auth ~ '^[A-Za-z0-9_-]{22}$'),
  revision integer not null default 1 check(revision>0), created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), membership_id uuid not null references public.memberships(id) on delete cascade,
  membership_epoch integer not null, event_key text not null, type text not null,
  resource_id uuid not null, payload jsonb not null default '{}', created_at timestamptz not null default now(),
  expires_at timestamptz not null, read_at timestamptz, revision integer not null default 1 check(revision>0),
  unique(membership_id,event_key)
);
create index notifications_inbox on public.notifications(membership_id,created_at desc);
create table private.notification_deliveries (
  id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade, subscription_revision integer,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed','skipped')),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  lease_until timestamptz, lease_token uuid, last_error_code text,
  unique(notification_id,subscription_id)
);
create index deliveries_due on private.notification_deliveries(status,next_attempt_at);
create index outbox_due on private.notification_outbox(status,available_at);
create table private.job_runs (
  id uuid primary key default gen_random_uuid(), started_at timestamptz not null default now(), finished_at timestamptz,
  lease_until timestamptz not null default(now()+interval '2 minutes'), status text not null default 'running' check(status in ('running','completed','failed','abandoned')),
  counters jsonb not null default '{}', error_code text
);
revoke all on private.notification_deliveries,private.job_runs from public,anon,authenticated;
grant all on private.notification_deliveries,private.job_runs to service_role;

alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
revoke all on public.notification_preferences,public.push_subscriptions,public.notifications from anon,authenticated;
grant select on public.notification_preferences,public.push_subscriptions,public.notifications to authenticated;
grant all on public.notification_preferences,public.push_subscriptions,public.notifications to service_role;
create function private.owns_membership(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where id=target and user_id=auth.uid() and status='active');
$$;
revoke all on function private.owns_membership(uuid),private.valid_push_endpoint(text) from public;
grant execute on function private.owns_membership(uuid) to authenticated;
create policy preferences_own on public.notification_preferences for select to authenticated using(private.owns_membership(membership_id));
create policy subscriptions_own on public.push_subscriptions for select to authenticated using(private.owns_membership(membership_id));
create policy notifications_own on public.notifications for select to authenticated using(private.owns_membership(membership_id));

create function public.notification_command(command text, expected_revision integer, payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.memberships; pref public.notification_preferences; sub public.push_subscriptions; note public.notifications; result uuid;
begin
  perform id from public.groups for update;
  select * into actor from public.memberships where user_id=auth.uid() and status='active' for update;
  if not found then raise exception 'Accès refusé.'; end if;
  if command='preferences' then
    select * into pref from public.notification_preferences where membership_id=actor.id for update;
    if pref.revision is distinct from expected_revision then raise exception 'Préférences modifiées. Rechargez.'; end if;
    if jsonb_typeof(payload->'reminders_enabled')<>'boolean' or jsonb_typeof(payload->'push_enabled')<>'boolean' then raise exception 'Préférences invalides.'; end if;
    insert into public.notification_preferences(membership_id,reminders_enabled,push_enabled) values(actor.id,(payload->>'reminders_enabled')::boolean,(payload->>'push_enabled')::boolean)
    on conflict(membership_id) do update set reminders_enabled=excluded.reminders_enabled,push_enabled=excluded.push_enabled,revision=notification_preferences.revision+1;
    return actor.id;
  elsif command='subscribe' then
    if not coalesce(private.valid_push_endpoint(payload->>'endpoint'),false) then raise exception 'Fournisseur Push non pris en charge.'; end if;
    select * into sub from public.push_subscriptions where endpoint=payload->>'endpoint' for update;
    if found and sub.membership_id<>actor.id then raise exception 'Abonnement déjà associé à un compte. Désabonnez cet appareil avant de changer de compte.'; end if;
    if sub.revision is distinct from expected_revision then raise exception 'Appareil modifié. Rechargez.'; end if;
    if sub.id is null and (select count(*) from public.push_subscriptions where membership_id=actor.id)>=10 then raise exception 'Retirez un ancien appareil avant de continuer.'; end if;
    insert into public.push_subscriptions(membership_id,endpoint,p256dh,auth) values(actor.id,payload->>'endpoint',payload->>'p256dh',payload->>'auth')
    on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,revision=push_subscriptions.revision+1 returning id into result;
    return result;
  elsif command='unsubscribe' then
    select * into sub from public.push_subscriptions where id=(payload->>'id')::uuid and membership_id=actor.id for update;
    if not found or sub.revision is distinct from expected_revision then raise exception 'Appareil modifié. Rechargez.'; end if;
    delete from public.push_subscriptions where id=sub.id; return sub.id;
  elsif command='read' then
    select * into note from public.notifications where id=(payload->>'id')::uuid and membership_id=actor.id for update;
    if not found or note.revision is distinct from expected_revision then raise exception 'Notification modifiée. Rechargez.'; end if;
    update public.notifications set read_at=coalesce(read_at,clock_timestamp()),revision=revision+1 where id=note.id;return note.id;
  end if;
  raise exception 'Commande invalide.';
end;
$$;
revoke all on function public.notification_command(text,integer,jsonb) from public,anon;
grant execute on function public.notification_command(text,integer,jsonb) to authenticated;

create function private.disable_revoked_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='revoked' then delete from public.push_subscriptions where membership_id=new.id; end if;
  return new;
end;
$$;
revoke all on function private.disable_revoked_push() from public;
create trigger disable_revoked_push after update of status on public.memberships for each row execute function private.disable_revoked_push();

create function private.notification_eligible(kind text, resource uuid, data jsonb, member_id uuid, epoch integer, reference_time timestamptz) returns boolean language plpgsql stable security definer set search_path='' as $$
declare s public.sessions; day date;
begin
  if not exists(select 1 from public.memberships where id=member_id and status='active' and participation_epoch=epoch) then return false; end if;
  if kind='availability.reminder' then
    day:=(data->>'week')::date;
    return coalesce((select reminders_enabled from public.notification_preferences where membership_id=member_id),true)
      and reference_time < (data->>'expires_at')::timestamptz
      and (select count(*) from public.availability_days where membership_id=member_id and local_date between day and day+6 and status<>'unanswered')<7;
  end if;
  select * into s from public.sessions where id=resource;
  if not found or s.published_at is null then return false; end if;
  if kind='session.published' then return s.status='voting' and s.vote_deadline>reference_time;
  elsif kind='session.vote_closed' then return s.status in ('voting','closed') and (s.status='closed' or s.vote_deadline<=reference_time) and exists(select 1 from public.session_slots where session_id=s.id and starts_at>reference_time);
  elsif kind='session.confirmed' then return s.status='confirmed' and exists(select 1 from public.session_slots where id=s.confirmed_slot_id and ends_at>reference_time);
  elsif kind='session.cancelled' then return s.status='cancelled'; end if;
  return false;
end;
$$;
revoke all on function private.notification_eligible(text,uuid,jsonb,uuid,integer,timestamptz) from public;

create function public.enqueue_availability_reminders(reference_time timestamptz default clock_timestamp()) returns integer language plpgsql security definer set search_path='' as $$
declare local_now timestamp:=reference_time at time zone 'Europe/Paris'; week date; stage text; expiry timestamptz; member public.memberships; inserted integer:=0; affected integer;
begin
  perform id from public.groups for update;
  week:=date_trunc('week',local_now)::date;
  if local_now>=((week+6)+time '18:00') then week:=week+7;stage:='sunday';expiry:=(week+time '18:00') at time zone 'Europe/Paris';
  elsif local_now<(week+time '18:00') then stage:='sunday';expiry:=(week+time '18:00') at time zone 'Europe/Paris';
  elsif local_now<((week+1)+time '18:00') then stage:='monday';expiry:=((week+1)+time '18:00') at time zone 'Europe/Paris';
  else return 0;end if;
  for member in select * from public.memberships where status='active' loop
    if private.notification_eligible('availability.reminder',member.id,jsonb_build_object('week',week,'expires_at',expiry),member.id,member.participation_epoch,reference_time) then
      insert into private.notification_outbox(event_key,type,resource_id,payload,available_at,expires_at)
      values('availability:'||member.id||':'||week||':'||stage,'availability.reminder',member.id,
        jsonb_build_object('membership_id',member.id,'membership_epoch',member.participation_epoch,'week',week,'stage',stage,'expires_at',expiry),reference_time,expiry) on conflict(event_key) do nothing;
      get diagnostics affected=row_count;inserted:=inserted+affected;
    end if;
  end loop;
  return inserted;
end;
$$;

create function public.materialize_notifications(batch_size integer default 30, reference_time timestamptz default clock_timestamp()) returns integer language plpgsql security definer set search_path='' as $$
declare event private.notification_outbox; member public.memberships; creator uuid; note_id uuid; processed integer:=0;
begin
  perform id from public.groups for update;
  for event in select * from private.notification_outbox where available_at<=reference_time and (status='pending' or (status='processing' and lease_until<=reference_time)) order by available_at,id limit least(greatest(batch_size,1),100) for update skip locked loop
    begin
      if event.expires_at<=reference_time then update private.notification_outbox set status='skipped' where id=event.id;continue;end if;
      select created_by into creator from public.sessions where id=event.resource_id;
      for member in select * from public.memberships where status='active' loop
        if event.type='availability.reminder' and (member.id::text<>event.payload->>'membership_id' or member.participation_epoch<>(event.payload->>'membership_epoch')::integer) then continue;end if;
        if event.type='session.vote_closed' then
          if exists(select 1 from public.memberships where id=creator and status='active') then if member.id<>creator then continue;end if;
          elsif member.role<>'admin' then continue;end if;
        elsif event.type like 'session.%' and member.user_id::text=event.payload->>'actor_user_id' then continue;end if;
        if not private.notification_eligible(event.type,event.resource_id,event.payload,member.id,member.participation_epoch,reference_time) then continue;end if;
        insert into public.notifications(membership_id,membership_epoch,event_key,type,resource_id,payload,expires_at)
          values(member.id,member.participation_epoch,event.event_key,event.type,event.resource_id,event.payload-'actor_user_id',event.expires_at)
          on conflict(membership_id,event_key) do nothing returning id into note_id;
        if note_id is not null and coalesce((select push_enabled from public.notification_preferences where membership_id=member.id),false) then
          insert into private.notification_deliveries(notification_id,subscription_id) select note_id,id from public.push_subscriptions where membership_id=member.id on conflict do nothing;
        end if;
      end loop;
      update private.notification_outbox set status='completed',attempts=attempts+1,lease_token=null,lease_until=null where id=event.id;
      processed:=processed+1;
    exception when others then update private.notification_outbox set status='failed',attempts=attempts+1 where id=event.id;
    end;
  end loop;
  return processed;
end;
$$;

create function public.claim_notification_deliveries(batch_size integer default 10) returns table(id uuid,lease_token uuid) language plpgsql security definer set search_path='' as $$
begin
  return query with due as(select d.id from private.notification_deliveries d where d.attempts<5 and d.next_attempt_at<=clock_timestamp() and (d.status='pending' or (d.status='sending' and d.lease_until<=clock_timestamp())) order by d.next_attempt_at,d.id limit least(greatest(batch_size,1),20) for update skip locked)
    update private.notification_deliveries d set status='sending',lease_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '90 seconds',attempts=d.attempts+1 from due where d.id=due.id returning d.id,d.lease_token;
end;
$$;
create function public.prepare_notification_delivery(delivery_id uuid,token uuid,reference_time timestamptz default clock_timestamp()) returns jsonb language plpgsql security definer set search_path='' as $$
declare d private.notification_deliveries; n public.notifications; s public.push_subscriptions;
begin
  perform id from public.groups for update;
  select * into d from private.notification_deliveries where id=delivery_id and lease_token=token and status='sending' and lease_until>reference_time for update;
  if not found then return null;end if;
  select * into n from public.notifications where id=d.notification_id;
  select * into s from public.push_subscriptions where id=d.subscription_id;
  if n.expires_at<=reference_time or n.read_at is not null or not coalesce((select push_enabled from public.notification_preferences where membership_id=n.membership_id),false)
    or not private.notification_eligible(n.type,n.resource_id,n.payload,n.membership_id,n.membership_epoch,reference_time) then
    update private.notification_deliveries set status='skipped',lease_until=null,lease_token=null where id=d.id;return null;
  end if;
  update private.notification_deliveries set subscription_revision=s.revision where id=d.id;
  return jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),'notification_id',n.id,'expires_at',n.expires_at,'type',n.type);
end;
$$;
create function public.finish_notification_delivery(delivery_id uuid,token uuid,outcome text,error_code text default null,retry_seconds integer default 60) returns boolean language plpgsql security definer set search_path='' as $$
declare d private.notification_deliveries;
begin
  perform id from public.groups for update;
  select * into d from private.notification_deliveries where id=delivery_id and lease_token=token and status='sending' and lease_until>clock_timestamp() for update;
  if not found then return false;end if;
  if outcome not in ('sent','retry','failed','gone','skipped') then raise exception 'Résultat invalide.';end if;
  if outcome='gone' then delete from public.push_subscriptions where id=d.subscription_id and revision=d.subscription_revision;end if;
  update private.notification_deliveries set status=case when outcome='retry' and attempts<5 then 'pending' when outcome='retry' then 'failed' when outcome='gone' then 'skipped' else outcome end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(greatest(retry_seconds,1),86400)),last_error_code=left(error_code,30),lease_token=null,lease_until=null where id=d.id;
  return true;
end;
$$;
create function public.begin_notification_job() returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform id from public.groups for update;
  if exists(select 1 from private.job_runs where status='running' and lease_until>clock_timestamp()) then return null;end if;
  update private.job_runs set status='abandoned',finished_at=clock_timestamp(),error_code='lease_expired' where status='running';
  update private.notification_deliveries set status='failed',lease_token=null,lease_until=null,last_error_code='attempt_limit' where status='sending' and lease_until<=clock_timestamp() and attempts>=5;
  insert into private.job_runs default values returning id into result;return result;
end;
$$;
create function public.finish_notification_job(job_id uuid,success boolean,counts jsonb) returns void language sql security definer set search_path='' as $$
 update private.job_runs set finished_at=clock_timestamp(),status=case when success then 'completed' else 'failed' end,counters=counts,error_code=case when success then null else 'job_failed' end where id=job_id and status='running' and lease_until>clock_timestamp();
$$;
create function public.notification_job_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Accès refusé.';end if;
 return jsonb_build_object('last_run',(select jsonb_build_object('started_at',started_at,'finished_at',finished_at,'status',status) from private.job_runs order by started_at desc limit 1),
 'outbox_pending',(select count(*) from private.notification_outbox where status in ('pending','processing')),'outbox_failed',(select count(*) from private.notification_outbox where status='failed'),
 'deliveries_pending',(select count(*) from private.notification_deliveries where status in ('pending','sending')),'deliveries_failed',(select count(*) from private.notification_deliveries where status='failed'));
end;
$$;
revoke all on function public.enqueue_availability_reminders(timestamptz),public.materialize_notifications(integer,timestamptz),public.claim_notification_deliveries(integer),public.prepare_notification_delivery(uuid,uuid,timestamptz),public.finish_notification_delivery(uuid,uuid,text,text,integer),public.begin_notification_job(),public.finish_notification_job(uuid,boolean,jsonb),public.notification_job_status() from public,anon,authenticated;
grant execute on function public.enqueue_availability_reminders(timestamptz),public.materialize_notifications(integer,timestamptz),public.claim_notification_deliveries(integer),public.prepare_notification_delivery(uuid,uuid,timestamptz),public.finish_notification_delivery(uuid,uuid,text,text,integer),public.begin_notification_job(),public.finish_notification_job(uuid,boolean,jsonb) to service_role;
grant execute on function public.notification_job_status() to authenticated;
