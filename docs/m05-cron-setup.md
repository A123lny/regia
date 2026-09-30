# Setup pg_cron per M05 Publishing

## Su Supabase Cloud (staging/prod)

1. Vai su Dashboard Supabase -> Database -> Extensions
2. Cerca `pg_cron` e `pg_net`. Attivali entrambi.
3. In SQL Editor esegui:

```sql
alter database postgres set app.settings.publisher_url = 'https://<your-next-host>/api/publisher/tick';
alter database postgres set app.settings.publisher_cron_secret = '<M05_CRON_SECRET>';
select cron.schedule(
  'm05-publisher-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.publisher_url'),
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || current_setting('app.settings.publisher_cron_secret'),
      'content-type', 'application/json'
    )
  )
  $$
);
```

4. Verifica: `select * from cron.job;` deve mostrare la riga `m05-publisher-tick`.
5. Verifica esecuzione: `select * from cron.job_run_details order by start_time desc limit 5;`

## In locale (dev)

pg_cron/pg_net non sono attivi. Usa il bottone "Processa coda ora" in `/impostazioni`
oppure chiama manualmente:

```bash
curl -X POST http://localhost:3000/api/publisher/tick \
  -H "Authorization: Bearer $M05_CRON_SECRET"
```

## Rollback

```sql
select cron.unschedule('m05-publisher-tick');
```
