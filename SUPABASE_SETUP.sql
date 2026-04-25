-- ==================== SUPABASE SETUP SQL ====================
-- Copy and paste this into your Supabase SQL Editor
-- Go to: https://app.supabase.com → Your Project → SQL Editor

-- Create tasks table
create table tasks (
  id text primary key,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  cat text,
  pri text,
  dat timestamptz,
  done boolean default false,
  notes text,
  rec text,
  tm text,
  order_index int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index tasks_user_id_idx on tasks(user_id);
create index tasks_updated_at_idx on tasks(updated_at);

-- Enable RLS on tasks
alter table tasks enable row level security;

-- RLS Policies for tasks
create policy "Users can view own tasks"
  on tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert own tasks"
  on tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tasks"
  on tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete own tasks"
  on tasks for delete
  using (auth.uid() = user_id);

-- Create user_sync table for backups
create table user_sync (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  data jsonb,
  synced_at timestamptz default now()
);

-- Enable RLS on user_sync
alter table user_sync enable row level security;

-- RLS Policies for user_sync
create policy "Users can view own sync data"
  on user_sync for select
  using (auth.uid() = user_id);

create policy "Users can insert own sync data"
  on user_sync for insert
  with check (auth.uid() = user_id);

-- Done! You can now use the app with sync & auth
