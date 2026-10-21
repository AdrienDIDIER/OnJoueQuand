-- Horodatage fiable des points de départ de conservation ; reprise prudente de l'existant.
alter table public.sessions add column updated_at timestamptz not null default now();
alter table public.sessions add column terminal_at timestamptz;
update public.sessions s set terminal_at=case when s.status='completed' then coalesce((select ends_at from public.session_slots where id=s.confirmed_slot_id),now()) else now() end
where s.status in ('completed','cancelled','expired');
alter table public.invitations add column terminal_at timestamptz;
update public.invitations set terminal_at=coalesce(accepted_at,now()) where status in ('accepted','revoked','expired');

create function private.retention_timestamps() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_table_name='sessions' then
    new.updated_at:=clock_timestamp();
    if new.status in ('completed','cancelled','expired') then
      if tg_op='INSERT' or old.status is distinct from new.status then
        new.terminal_at:=case when new.status='completed' then coalesce((select ends_at from public.session_slots where id=new.confirmed_slot_id),clock_timestamp()) else clock_timestamp() end;
      else new.terminal_at:=old.terminal_at; end if;
    else new.terminal_at:=null; end if;
  else
    if new.status in ('accepted','revoked','expired') then
      if tg_op='INSERT' or old.status is distinct from new.status then
        new.terminal_at:=case when new.status='expired' then new.expires_at else clock_timestamp() end;
      else new.terminal_at:=old.terminal_at; end if;
    else new.terminal_at:=null; end if;
  end if;
  return new;
end;
$$;
revoke all on function private.retention_timestamps() from public,anon,authenticated;
create trigger session_retention_timestamps before insert or update on public.sessions for each row execute function private.retention_timestamps();
create trigger invitation_retention_timestamps before insert or update on public.invitations for each row execute function private.retention_timestamps();
create index sessions_retention on public.sessions(status,terminal_at,updated_at);
create index invitations_retention on public.invitations(status,terminal_at);
create index notifications_retention on public.notifications(created_at);
create index audit_retention on private.audit_events(created_at);

create function public.purge_retained_data(batch_size integer default 100,reference_time timestamptz default clock_timestamp()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cap integer:=least(greatest(coalesce(batch_size,100),1),500); count_rows integer; result jsonb:='{}';
  week_start date; cutoff timestamptz;
begin
  if reference_time is null or not isfinite(reference_time) then raise exception 'Date de traitement invalide.'; end if;
  -- Même ordre que les mutations de groupe ; les lots concurrents sont sérialisés.
  perform id from public.groups for update;
  week_start:=date_trunc('week',reference_time at time zone 'Europe/Paris')::date;
  -- Mois/jours civils à Paris, indépendants du fuseau de la connexion SQL.
  cutoff:=((reference_time at time zone 'Europe/Paris')-interval '12 months') at time zone 'Europe/Paris';

  delete from public.availability_days where id in
    (select id from public.availability_days where local_date<week_start-84 order by local_date,id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('availability_days',count_rows);
  delete from public.sessions where id in (select id from public.sessions where
    (status in ('completed','cancelled','expired') and terminal_at<cutoff) or (status='draft' and updated_at<cutoff)
    order by id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('sessions',count_rows);

  -- Ne jamais effacer silencieusement un travail vivant ; clôturer les baux expirés d'abord.
  update private.notification_outbox set status='skipped',lease_until=null,lease_token=null where id in
    (select id from private.notification_outbox where expires_at<=reference_time and
      (status='pending' or (status='processing' and coalesce(lease_until,'-infinity')<=reference_time)) order by id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('expired_events',count_rows);
  update private.job_runs set status='abandoned',finished_at=reference_time,error_code='lease_expired' where id in
    (select id from private.job_runs where status='running' and lease_until<=reference_time order by id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('abandoned_jobs',count_rows);
  delete from private.notification_deliveries where id in
    (select d.id from private.notification_deliveries d join public.notifications n on n.id=d.notification_id
      where n.expires_at<=reference_time and (d.status<>'sending' or coalesce(d.lease_until,'-infinity')<=reference_time)
      order by d.id limit cap for update of d skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('deliveries',count_rows);
  delete from public.notifications n where n.id in
    (select id from public.notifications where created_at<reference_time-interval '2160 hours' order by created_at,id limit cap for update skip locked)
    -- Toute livraison restante protège sa notification : un claim peut changer son bail sans verrou groupe.
    and not exists(select 1 from private.notification_deliveries d where d.notification_id=n.id);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('notifications',count_rows);
  delete from private.notification_outbox where id in
    (select id from private.notification_outbox where status in ('completed','failed','skipped') and available_at<reference_time-interval '2160 hours'
      order by available_at,id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('outbox',count_rows);
  delete from private.job_runs where id in
    (select id from private.job_runs where status<>'running' and finished_at<reference_time-interval '2160 hours' order by finished_at,id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('job_runs',count_rows);
  delete from private.audit_events where id in
    (select id from private.audit_events where created_at<reference_time-interval '2160 hours' order by created_at,id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('audit_events',count_rows);
  update public.invitations set status='expired',revision=revision+1 where id in
    (select id from public.invitations where status='pending' and expires_at<=reference_time order by expires_at,id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('expired_invitations',count_rows);
  delete from public.invitations where id in
    (select id from public.invitations where status in ('accepted','revoked','expired') and terminal_at<reference_time-interval '2160 hours' order by terminal_at,id limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('invitations',count_rows);
  delete from private.rate_limit_counters where (key_hash,window_start) in
    (select key_hash,window_start from private.rate_limit_counters where window_start<reference_time-interval '24 hours' order by window_start,key_hash limit cap for update skip locked);
  get diagnostics count_rows=row_count; result:=result||jsonb_build_object('rate_limits',count_rows);
  return result;
end;
$$;
revoke all on function public.purge_retained_data(integer,timestamptz) from public,anon,authenticated;
grant execute on function public.purge_retained_data(integer,timestamptz) to service_role;
