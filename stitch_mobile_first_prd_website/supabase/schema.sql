create table if not exists public.meal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id text not null,
  meal_name text not null,
  category text,
  source text not null default 'solo',
  status text not null default 'planned' check (status in ('planned', 'eaten')),
  eaten_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, meal_id, eaten_date)
);

alter table public.meal_history enable row level security;

drop policy if exists "Users can read their own meal history" on public.meal_history;
create policy "Users can read their own meal history"
  on public.meal_history for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own meal history" on public.meal_history;
create policy "Users can insert their own meal history"
  on public.meal_history for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own meal history" on public.meal_history;
create policy "Users can update their own meal history"
  on public.meal_history for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists meal_history_user_date_idx
  on public.meal_history (user_id, eaten_date desc);
