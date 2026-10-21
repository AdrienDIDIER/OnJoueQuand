-- Lecture agrégée seulement ; aucune URL, identité, clé ou payload n'est exposé.
create or replace function public.notification_job_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Accès refusé.'; end if;
  return jsonb_build_object(
    'checked_at', now(),
    'cron_active', coalesce((select bool_or(active) from cron.job where jobname='ojq-notifications'),false),
    'last_run', (select jsonb_build_object('started_at',started_at,'finished_at',finished_at,'status',status) from private.job_runs order by started_at desc limit 1),
    'last_success_at', (select max(finished_at) from private.job_runs where status='completed'),
    'worker_age_seconds', extract(epoch from (now()-(select max(finished_at) from private.job_runs where status='completed'))),
    'outbox_age_seconds', coalesce((select max(extract(epoch from (now()-available_at))) from private.notification_outbox where status in ('pending','processing') and available_at<=now()),0),
    'outbox_pending', (select count(*) from private.notification_outbox where status in ('pending','processing')),
    'outbox_failed', (select count(*) from private.notification_outbox where status='failed'),
    'deliveries_pending', (select count(*) from private.notification_deliveries where status in ('pending','sending')),
    'deliveries_failed', (select count(*) from private.notification_deliveries where status='failed')
  );
end;
$$;
revoke all on function public.notification_job_status() from public,anon,authenticated;
grant execute on function public.notification_job_status() to authenticated;
