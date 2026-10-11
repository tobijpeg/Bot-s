-- A Telegram bot token must belong to one platform account only.
do $$
begin
  if exists (select 1 from public.bots group by telegram_id having count(*) > 1) then
    raise exception 'Duplicate Telegram bot records exist across platform accounts. Resolve ownership before applying this migration.';
  end if;
end;
$$;

alter table public.bots drop constraint if exists bots_owner_id_telegram_id_key;
create unique index if not exists bots_telegram_id_uidx on public.bots(telegram_id);

create or replace function public.create_or_update_bot(p_owner_id uuid, p_telegram_id text, p_username text, p_bot_name text, p_encrypted_token jsonb)
returns public.bots
language plpgsql
security definer
set search_path = public
as $$
declare saved_bot public.bots;
begin
  if p_owner_id is null then raise exception 'owner is required'; end if;
  insert into public.bots(owner_id, telegram_id, username, bot_name, status)
    values (p_owner_id, p_telegram_id, p_username, p_bot_name, 'Подключён')
    on conflict (telegram_id) do update set username = excluded.username, bot_name = excluded.bot_name, updated_at = now()
      where public.bots.owner_id = excluded.owner_id
    returning * into saved_bot;
  if saved_bot.id is null then raise exception 'BOT_OWNED_BY_ANOTHER_ACCOUNT'; end if;
  insert into public.bot_secrets(bot_id, encrypted_token) values (saved_bot.id, p_encrypted_token)
    on conflict (bot_id) do update set encrypted_token = excluded.encrypted_token, updated_at = now();
  return saved_bot;
end;
$$;
revoke all on function public.create_or_update_bot(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_or_update_bot(uuid, text, text, text, jsonb) to service_role;
