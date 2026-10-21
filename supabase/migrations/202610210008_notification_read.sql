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
    select * into sub from public.push_subscriptions where id=(notification_command.payload->>'id')::uuid and membership_id=actor.id for update;
    if not found or sub.revision is distinct from expected_revision then raise exception 'Appareil modifié. Rechargez.'; end if;
    delete from public.push_subscriptions where id=sub.id; return sub.id;
  elsif command='read' then
    select * into note from public.notifications where id=(notification_command.payload->>'id')::uuid and membership_id=actor.id for update;
    if not found or note.revision is distinct from expected_revision then raise exception 'Notification modifiée. Rechargez.'; end if;
    update public.notifications set read_at=coalesce(read_at,clock_timestamp()),revision=revision+1 where id=note.id;return note.id;
  end if;
  raise exception 'Commande invalide.';
end;
$$;
