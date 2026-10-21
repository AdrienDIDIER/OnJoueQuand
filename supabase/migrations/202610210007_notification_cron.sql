-- Aucune URL ni aucun secret dans la migration ; désactivé en local et en preview.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
create function private.invoke_notification_job() returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text; secret text; request_id bigint;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name='ojq_jobs_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name='ojq_jobs_secret';
  if endpoint is null or secret is null or length(secret)<32 then return null;end if;
  if endpoint !~ '^https://[A-Za-z0-9.-]+/api/internal/jobs$' and endpoint<>'http://host.docker.internal:3100/api/internal/jobs' then raise exception 'URL de traitement invalide.';end if;
  select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;
  return request_id;
end;
$$;
revoke all on function private.invoke_notification_job() from public,anon,authenticated;
grant execute on function private.invoke_notification_job() to service_role;
select cron.schedule('ojq-notifications','*/5 * * * *','select private.invoke_notification_job()');
select cron.alter_job(job_id:=jobid,active:=false) from cron.job where jobname='ojq-notifications';
