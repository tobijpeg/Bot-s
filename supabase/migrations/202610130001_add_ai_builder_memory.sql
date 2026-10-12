-- Keep each authenticated user's builder conversation and active clarifications
-- across reloads and devices. The browser only writes rows owned by auth.uid().
create table if not exists public.ai_builder_sessions (
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_key text not null check (session_key = 'new' or session_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (owner_id, session_key)
);

create index if not exists ai_builder_sessions_owner_updated_idx
  on public.ai_builder_sessions(owner_id, updated_at desc);

alter table public.ai_builder_sessions enable row level security;
revoke all on public.ai_builder_sessions from anon;
grant select, insert, update, delete on public.ai_builder_sessions to authenticated;
drop policy if exists "Users manage own AI builder sessions" on public.ai_builder_sessions;
create policy "Users manage own AI builder sessions"
  on public.ai_builder_sessions
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
