-- J2. Toutes les mutations passent par des commandes étroites.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  name text not null default 'OnJoueQuand' check (length(trim(name)) between 1 and 60),
  timezone text not null default 'Europe/Paris' check (timezone = 'Europe/Paris'),
  quick_start time not null default '20:00', quick_end time not null default '23:00',
  revision integer not null default 1 check (revision > 0),
  check (quick_start < quick_end and extract(second from quick_start) = 0 and extract(second from quick_end) = 0
    and extract(minute from quick_start)::integer % 15 = 0 and extract(minute from quick_end)::integer % 15 = 0)
);
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  revision integer not null default 1 check (revision > 0)
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id),
  user_id uuid not null unique references auth.users(id),
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'active' check (status in ('active','revoked')),
  joined_at timestamptz not null default now(), revoked_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  unique(group_id,id),
  check ((status = 'revoked') = (revoked_at is not null))
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id),
  normalized_email text not null check (normalized_email = lower(trim(normalized_email)) and length(normalized_email) <= 254 and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  invited_by uuid not null references auth.users(id), auth_user_id uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'), accepted_at timestamptz,
  provisioning_status text not null default 'pending' check (provisioning_status in ('pending','ready','failed')),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  idempotency_key uuid not null unique,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now()
);
create unique index invitations_pending_email on public.invitations(group_id,normalized_email) where status = 'pending';
create table private.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, resource_id uuid, created_at timestamptz not null default now()
);
create table private.rate_limit_counters (
  key_hash text not null, window_start timestamptz not null, count integer not null,
  primary key(key_hash,window_start)
);

create function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where user_id = (select auth.uid()) and status = 'active');
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where user_id = (select auth.uid()) and status = 'active' and role = 'admin');
$$;
revoke all on function private.is_member(), private.is_admin() from public;
grant execute on function private.is_member(), private.is_admin() to authenticated;

alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
revoke all on public.groups, public.profiles, public.memberships, public.invitations from anon, authenticated;
grant select on public.groups, public.profiles, public.memberships, public.invitations to authenticated;
grant all on public.groups, public.profiles, public.memberships, public.invitations to service_role;
create policy members_read_group on public.groups for select to authenticated using ((select private.is_member()));
create policy members_read_profiles on public.profiles for select to authenticated using ((select private.is_member()));
create policy members_read_memberships on public.memberships for select to authenticated using ((select private.is_member()));
create policy admins_read_invitations on public.invitations for select to authenticated using ((select private.is_admin()));

-- Le verrou groupe est le premier verrou de toutes les commandes d'identité.
create function private.lock_admin() returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  select id into gid from public.groups for update;
  if not private.is_admin() then raise exception 'Accès réservé aux administrateurs.'; end if;
  return gid;
end;
$$;
revoke all on function private.lock_admin() from public;

