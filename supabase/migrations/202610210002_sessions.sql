-- L'époque de participation préserve l'historique sans réactiver les anciens RSVP.
alter table public.memberships add column participation_epoch integer not null default 1 check (participation_epoch > 0);
create function private.membership_participation_epoch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.participation_epoch := old.participation_epoch + case when new.status <> old.status then 1 else 0 end;
  return new;
end;
$$;
revoke all on function private.membership_participation_epoch() from public;
create trigger membership_participation_epoch before update on public.memberships for each row execute function private.membership_participation_epoch();

create table public.sessions (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id), created_by uuid not null,
  title text not null check (length(trim(title)) between 1 and 120), description text not null default '' check (length(description) <= 2000),
  game_id uuid, status text not null default 'draft' check (status in ('draft','voting','closed','confirmed','completed','cancelled','expired')),
  vote_deadline timestamptz, minimum_players integer not null default 2 check (minimum_players > 0), confirmed_slot_id uuid,
  published_at timestamptz, revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), idempotency_key uuid not null unique,
  unique(group_id,id), foreign key(group_id,created_by) references public.memberships(group_id,id),
  foreign key(group_id,game_id) references public.games(group_id,id),
  check (status not in ('confirmed','completed') or confirmed_slot_id is not null),
  check (confirmed_slot_id is null or status in ('confirmed','completed','cancelled')),
  check (status not in ('voting','closed','confirmed','completed','expired') or published_at is not null)
);
create table public.session_slots (
  id uuid primary key default gen_random_uuid(), group_id uuid not null, session_id uuid not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  constraint session_slots_parent foreign key(group_id,session_id) references public.sessions(group_id,id) on delete cascade,
  unique(group_id,session_id,id), unique(session_id,starts_at,ends_at),
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at),
  check (extract(second from starts_at at time zone 'Europe/Paris') = 0 and extract(second from ends_at at time zone 'Europe/Paris') = 0
    and extract(minute from starts_at at time zone 'Europe/Paris')::integer % 15 = 0 and extract(minute from ends_at at time zone 'Europe/Paris')::integer % 15 = 0)
);
alter table public.sessions add constraint sessions_confirmed_slot foreign key(group_id,id,confirmed_slot_id) references public.session_slots(group_id,session_id,id) deferrable initially deferred;
create table public.session_ballots (
  id uuid primary key default gen_random_uuid(), group_id uuid not null, session_id uuid not null, membership_id uuid not null,
  revision integer not null default 1 check (revision > 0), submitted_at timestamptz not null default now(),
  constraint ballots_parent foreign key(group_id,session_id) references public.sessions(group_id,id) on delete cascade,
  foreign key(group_id,membership_id) references public.memberships(group_id,id),
  unique(session_id,membership_id), unique(group_id,session_id,id)
);
create table public.session_votes (
  group_id uuid not null, session_id uuid not null, ballot_id uuid not null, slot_id uuid not null,
  primary key(ballot_id,slot_id),
  constraint votes_ballot foreign key(group_id,session_id,ballot_id) references public.session_ballots(group_id,session_id,id) on delete cascade,
  foreign key(group_id,session_id,slot_id) references public.session_slots(group_id,session_id,id)
);
create table public.session_rsvps (
  group_id uuid not null, session_id uuid not null, membership_id uuid not null,
  response text not null check (response in ('attending','declined')),
  membership_epoch integer not null check (membership_epoch > 0), revision integer not null default 1 check (revision > 0), updated_at timestamptz not null default now(),
  primary key(session_id,membership_id),
  constraint rsvps_parent foreign key(group_id,session_id) references public.sessions(group_id,id) on delete cascade,
  foreign key(group_id,membership_id) references public.memberships(group_id,id)
);
create index sessions_state on public.sessions(status,vote_deadline);
create index session_slots_dates on public.session_slots(starts_at,ends_at);
create index ballots_member on public.session_ballots(membership_id);
create index votes_slot on public.session_votes(slot_id);
create index rsvps_member on public.session_rsvps(membership_id);
create table private.notification_outbox (
  id uuid primary key default gen_random_uuid(), event_key text not null unique, type text not null, resource_id uuid not null,
  payload jsonb not null default '{}', available_at timestamptz not null default now(), expires_at timestamptz not null default (now()+interval '7 days'),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','skipped')),
  lease_until timestamptz, lease_token uuid, attempts integer not null default 0 check (attempts >= 0)
);
revoke all on private.notification_outbox from public,anon,authenticated;
grant all on private.notification_outbox to service_role;

