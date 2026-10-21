create extension if not exists btree_gist with schema extensions;

create table public.availability_days (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null, membership_id uuid not null,
  local_date date not null,
  status text not null check (status in ('unanswered','unavailable','available')),
  mode text check (mode in ('quick','detailed')),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  foreign key(group_id,membership_id) references public.memberships(group_id,id),
  unique(membership_id,local_date), unique(group_id,membership_id,id),
  check ((status = 'available' and mode is not null) or (status <> 'available' and mode is null))
);
create table public.availability_intervals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null, membership_id uuid not null, day_id uuid not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  foreign key(group_id,membership_id,day_id) references public.availability_days(group_id,membership_id,id) on delete cascade,
  check (isfinite(starts_at) and isfinite(ends_at) and starts_at < ends_at),
  exclude using gist (membership_id with =, tstzrange(starts_at,ends_at,'[)') with &&)
);
create index availability_dates on public.availability_days(local_date,membership_id);
create index availability_intervals_day on public.availability_intervals(day_id);
alter table public.availability_days enable row level security;
alter table public.availability_intervals enable row level security;
revoke all on public.availability_days, public.availability_intervals from anon, authenticated;
grant select on public.availability_days, public.availability_intervals to authenticated;
grant all on public.availability_days, public.availability_intervals to service_role;
create policy members_read_days on public.availability_days for select to authenticated using ((select private.is_member()));
create policy members_read_intervals on public.availability_intervals for select to authenticated using ((select private.is_member()));

create function private.check_availability_interval() returns trigger language plpgsql set search_path = '' as $$
declare d date; a timestamp; b timestamp;
begin
  select local_date into d from public.availability_days where id = new.day_id and membership_id = new.membership_id and group_id = new.group_id;
  a := new.starts_at at time zone 'Europe/Paris'; b := new.ends_at at time zone 'Europe/Paris';
  if d is null or a::date <> d or b > (d + 1)::timestamp or b < d::timestamp
    or extract(second from a) <> 0 or extract(second from b) <> 0
    or extract(minute from a)::integer % 15 <> 0 or extract(minute from b)::integer % 15 <> 0 then
    raise exception 'Intervalle hors journée ou non aligné sur quinze minutes.';
  end if;
  return new;
end;
$$;
create trigger interval_bounds before insert or update on public.availability_intervals for each row execute function private.check_availability_interval();
create function private.check_availability_day() returns trigger language plpgsql set search_path = '' as $$
declare target uuid; s text; n integer;
begin
  if tg_table_name = 'availability_days' then target := coalesce(new.id,old.id);
  else target := coalesce(new.day_id,old.day_id); end if;
  select status into s from public.availability_days where id = target;
  if not found then return null; end if;
  select count(*) into n from public.availability_intervals where day_id = target;
  if (s = 'available' and n = 0) or (s <> 'available' and n <> 0) then raise exception 'État et intervalles incohérents.'; end if;
  return null;
end;
$$;
create constraint trigger day_consistency after insert or update on public.availability_days deferrable initially deferred for each row execute function private.check_availability_day();
create constraint trigger interval_consistency after insert or update or delete on public.availability_intervals deferrable initially deferred for each row execute function private.check_availability_day();
revoke all on function private.check_availability_interval(), private.check_availability_day() from public;

-- Aucune identité propriétaire n'est acceptée en entrée. Verrou groupe avant adhésion,
-- partagé avec la révocation ; adapté à un unique groupe de quinze personnes.
create function public.save_availability(changes jsonb, sources jsonb default '[]'::jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare member public.memberships; item jsonb; slot jsonb; current_revision integer; target_id uuid; d date;
  first_day date; gid uuid;
begin
  select id into gid from public.groups for update;
  select * into member from public.memberships where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  first_day := date_trunc('week',clock_timestamp() at time zone 'Europe/Paris')::date;
  if changes is null or jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) not between 1 and 7
    or sources is null or jsonb_typeof(sources) <> 'array' or jsonb_array_length(sources) > 7 then raise exception 'Modification invalide.'; end if;
  if (select count(distinct value->>'local_date') from jsonb_array_elements(changes)) <> jsonb_array_length(changes) then raise exception 'Journée répétée.'; end if;
  for item in select value from jsonb_array_elements(sources) loop
    d := (item->>'local_date')::date;
    if d is null or d < first_day - 84 or d > first_day + 27 or not (item ? 'expected_revision') then raise exception 'Source hors période.'; end if;
    select revision into current_revision from public.availability_days where membership_id = member.id and local_date = d;
    if current_revision is distinct from (item->>'expected_revision')::integer then raise exception 'La source a changé. Rechargez puis refaites l’aperçu.'; end if;
  end loop;
  for item in select value from jsonb_array_elements(changes) order by value->>'local_date' loop
    d := (item->>'local_date')::date;
    if d is null or d < first_day or d > first_day + 27 then raise exception 'Journée hors période modifiable.'; end if;
    if not (item ? 'expected_revision') or item->>'status' is null or item->'intervals' is null or jsonb_typeof(item->'intervals') <> 'array' or jsonb_array_length(item->'intervals') > 100 then raise exception 'Journée invalide.'; end if;
    select revision into current_revision from public.availability_days where membership_id = member.id and local_date = d;
    if current_revision is distinct from (item->>'expected_revision')::integer then raise exception 'Disponibilités modifiées. Rechargez puis refaites l’aperçu.'; end if;
    insert into public.availability_days(group_id,membership_id,local_date,status,mode)
      values(gid,member.id,d,item->>'status',item->>'mode')
      on conflict(membership_id,local_date) do update set status = excluded.status, mode = excluded.mode, revision = availability_days.revision + 1, updated_at = clock_timestamp()
      returning id into target_id;
    delete from public.availability_intervals where day_id = target_id;
    for slot in select value from jsonb_array_elements(item->'intervals') loop
      insert into public.availability_intervals(group_id,membership_id,day_id,starts_at,ends_at)
        values(gid,member.id,target_id,(slot->>'starts_at')::timestamptz,(slot->>'ends_at')::timestamptz);
    end loop;
  end loop;
end;
$$;
revoke all on function public.save_availability(jsonb,jsonb) from public, anon;
grant execute on function public.save_availability(jsonb,jsonb) to authenticated;
