create or replace function public.notification_command(command text, expected_revision integer, payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
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
    insert into public.notification_preferences(membership_id,push_enabled) values(actor.id,true) on conflict(membership_id) do update set push_enabled=true,revision=notification_preferences.revision+1;
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

create or replace function public.prepare_notification_delivery(delivery_id uuid,token uuid,reference_time timestamptz default clock_timestamp()) returns jsonb language plpgsql security definer set search_path='' as $$
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
  return jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),'notification_id',n.id,'expires_at',n.expires_at,'type',n.type,'attempts',d.attempts);
end;
$$;
