-- Incoming Telegram conversations, messages and files for the authenticated bot owner.
create table if not exists public.inbox_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bot_id uuid not null references public.bots(id) on delete cascade,
  telegram_chat_id text not null,
  telegram_user_id text not null,
  username text,
  display_name text not null default 'Пользователь Telegram',
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz not null default now(),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bot_id, telegram_chat_id)
);
create index if not exists inbox_conversations_owner_recent_idx on public.inbox_conversations(owner_id, last_message_at desc);
alter table public.inbox_conversations enable row level security;
revoke all on public.inbox_conversations from anon, authenticated;

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.inbox_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  kind text not null default 'text' check (kind in ('text', 'document', 'photo', 'location', 'system')),
  text text not null default '',
  telegram_file_id text,
  file_name text,
  mime_type text,
  telegram_message_id bigint,
  created_at timestamptz not null default now()
);
create index if not exists inbox_messages_owner_conversation_idx on public.inbox_messages(owner_id, conversation_id, created_at);
alter table public.inbox_messages enable row level security;
revoke all on public.inbox_messages from anon, authenticated;

-- Each user can save reusable workflow scripts and mini-processes.
create table if not exists public.workflow_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  workflow jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workflow_library_owner_updated_idx on public.workflow_library(owner_id, updated_at desc);
alter table public.workflow_library enable row level security;
revoke all on public.workflow_library from anon;
grant select, insert, update, delete on public.workflow_library to authenticated;
drop policy if exists "Users manage own workflow library" on public.workflow_library;
create policy "Users manage own workflow library" on public.workflow_library for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Short onboarding survey for product planning. Do not enter sensitive personal data.
create table if not exists public.onboarding_responses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  persona text not null default 'other',
  industry text not null default '',
  purpose text not null default '',
  planned_use text not null default '',
  will_develop boolean not null default false,
  desired_features text[] not null default '{}',
  notes text not null default '',
  skipped boolean not null default false,
  tour_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.onboarding_responses enable row level security;
