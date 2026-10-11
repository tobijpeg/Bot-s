-- Resolve the output-column/column-name ambiguity in the inbox upsert RPC.
create or replace function public.upsert_inbox_conversation(p_bot_id uuid, p_chat_id text, p_user_id text, p_username text, p_display_name text)
returns table(id uuid, owner_id uuid, bot_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  insert into public.inbox_conversations as c(owner_id, bot_id, telegram_chat_id, telegram_user_id, username, display_name, last_message_at)
  select b.owner_id, b.id, p_chat_id, p_user_id, p_username, coalesce(nullif(p_display_name, ''), 'Пользователь Telegram'), now()
  from public.bots b where b.id = p_bot_id
  on conflict on constraint inbox_conversations_bot_id_telegram_chat_id_key
  do update set telegram_user_id = excluded.telegram_user_id, username = excluded.username,
    display_name = excluded.display_name, last_message_at = now()
  returning c.id, c.owner_id, c.bot_id;
end;
$$;
