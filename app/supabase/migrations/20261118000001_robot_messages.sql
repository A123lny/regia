-- 20261118000001_robot_messages.sql
-- RN-robot: cronologia conversazioni. Persiste i messaggi full-text.
--
-- Scope: 1 riga per ogni messaggio user e 1 per ogni assistant turn.
-- NON salviamo tool_use/tool_result intermedi (solo text visibile all'utente).
-- IDOR: lettura solo da service_role, filtro per conversation + user match applicativo.
-- Retention: TTL pianificato 30 giorni via cron (non ancora attivo, da aggiungere).

create table if not exists public.robot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.robot_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists robot_messages_conv_idx
  on public.robot_messages (conversation_id, created_at);

alter table public.robot_messages enable row level security;
revoke all on table public.robot_messages from anon, authenticated;
grant insert, select on public.robot_messages to service_role;

comment on table public.robot_messages is
  'RN-robot: messaggi conversazione robottino (cronologia). TTL 30gg via cron.';