create function private.can_read_session(target_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sessions s join public.memberships m on m.group_id = s.group_id
    where s.id = target_id and m.user_id = auth.uid() and m.status = 'active' and (s.status <> 'draft' or s.created_by = m.id or m.role = 'admin'));
$$;
revoke all on function private.can_read_session(uuid) from public;
grant execute on function private.can_read_session(uuid) to authenticated;
alter table public.sessions enable row level security;
alter table public.session_slots enable row level security;
alter table public.session_ballots enable row level security;
alter table public.session_votes enable row level security;
alter table public.session_rsvps enable row level security;
revoke all on public.sessions,public.session_slots,public.session_ballots,public.session_votes,public.session_rsvps from anon,authenticated;
grant select on public.sessions,public.session_slots,public.session_ballots,public.session_votes,public.session_rsvps to authenticated;
grant all on public.sessions,public.session_slots,public.session_ballots,public.session_votes,public.session_rsvps to service_role;
create policy sessions_read on public.sessions for select to authenticated using (private.can_read_session(id));
create policy slots_read on public.session_slots for select to authenticated using (private.can_read_session(session_id));
create policy ballots_read on public.session_ballots for select to authenticated using (private.can_read_session(session_id));
create policy votes_read on public.session_votes for select to authenticated using (private.can_read_session(session_id));
create policy rsvps_read on public.session_rsvps for select to authenticated using (private.can_read_session(session_id));

create function private.immutable_session_slots() returns trigger language plpgsql set search_path = '' as $$
declare parent uuid; phase text;
begin
  parent := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  select status into phase from public.sessions where id = parent;
  if phase is not null and phase <> 'draft' then raise exception 'Les créneaux publiés sont immuables.'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.immutable_session_slots() from public;
create trigger immutable_session_slots before insert or update or delete on public.session_slots for each row execute function private.immutable_session_slots();

create function private.session_event(target public.sessions, event_type text) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into private.audit_events(actor_id,action,resource_id) values(auth.uid(),event_type,target.id);
  insert into private.notification_outbox(event_key,type,resource_id,payload)
    values(target.id::text || ':' || event_type,event_type,target.id,jsonb_build_object('group_id',target.group_id,'actor_user_id',auth.uid())) on conflict(event_key) do nothing;
end;
$$;
create function private.advance_session(target public.sessions, emit_close boolean default true) returns public.sessions language plpgsql security definer set search_path = '' as $$
declare phase text := target.status;
begin
  if phase = 'voting' and target.vote_deadline <= clock_timestamp() then phase := 'closed'; end if;
  if phase = 'closed' and not exists(select 1 from public.session_slots where session_id = target.id and starts_at > clock_timestamp()) then phase := 'expired'; end if;
  if phase = 'confirmed' and exists(select 1 from public.session_slots where id = target.confirmed_slot_id and ends_at <= clock_timestamp()) then phase := 'completed'; end if;
  if phase <> target.status then
    update public.sessions set status = phase, revision = revision + 1 where id = target.id returning * into target;
    if phase = 'closed' and emit_close then perform private.session_event(target,'session.vote_closed');
    else insert into private.audit_events(actor_id,action,resource_id) values(auth.uid(),'session.' || phase,target.id); end if;
  end if;
  return target;
