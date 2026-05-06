
-- File library table
create table public.user_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  path text not null unique,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index user_files_user_id_created_at_idx
  on public.user_files (user_id, created_at desc);

alter table public.user_files enable row level security;

create policy "Users view own files"
  on public.user_files for select
  using (auth.uid() = user_id);

create policy "Users insert own files"
  on public.user_files for insert
  with check (auth.uid() = user_id);

create policy "Users delete own files"
  on public.user_files for delete
  using (auth.uid() = user_id);

-- Private storage bucket
insert into storage.buckets (id, name, public)
values ('user-files', 'user-files', false)
on conflict (id) do nothing;

-- Per-user folder access (path = "<uid>/<filename>")
create policy "Users read own folder"
  on storage.objects for select
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users upload own folder"
  on storage.objects for insert
  with check (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own folder"
  on storage.objects for delete
  using (bucket_id = 'user-files' and auth.uid()::text = (storage.foldername(name))[1]);
