-- Un rendez-vous directement confirmé, sans brouillon ni scrutin intermédiaire.
-- Les anciennes propositions et commandes restent compatibles.
create function public.create_evening(evening_title text, selected_game uuid, starts_at timestamptz, ends_at timestamptz, request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor public.memberships; target public.sessions; result uuid; chosen uuid;
begin
  perform id from public.groups for update;
  select * into actor from public.memberships where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Accès au groupe refusé.'; end if;
  select * into target from public.sessions where idempotency_key = request_id;
  if found then
    if target.created_by <> actor.id then raise exception 'Demande déjà utilisée.'; end if;
    return target.id;
  end if;
  if starts_at is null or ends_at is null or not isfinite(starts_at) or not isfinite(ends_at)
    or starts_at <= clock_timestamp() or ends_at <= starts_at or ends_at > starts_at + interval '25 hours'
    then raise exception 'Choisissez une soirée future de moins de vingt-cinq heures.'; end if;
  if request_id is null then raise exception 'Identifiant de demande manquant.'; end if;
  result := public.create_session(evening_title,'',selected_game,2,
    jsonb_build_array(jsonb_build_object('starts_at',starts_at,'ends_at',ends_at)),null,request_id);
  select id into chosen from public.session_slots where session_id = result;
  update public.sessions set status = 'confirmed', published_at = clock_timestamp(), vote_deadline = null,
    confirmed_slot_id = chosen, revision = revision + 1 where id = result returning * into target;
  perform private.session_event(target,'session.confirmed');
  -- L'organisateur répond lui aussi explicitement ; aucune participation implicite.
  return result;
end;
$$;
revoke all on function public.create_evening(text,uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.create_evening(text,uuid,timestamptz,timestamptz,uuid) to authenticated;
