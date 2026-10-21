create or replace function private.can_read_session(target_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.sessions s join public.memberships m on m.group_id = s.group_id
    where s.id = target_id and m.user_id = auth.uid() and m.status = 'active' and (s.published_at is not null or s.created_by = m.id or m.role = 'admin'));
$$;

create or replace function public.session_command(target_id uuid, command text, expected_revision integer, payload jsonb default '{}') returns void language plpgsql security definer set search_path = '' as $$
declare target public.sessions; actor public.memberships; chosen public.session_slots; candidate jsonb; first_start timestamptz;
  ballot public.session_ballots; answer public.session_rsvps; can_manage boolean; choice text;
begin
  perform id from public.groups for update;
  select * into target from public.sessions where id = target_id for update;
  if not found then raise exception 'Session indisponible.'; end if;
  select * into actor from public.memberships where user_id = auth.uid() and status = 'active' and group_id = target.group_id for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  can_manage := target.created_by = actor.id or actor.role = 'admin';
  if target.published_at is null and not can_manage then raise exception 'Brouillon privé.'; end if;
  if target.revision is distinct from expected_revision then raise exception 'Session modifiée. Rechargez la page.'; end if;
  -- Les révisions temporelles de cette commande ne constituent pas un conflit externe.
  target := private.advance_session(target,command not in ('confirm','cancel'));
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

create or replace function public.advance_sessions(batch_size integer default 100) returns integer language plpgsql security definer set search_path = '' as $$
declare target public.sessions; processed integer := 0;
begin
  perform id from public.groups for update;
  for target in select s.* from public.sessions s where (s.status = 'voting' and s.vote_deadline <= clock_timestamp()) or (s.status = 'closed' and not exists(select 1 from public.session_slots sl where sl.session_id = s.id and sl.starts_at > clock_timestamp())) or (s.status = 'confirmed' and exists(select 1 from public.session_slots sl where sl.id = s.confirmed_slot_id and sl.ends_at <= clock_timestamp())) order by s.id for update limit least(greatest(batch_size,1),200) loop
    perform private.advance_session(target); processed := processed + 1;
  end loop;
  return processed;
end;
$$;