create function public.create_invitation(email text, request_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid; result uuid; normalized text := lower(trim(email));
begin
  gid := private.lock_admin();
  select id into result from public.invitations where idempotency_key = request_id and invited_by = auth.uid() and normalized_email = normalized;
  if found then return result; end if;
  if exists(select 1 from public.memberships m join auth.users u on u.id = m.user_id where lower(u.email) = normalized and m.status = 'active') then
    raise exception 'Cette personne est déjà membre.';
  end if;
  update public.invitations set status = 'expired', revision = revision + 1 where status = 'pending' and expires_at <= clock_timestamp();
  select id into result from public.invitations where normalized_email = normalized and status = 'pending';
  if found then return result; end if;
  insert into public.invitations(group_id,normalized_email,invited_by,idempotency_key) values(gid,normalized,auth.uid(),request_id) returning id into result;
  insert into private.audit_events(actor_id,action,resource_id) values(auth.uid(),'invitation.created',result);
  return result;
end;
$$;

create function public.revoke_invitation(invitation_id uuid, expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_admin();
  update public.invitations set status = 'revoked', revision = revision + 1 where id = invitation_id and revision = expected_revision and status = 'pending';
  if not found then raise exception 'Invitation modifiée ou clôturée. Rechargez la page.'; end if;
  insert into private.audit_events(actor_id,action,resource_id) values(auth.uid(),'invitation.revoked',invitation_id);
end;
$$;

create function public.accept_invitation(display_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare gid uuid; inv public.invitations; account auth.users; result uuid;
begin
  if auth.uid() is null then raise exception 'Connectez-vous pour continuer.'; end if;
  select id into gid from public.groups for update;
  select * into account from auth.users where id = auth.uid();
  if account.email_confirmed_at is null then raise exception 'Adresse non vérifiée.'; end if;
  select id into result from public.memberships where user_id = auth.uid() and status = 'active';
  if found then return result; end if;
  select * into inv from public.invitations where normalized_email = lower(account.email) and status = 'pending' and expires_at > clock_timestamp() for update;
  if not found then raise exception 'Aucune invitation valide. Contactez un administrateur.'; end if;
  insert into public.profiles(user_id,display_name) values(auth.uid(),trim(display_name))
    on conflict(user_id) do update set display_name = excluded.display_name, revision = profiles.revision + 1;
  insert into public.memberships(group_id,user_id) values(gid,auth.uid())
    on conflict(user_id) do update set role = 'member', status = 'active', revoked_at = null, revision = memberships.revision + 1 returning id into result;
  update public.invitations set status = 'accepted', accepted_at = clock_timestamp(), auth_user_id = auth.uid(), revision = revision + 1 where id = inv.id;
  insert into private.audit_events(actor_id,action,resource_id) values(auth.uid(),'invitation.accepted',inv.id);
  return result;
end;
$$;

create function public.update_profile(display_name text, expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform id from public.groups for update;
  if not private.is_member() then raise exception 'Accès au groupe refusé.'; end if;
  update public.profiles set display_name = trim(update_profile.display_name), revision = revision + 1 where user_id = auth.uid() and revision = expected_revision;
  if not found then raise exception 'Profil modifié. Rechargez la page.'; end if;
end;
$$;

create function public.change_membership(membership_id uuid, new_role text, new_status text, expected_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare target public.memberships;
begin
  perform private.lock_admin();
  select * into target from public.memberships where id = membership_id for update;
  if not found or target.revision <> expected_revision then raise exception 'Membre modifié. Rechargez la page.'; end if;
  if new_role not in ('admin','member') or new_status not in ('active','revoked') then raise exception 'Modification invalide.'; end if;
  if target.status = 'revoked' then raise exception 'Une nouvelle invitation est nécessaire.'; end if;
  if target.role = 'admin' and (new_role <> 'admin' or new_status <> 'active') and
     (select count(*) from public.memberships where role = 'admin' and status = 'active') <= 1 then
    raise exception 'Le dernier administrateur doit rester actif.';
  end if;
  update public.memberships set role = new_role, status = new_status,
    revoked_at = case when new_status = 'revoked' then clock_timestamp() else null end,
    revision = revision + 1 where id = membership_id;
  insert into private.audit_events(actor_id,action,resource_id) values(auth.uid(),'membership.changed',membership_id);
end;
$$;

-- Backend uniquement : récupération après timeout Auth, sans liste publique de comptes.
create function public.provisioning_context(invitation_id uuid, actor_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare inv public.invitations; uid uuid;
begin
  perform id from public.groups for update;
  if not exists(select 1 from public.memberships where user_id = actor_id and role = 'admin' and status = 'active') then raise exception 'Accès refusé.'; end if;
  select * into inv from public.invitations where id = invitation_id and status = 'pending' and expires_at > clock_timestamp();
  if not found then raise exception 'Invitation indisponible.'; end if;
  select id into uid from auth.users where lower(email) = inv.normalized_email;
  return jsonb_build_object('email',inv.normalized_email,'user_id',uid);
end;
$$;
create function public.record_invitation_delivery(invitation_id uuid, actor_id uuid, delivered boolean) returns void language plpgsql security definer set search_path = '' as $$
declare context jsonb;
begin
  context := public.provisioning_context(invitation_id,actor_id);
  update public.invitations set auth_user_id = (context->>'user_id')::uuid,
    provisioning_status = case when context->>'user_id' is null then 'failed' else 'ready' end,
    delivery_status = case when delivered then 'sent' else 'failed' end, revision = revision + 1 where id = invitation_id;
end;
$$;
create function public.consume_auth_limit(key_hash text, max_attempts integer) returns boolean language plpgsql security definer set search_path = '' as $$
declare used integer; bucket timestamptz := date_bin(interval '10 minutes',clock_timestamp(),'2020-01-01'::timestamptz);
begin
  delete from private.rate_limit_counters where window_start < clock_timestamp() - interval '1 day';
  insert into private.rate_limit_counters values(key_hash,bucket,1)
    on conflict on constraint rate_limit_counters_pkey do update set count = rate_limit_counters.count + 1 returning count into used;
  return used <= max_attempts;
end;
$$;
create function public.bootstrap_admin(account_id uuid, display_name text) returns void language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  perform pg_advisory_xact_lock(20261019);
  if exists(select 1 from public.memberships) then raise exception 'Initialisation déjà effectuée.'; end if;
  insert into public.groups default values on conflict(singleton) do nothing;
  select id into gid from public.groups for update;
  insert into public.profiles values(account_id,trim(display_name),1);
  insert into public.memberships(group_id,user_id,role) values(gid,account_id,'admin');
  insert into private.audit_events(actor_id,action,resource_id) values(account_id,'group.bootstrapped',gid);
end;
$$;

revoke all on function public.create_invitation(text,uuid), public.revoke_invitation(uuid,integer), public.accept_invitation(text), public.update_profile(text,integer), public.change_membership(uuid,text,text,integer), public.provisioning_context(uuid,uuid), public.record_invitation_delivery(uuid,uuid,boolean), public.consume_auth_limit(text,integer), public.bootstrap_admin(uuid,text) from public, anon, authenticated;
grant execute on function public.create_invitation(text,uuid), public.revoke_invitation(uuid,integer), public.accept_invitation(text), public.update_profile(text,integer), public.change_membership(uuid,text,text,integer) to authenticated;
grant execute on function public.provisioning_context(uuid,uuid), public.record_invitation_delivery(uuid,uuid,boolean), public.consume_auth_limit(text,integer), public.bootstrap_admin(uuid,text) to service_role;
