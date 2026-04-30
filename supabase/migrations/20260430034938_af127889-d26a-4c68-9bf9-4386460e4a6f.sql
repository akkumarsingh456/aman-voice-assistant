create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  text text not null,
  remind_at timestamptz not null,
  channel text not null default 'web' check (channel in ('web','telegram','sms')),
  telegram_chat_id bigint,
  delivered boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reminders_user on public.reminders(user_id);
create index idx_reminders_due on public.reminders(remind_at) where delivered = false;

alter table public.reminders enable row level security;

create policy "Users view own reminders" on public.reminders
  for select using (auth.uid() = user_id);
create policy "Users insert own reminders" on public.reminders
  for insert with check (auth.uid() = user_id);
create policy "Users update own reminders" on public.reminders
  for update using (auth.uid() = user_id);
create policy "Users delete own reminders" on public.reminders
  for delete using (auth.uid() = user_id);

create trigger reminders_updated_at
  before update on public.reminders
  for each row execute function public.set_updated_at();