end;
$$;
revoke all on function private.session_event(public.sessions,text), private.advance_session(public.sessions,boolean) from public;

create function public.create_session(session_title text, session_description text, selected_game uuid, player_threshold integer, candidate_slots jsonb, deadline timestamptz, request_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.memberships; gid uuid; result uuid; candidate jsonb; first_start timestamptz;
begin
  select id into gid from public.groups for update;
  select * into actor from public.memberships where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  select id into result from public.sessions where idempotency_key = request_id and created_by = actor.id;
  if found then return result; end if;
  if candidate_slots is null or jsonb_typeof(candidate_slots) <> 'array' or jsonb_array_length(candidate_slots) > 6 then raise exception 'De zéro à six créneaux en brouillon.'; end if;
  if selected_game is not null and not exists(select 1 from public.games where id = selected_game and group_id = gid and archived_at is null) then raise exception 'Jeu indisponible.'; end if;
  select min((value->>'starts_at')::timestamptz) into first_start from jsonb_array_elements(candidate_slots);
  insert into public.sessions(group_id,created_by,title,description,game_id,minimum_players,vote_deadline,idempotency_key)
    values(gid,actor.id,trim(session_title),trim(session_description),selected_game,player_threshold,coalesce(deadline,least(clock_timestamp()+interval '48 hours',first_start)),request_id) returning id into result;
  for candidate in select value from jsonb_array_elements(candidate_slots) loop
    if (candidate->>'starts_at')::timestamptz <= clock_timestamp() then raise exception 'Choisissez des créneaux futurs.'; end if;
    insert into public.session_slots(group_id,session_id,starts_at,ends_at) values(gid,result,(candidate->>'starts_at')::timestamptz,(candidate->>'ends_at')::timestamptz);
  end loop;
  return result;
end;
$$;

create function public.session_command(target_id uuid, command text, expected_revision integer, payload jsonb default '{}') returns void language plpgsql security definer set search_path = '' as $$
declare target public.sessions; actor public.memberships; chosen public.session_slots; candidate jsonb; first_start timestamptz;
  ballot public.session_ballots; answer public.session_rsvps; can_manage boolean; choice text;
begin
  perform id from public.groups for update;
  select * into target from public.sessions where id = target_id for update;
  if not found then raise exception 'Session indisponible.'; end if;
  select * into actor from public.memberships where user_id = auth.uid() and status = 'active' and group_id = target.group_id for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  can_manage := target.created_by = actor.id or actor.role = 'admin';
  if target.status = 'draft' and not can_manage then raise exception 'Brouillon privé.'; end if;
  if target.revision is distinct from expected_revision then raise exception 'Session modifiée. Rechargez la page.'; end if;
  -- Les révisions temporelles de cette commande ne constituent pas un conflit externe.
  target := private.advance_session(target,command <> 'confirm');
  if command = 'update' then
    if not can_manage or target.status <> 'draft' then raise exception 'Ce brouillon ne peut plus être modifié.'; end if;
    if payload->'slots' is null or jsonb_typeof(payload->'slots') <> 'array' or jsonb_array_length(payload->'slots') > 6 then raise exception 'Créneaux invalides.'; end if;
    if payload->>'game_id' is not null and not exists(select 1 from public.games where id = (payload->>'game_id')::uuid and group_id = target.group_id and archived_at is null) then raise exception 'Jeu indisponible.'; end if;
    select min((value->>'starts_at')::timestamptz) into first_start from jsonb_array_elements(payload->'slots');
    update public.sessions set title = trim(payload->>'title'), description = trim(payload->>'description'), game_id = (payload->>'game_id')::uuid,
      minimum_players = (payload->>'minimum_players')::integer, vote_deadline = coalesce((payload->>'vote_deadline')::timestamptz,least(clock_timestamp()+interval '48 hours',first_start)), revision = revision + 1 where id = target.id;
    delete from public.session_slots where session_id = target.id;
    for candidate in select value from jsonb_array_elements(payload->'slots') loop
      if (candidate->>'starts_at')::timestamptz <= clock_timestamp() then raise exception 'Choisissez des créneaux futurs.'; end if;
      insert into public.session_slots(group_id,session_id,starts_at,ends_at) values(target.group_id,target.id,(candidate->>'starts_at')::timestamptz,(candidate->>'ends_at')::timestamptz);
    end loop;
  elsif command = 'publish' then
    if not can_manage or target.status <> 'draft' then raise exception 'Publication impossible.'; end if;
    if (select count(*) from public.session_slots where session_id = target.id) not between 2 and 6
      or exists(select 1 from public.session_slots where session_id = target.id and starts_at <= clock_timestamp()) then raise exception 'Choisissez de deux à six créneaux futurs.'; end if;
    select min(starts_at) into first_start from public.session_slots where session_id = target.id;
    if target.vote_deadline is null or target.vote_deadline <= clock_timestamp() or target.vote_deadline > first_start then raise exception 'Échéance de vote invalide.'; end if;
    if target.game_id is not null and not exists(select 1 from public.games where id = target.game_id and archived_at is null) then raise exception 'Jeu archivé.'; end if;
    update public.sessions set status = 'voting', published_at = clock_timestamp(), revision = revision + 1 where id = target.id returning * into target;
    perform private.session_event(target,'session.published');
  elsif command = 'vote' then
    if target.status <> 'voting' or clock_timestamp() >= target.vote_deadline then raise exception 'Le vote est clos.'; end if;
    if payload->'choices' is null or jsonb_typeof(payload->'choices') <> 'array' or jsonb_array_length(payload->'choices') > 6
      or (select count(distinct value) from jsonb_array_elements_text(payload->'choices')) <> jsonb_array_length(payload->'choices') then raise exception 'Bulletin invalide.'; end if;
    select * into ballot from public.session_ballots where session_id = target.id and membership_id = actor.id for update;
    if ballot.revision is distinct from (payload->>'expected_ballot_revision')::integer then raise exception 'Bulletin modifié. Rechargez la page.'; end if;
    for choice in select value from jsonb_array_elements_text(payload->'choices') loop
      if not exists(select 1 from public.session_slots where id = choice::uuid and session_id = target.id) then raise exception 'Créneau étranger à cette proposition.'; end if;
    end loop;
    insert into public.session_ballots(group_id,session_id,membership_id) values(target.group_id,target.id,actor.id)
      on conflict(session_id,membership_id) do update set revision = session_ballots.revision + 1, submitted_at = clock_timestamp() returning * into ballot;
    delete from public.session_votes where ballot_id = ballot.id;
    for choice in select value from jsonb_array_elements_text(payload->'choices') loop
      insert into public.session_votes values(target.group_id,target.id,ballot.id,choice::uuid);
    end loop;
  elsif command = 'close' then
    if not can_manage or target.status <> 'voting' then raise exception 'Clôture impossible.'; end if;
    update public.sessions set status = 'closed', revision = revision + 1 where id = target.id returning * into target;
    perform private.session_event(target,'session.vote_closed');
  elsif command = 'confirm' then
    if not can_manage or target.status not in ('voting','closed') then raise exception 'Confirmation impossible.'; end if;
    select * into chosen from public.session_slots where id = (payload->>'slot_id')::uuid and session_id = target.id;
    if not found or chosen.starts_at <= clock_timestamp() then raise exception 'Ce créneau ne peut pas être confirmé.'; end if;
    update public.sessions set status = 'confirmed', confirmed_slot_id = chosen.id, revision = revision + 1 where id = target.id returning * into target;
    perform private.session_event(target,'session.confirmed');
  elsif command = 'cancel' then
    if not can_manage or target.status not in ('draft','voting','closed','confirmed') then raise exception 'Annulation impossible.'; end if;
    update public.sessions set status = 'cancelled', revision = revision + 1 where id = target.id returning * into target;
    if target.published_at is not null then perform private.session_event(target,'session.cancelled');
    else insert into private.audit_events(actor_id,action,resource_id) values(auth.uid(),'session.cancelled',target.id); end if;
  elsif command = 'rsvp' then
    if target.status <> 'confirmed' then raise exception 'La session n’est pas confirmée.'; end if;
    select * into chosen from public.session_slots where id = target.confirmed_slot_id;
    if chosen.starts_at <= clock_timestamp() then raise exception 'La session a déjà commencé.'; end if;
    if payload->>'response' is null or payload->>'response' not in ('attending','declined') then raise exception 'Réponse invalide.'; end if;
    select * into answer from public.session_rsvps where session_id = target.id and membership_id = actor.id for update;
    if answer.revision is distinct from (payload->>'expected_rsvp_revision')::integer then raise exception 'Réponse modifiée. Rechargez la page.'; end if;
    if payload->>'response' = 'attending' and exists(
      select 1 from public.session_rsvps r join public.sessions s on s.id = r.session_id join public.session_slots sl on sl.id = s.confirmed_slot_id
      where r.membership_id = actor.id and r.membership_epoch = actor.participation_epoch and r.response = 'attending'
        and s.status = 'confirmed' and s.id <> target.id and sl.starts_at < chosen.ends_at and sl.ends_at > chosen.starts_at
    ) then raise exception 'Vous participez déjà à une session sur ce créneau.'; end if;
    insert into public.session_rsvps(group_id,session_id,membership_id,response,membership_epoch)
      values(target.group_id,target.id,actor.id,payload->>'response',actor.participation_epoch)
      on conflict(session_id,membership_id) do update set response = excluded.response, membership_epoch = excluded.membership_epoch, revision = session_rsvps.revision + 1, updated_at = clock_timestamp();
  else raise exception 'Commande inconnue.';
  end if;
end;
$$;

create function public.session_clock() returns timestamptz language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_member() then raise exception 'Accès refusé.'; end if;
  return clock_timestamp();
end;
$$;
create function public.advance_sessions(batch_size integer default 100) returns integer language plpgsql security definer set search_path = '' as $$
declare target public.sessions; processed integer := 0;
begin
  perform id from public.groups for update;
  for target in select * from public.sessions where status in ('voting','closed','confirmed') order by id for update limit least(greatest(batch_size,1),200) loop
    perform private.advance_session(target); processed := processed + 1;
  end loop;
  return processed;
end;
$$;
create function public.read_confirmed_commitments(member_ids uuid[], period_start timestamptz, period_end timestamptz)
returns table(membership_id uuid,starts_at timestamptz,ends_at timestamptz) language sql stable security invoker set search_path = '' as $$
  select r.membership_id,sl.starts_at,sl.ends_at from public.session_rsvps r
    join public.sessions s on s.id = r.session_id join public.session_slots sl on sl.id = s.confirmed_slot_id
    join public.memberships m on m.id = r.membership_id
  where private.is_member() and r.membership_id = any(member_ids) and m.status = 'active' and r.membership_epoch = m.participation_epoch
    and r.response = 'attending' and s.status = 'confirmed' and sl.starts_at < period_end and sl.ends_at > period_start;
$$;
revoke all on function public.create_session(text,text,uuid,integer,jsonb,timestamptz,uuid),public.session_command(uuid,text,integer,jsonb),public.session_clock(),public.advance_sessions(integer),public.read_confirmed_commitments(uuid[],timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.create_session(text,text,uuid,integer,jsonb,timestamptz,uuid),public.session_command(uuid,text,integer,jsonb),public.session_clock(),public.read_confirmed_commitments(uuid[],timestamptz,timestamptz) to authenticated;
grant execute on function public.advance_sessions(integer) to service_role;
