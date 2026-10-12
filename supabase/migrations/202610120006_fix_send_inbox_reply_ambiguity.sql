-- Qualify the conversation id column so it cannot conflict with the function's
-- table output parameter named id.
create or replace function public.send_inbox_reply(p_owner_id uuid, p_conversation_id uuid, p_text text)
returns table(id uuid, bot_id uuid, telegram_chat_id text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare inserted public.inbox_messages;
begin
  if p_owner_id is null then raise exception 'owner is required'; end if;
  insert into public.inbox_messages(owner_id, conversation_id, direction, kind, text)
  select c.owner_id, c.id, 'outbound', 'text', p_text from public.inbox_conversations c where c.id = p_conversation_id and c.owner_id = p_owner_id and c.status = 'open'
  returning * into inserted;
  if inserted.id is not null then
    update public.inbox_conversations as c set last_message_at = inserted.created_at where c.id = inserted.conversation_id;
  end if;
  return query select inserted.id, c.bot_id, c.telegram_chat_id, inserted.created_at from public.inbox_conversations c where c.id = inserted.conversation_id;
end;
$$;
