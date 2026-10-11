create or replace function public.consume_ai_request(p_limit integer default 20)
returns table(allowed boolean, requests integer, month date)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_month date := date_trunc('month', now())::date;
  current_count integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  insert into public.ai_usage(owner_id, month, requests)
  values (auth.uid(), current_month, 0)
  on conflict on constraint ai_usage_pkey do nothing;

  select usage.requests into current_count
  from public.ai_usage as usage
  where usage.owner_id = auth.uid() and usage.month = current_month
  for update;

  if current_count >= p_limit then
    return query select false, current_count, current_month;
  else
    update public.ai_usage as usage
    set requests = current_count + 1
    where usage.owner_id = auth.uid() and usage.month = current_month;
    return query select true, current_count + 1, current_month;
  end if;
end;
$$;

revoke all on function public.consume_ai_request(integer) from public, anon;
grant execute on function public.consume_ai_request(integer) to authenticated;

create or replace function public.refund_ai_request()
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage as usage
  set requests = greatest(usage.requests - 1, 0)
  where usage.owner_id = auth.uid()
    and usage.month = date_trunc('month', now())::date;
$$;
revoke all on function public.refund_ai_request() from public, anon;
grant execute on function public.refund_ai_request() to authenticated;
