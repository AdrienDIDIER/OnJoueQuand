create table private.push_test_attempts (
  membership_id uuid primary key references public.memberships(id) on delete cascade,
  attempted_at timestamptz not null
);
revoke all on private.push_test_attempts from public,anon,authenticated;

create function public.reserve_push_test(target_endpoint text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor public.memberships; device public.push_subscriptions; previous timestamptz;
begin
  select * into actor from public.memberships where user_id=auth.uid() and status='active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  select * into device from public.push_subscriptions where membership_id=actor.id and endpoint=target_endpoint;
  if not found then return jsonb_build_object('error','device'); end if;
  if not exists(select 1 from public.notification_preferences where membership_id=actor.id and push_enabled)
    then return jsonb_build_object('error','disabled'); end if;
  select attempted_at into previous from private.push_test_attempts where membership_id=actor.id;
  if previous > clock_timestamp()-interval '60 seconds' then return jsonb_build_object('error','limited'); end if;
  insert into private.push_test_attempts values(actor.id,clock_timestamp())
    on conflict(membership_id) do update set attempted_at=excluded.attempted_at;
  return jsonb_build_object('id',device.id,'revision',device.revision,'endpoint',device.endpoint,
    'keys',jsonb_build_object('p256dh',device.p256dh,'auth',device.auth));
end;
$$;
revoke all on function public.reserve_push_test(text) from public,anon,authenticated;
grant execute on function public.reserve_push_test(text) to authenticated;
