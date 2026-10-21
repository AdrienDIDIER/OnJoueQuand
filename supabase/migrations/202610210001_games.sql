create table public.games (
  id uuid primary key default gen_random_uuid(), group_id uuid not null references public.groups(id),
  created_by uuid not null, name text not null check (length(trim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 1000),
  archived_at timestamptz, revision integer not null default 1 check (revision > 0),
  idempotency_key uuid not null unique, created_at timestamptz not null default now(),
  unique(group_id,id), foreign key(group_id,created_by) references public.memberships(group_id,id)
);
create table public.game_favorites (
  group_id uuid not null, membership_id uuid not null, game_id uuid not null,
  primary key(membership_id,game_id),
  foreign key(group_id,membership_id) references public.memberships(group_id,id),
  foreign key(group_id,game_id) references public.games(group_id,id)
);
create index games_group on public.games(group_id,created_at);
create index game_favorites_game on public.game_favorites(game_id);
alter table public.games enable row level security;
alter table public.game_favorites enable row level security;
revoke all on public.games, public.game_favorites from anon, authenticated;
grant select on public.games, public.game_favorites to authenticated;
grant all on public.games, public.game_favorites to service_role;
create policy members_read_games on public.games for select to authenticated using ((select private.is_member()));
create policy members_read_favorites on public.game_favorites for select to authenticated using ((select private.is_member()));

create function public.create_game(game_name text, game_description text, request_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare member public.memberships; gid uuid; result uuid;
begin
  select id into gid from public.groups for update;
  select * into member from public.memberships where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  select id into result from public.games where idempotency_key = request_id and created_by = member.id;
  if found then return result; end if;
  insert into public.games(group_id,created_by,name,description,idempotency_key)
    values(gid,member.id,trim(game_name),trim(game_description),request_id) returning id into result;
  return result;
end;
$$;
create function public.update_game(target_id uuid, game_name text, game_description text, expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare member public.memberships; target public.games;
begin
  perform id from public.groups for update;
  select * into member from public.memberships where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  select * into target from public.games where id = target_id for update;
  if not found or target.group_id <> member.group_id or (target.created_by <> member.id and member.role <> 'admin') then raise exception 'Modification non autorisée.'; end if;
  if target.revision is distinct from expected_revision or target.archived_at is not null then raise exception 'Jeu modifié ou archivé. Rechargez la page.'; end if;
  update public.games set name = trim(game_name), description = trim(game_description), revision = revision + 1 where id = target_id;
end;
$$;
create function public.archive_game(target_id uuid, expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare member public.memberships; target public.games;
begin
  perform id from public.groups for update;
  select * into member from public.memberships where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  select * into target from public.games where id = target_id for update;
  if not found or target.group_id <> member.group_id or (target.created_by <> member.id and member.role <> 'admin') then raise exception 'Archivage non autorisé.'; end if;
  if target.revision is distinct from expected_revision or target.archived_at is not null then raise exception 'Jeu modifié ou archivé. Rechargez la page.'; end if;
  update public.games set archived_at = clock_timestamp(), revision = revision + 1 where id = target_id;
end;
$$;
create function public.set_game_favorite(target_id uuid, favorite boolean, expected_favorite boolean) returns void language plpgsql security definer set search_path = '' as $$
declare member public.memberships; target public.games; existing boolean;
begin
  perform id from public.groups for update;
  select * into member from public.memberships where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  select * into target from public.games where id = target_id for update;
  if not found or target.group_id <> member.group_id or favorite is null or expected_favorite is null then raise exception 'Jeu indisponible.'; end if;
  if target.archived_at is not null and favorite then raise exception 'Ce jeu est archivé.'; end if;
  select exists(select 1 from public.game_favorites where membership_id = member.id and game_id = target_id) into existing;
  if existing is distinct from expected_favorite then raise exception 'Favoris modifiés. Rechargez la page.'; end if;
  if favorite then insert into public.game_favorites values(member.group_id,member.id,target_id) on conflict do nothing;
  else delete from public.game_favorites where membership_id = member.id and game_id = target_id; end if;
end;
$$;
revoke all on function public.create_game(text,text,uuid), public.update_game(uuid,text,text,integer), public.archive_game(uuid,integer), public.set_game_favorite(uuid,boolean,boolean) from public, anon;
grant execute on function public.create_game(text,text,uuid), public.update_game(uuid,text,text,integer), public.archive_game(uuid,integer), public.set_game_favorite(uuid,boolean,boolean) to authenticated;
