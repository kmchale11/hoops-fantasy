-- Schedules the ingestion endpoint every 15 minutes using Supabase's pg_cron and pg_net.
-- The endpoint itself decides whether a run is due (15 minutes on game nights, 6 hours otherwise).
--
-- This is deliberately not a migration: it contains your deployed URL and secret.
-- Run it once in the Supabase SQL editor after deploying, replacing the two placeholders.
-- Enable the pg_cron and pg_net extensions first (Database → Extensions).

-- Store the secret in Vault rather than in the job definition.
select vault.create_secret('<your CRON_SECRET>', 'hoops_cron_secret');

select cron.schedule(
  'hoops-ingest',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-app>.vercel.app/api/cron/ingest',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'hoops_cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- To check it:   select * from cron.job_run_details order by start_time desc limit 10;
-- To remove it:  select cron.unschedule('hoops-ingest');
