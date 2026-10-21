-- La purge d'une proposition supprime aussi les choix associés à ses créneaux.
-- Le trigger conserve l'interdiction de modifier les créneaux publiés isolément.
alter table public.session_votes drop constraint session_votes_group_id_session_id_slot_id_fkey;
alter table public.session_votes add constraint session_votes_group_id_session_id_slot_id_fkey
  foreign key(group_id,session_id,slot_id) references public.session_slots(group_id,session_id,id) on delete cascade;