revoke all on public.onboarding_responses from anon;
grant select, insert, update on public.onboarding_responses to authenticated;
drop policy if exists "Users manage own onboarding response" on public.onboarding_responses;
create policy "Users manage own onboarding response" on public.onboarding_responses for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.upsert_inbox_conversation(p_bot_id uuid, p_chat_id text, p_user_id text, p_username text, p_display_name text)
returns table(id uuid, owner_id uuid, bot_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  insert into public.inbox_conversations as c(owner_id, bot_id, telegram_chat_id, telegram_user_id, username, display_name, last_message_at)
  select b.owner_id, b.id, p_chat_id, p_user_id, p_username, coalesce(nullif(p_display_name, ''), 'Пользователь Telegram'), now()
  from public.bots b where b.id = p_bot_id
  on conflict on constraint inbox_conversations_bot_id_telegram_chat_id_key do update set telegram_user_id = excluded.telegram_user_id, username = excluded.username, display_name = excluded.display_name, last_message_at = now()
  returning c.id, c.owner_id, c.bot_id;
end;
$$;

create or replace function public.create_inbox_message(p_conversation_id uuid, p_direction text, p_kind text, p_text text, p_file_id text, p_file_name text, p_mime_type text, p_telegram_message_id bigint)
returns table(id uuid)
language plpgsql security definer set search_path = public as $$
declare v_owner_id uuid;
begin
  select c.owner_id into v_owner_id from public.inbox_conversations c where c.id = p_conversation_id;
  if v_owner_id is null then raise exception 'conversation not found'; end if;
  return query insert into public.inbox_messages(owner_id, conversation_id, direction, kind, text, telegram_file_id, file_name, mime_type, telegram_message_id)
    values (v_owner_id, p_conversation_id, p_direction, p_kind, coalesce(p_text, ''), p_file_id, p_file_name, p_mime_type, p_telegram_message_id)
    returning inbox_messages.id;
end;
$$;

create or replace function public.list_inbox_conversations(p_limit integer default 100)
returns table(id uuid, bot_id uuid, username text, bot_name text, telegram_chat_id text, telegram_user_id text, customer_username text, display_name text, status text, last_message_at timestamptz, last_text text, last_kind text, unread_count bigint)
language sql security definer set search_path = public as $$
  select c.id, c.bot_id, b.username, b.bot_name, c.telegram_chat_id, c.telegram_user_id, c.username, c.display_name, c.status, c.last_message_at,
    coalesce((select m.text from public.inbox_messages m where m.conversation_id = c.id order by m.created_at desc limit 1), ''),
    coalesce((select m.kind from public.inbox_messages m where m.conversation_id = c.id order by m.created_at desc limit 1), 'text'),
    (select count(*) from public.inbox_messages m where m.conversation_id = c.id and m.direction = 'inbound' and m.created_at > coalesce(c.last_read_at, '-infinity'::timestamptz))
  from public.inbox_conversations c join public.bots b on b.id = c.bot_id
  where c.owner_id = auth.uid() and auth.uid() is not null
  order by c.last_message_at desc limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

create or replace function public.list_inbox_messages(p_conversation_id uuid)
returns table(id uuid, direction text, kind text, text text, file_name text, mime_type text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  update public.inbox_conversations c set last_read_at = now() where c.id = p_conversation_id and c.owner_id = auth.uid() and auth.uid() is not null;
  return query select m.id, m.direction, m.kind, m.text, m.file_name, m.mime_type, m.created_at
    from public.inbox_messages m join public.inbox_conversations c on c.id = m.conversation_id
    where c.id = p_conversation_id and c.owner_id = auth.uid() and auth.uid() is not null
    order by m.created_at asc limit 500;
end;
$$;

create or replace function public.get_inbox_file(p_message_id uuid)
returns table(telegram_file_id text, file_name text, mime_type text, bot_id uuid)
language sql security definer set search_path = public as $$
  select m.telegram_file_id, m.file_name, m.mime_type, c.bot_id
  from public.inbox_messages m join public.inbox_conversations c on c.id = m.conversation_id
  where m.id = p_message_id and c.owner_id = auth.uid() and auth.uid() is not null and m.direction = 'inbound' and m.telegram_file_id is not null;
$$;

create or replace function public.send_inbox_reply(p_owner_id uuid, p_conversation_id uuid, p_text text)
returns table(id uuid, bot_id uuid, telegram_chat_id text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare inserted public.inbox_messages;
begin
  if p_owner_id is null then raise exception 'owner is required'; end if;
  insert into public.inbox_messages(owner_id, conversation_id, direction, kind, text)
  select c.owner_id, c.id, 'outbound', 'text', p_text from public.inbox_conversations c where c.id = p_conversation_id and c.owner_id = p_owner_id and c.status = 'open'
  returning * into inserted;
  if inserted.id is not null then update public.inbox_conversations set last_message_at = inserted.created_at where id = inserted.conversation_id; end if;
  return query select inserted.id, c.bot_id, c.telegram_chat_id, inserted.created_at from public.inbox_conversations c where c.id = inserted.conversation_id;
end;
$$;

create or replace function public.delete_inbox_message(p_message_id uuid, p_owner_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.inbox_messages m using public.inbox_conversations c
  where m.id = p_message_id and c.id = m.conversation_id and c.owner_id = p_owner_id;
$$;

revoke all on function public.upsert_inbox_conversation(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_inbox_message(uuid, text, text, text, text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.list_inbox_conversations(integer) from public, anon;
revoke all on function public.list_inbox_messages(uuid) from public, anon;
revoke all on function public.get_inbox_file(uuid) from public, anon;
revoke all on function public.send_inbox_reply(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.delete_inbox_message(uuid, uuid) from public, anon, authenticated;
grant execute on function public.upsert_inbox_conversation(uuid, text, text, text, text) to service_role;
grant execute on function public.create_inbox_message(uuid, text, text, text, text, text, text, bigint) to service_role;
grant execute on function public.list_inbox_conversations(integer) to authenticated;
grant execute on function public.list_inbox_messages(uuid) to authenticated;
grant execute on function public.get_inbox_file(uuid) to authenticated;
grant execute on function public.send_inbox_reply(uuid, uuid, text) to service_role;
grant execute on function public.delete_inbox_message(uuid, uuid) to service_role;
