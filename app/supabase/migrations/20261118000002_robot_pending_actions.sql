-- 20261118000002_robot_pending_actions.sql
-- RN-robot: pending actions store su DB (sostituisce in-memory).
-- Vercel serverless non mantiene memoria tra invocazioni: il Map in-memory si
-- perdeva al cold start tra POST /api/robot/chat e POST /api/robot/confirm.
--
-- TTL: 5 minuti (expires_at). Cleanup via cron o on-read (prune expired).

create table if not exists public.robot_pending_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.robot_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_name text not null,
  tool_input jsonb not null,
  tool_use_id text not null,
  page_context jsonb not null,
  needs_brand_selection boolean not null default false,
  allowed_brand_ids uuid[] null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists robot_pending_user_idx
  on public.robot_pending_actions (user_id, created_at desc);

alter table public.robot_pending_actions enable row level security;
revoke all on table public.robot_pending_actions from anon, authenticated;
grant insert, select, delete on public.robot_pending_actions to service_role;

comment on table public.robot_pending_actions is
  'RN-robot: pending confirm actions (TTL 5min). Sostituisce in-memory per Vercel serverless.';
