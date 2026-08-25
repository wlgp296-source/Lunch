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

create table if not exists public.team_rooms (
  invite_code text primary key,
  room jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.team_rooms enable row level security;

drop policy if exists "Anyone can read team rooms by invite code" on public.team_rooms;
drop policy if exists "Anyone can create team rooms" on public.team_rooms;
drop policy if exists "Anyone can update team rooms" on public.team_rooms;

revoke all on public.team_rooms from anon, authenticated;

create or replace function public.get_team_room(p_invite_code text)
returns table (room jsonb, preferences jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select team_rooms.room, team_rooms.preferences
  from public.team_rooms
  where team_rooms.invite_code = upper(trim(p_invite_code))
  limit 1;
$$;

revoke all on function public.get_team_room(text) from public;
grant execute on function public.get_team_room(text) to anon, authenticated;

create or replace function public.upsert_team_room(
  p_invite_code text,
  p_room jsonb,
  p_preferences jsonb
)
returns table (room jsonb, preferences jsonb)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  normalized_code text := upper(trim(p_invite_code));
  stored_room jsonb;
  stored_preferences jsonb;
  stored_members jsonb;
  incoming_member jsonb;
  previous_member jsonb;
  member_index integer;
begin
  if normalized_code !~ '^LUNCH-[0-9]{4}$' then
    raise exception 'invalid invite code';
  end if;

  select team_rooms.room, team_rooms.preferences
    into stored_room, stored_preferences
    from public.team_rooms
    where team_rooms.invite_code = normalized_code;

  stored_room := coalesce(stored_room, '{}'::jsonb);
  stored_preferences := coalesce(stored_preferences, '{}'::jsonb);
  stored_members := '[]'::jsonb;

  -- 기존 목록과 새 목록을 합친 뒤, 같은 ID 또는 같은 닉네임은 한 명으로 정리합니다.
  for incoming_member in
    select value from jsonb_array_elements(
      coalesce(stored_room->'members', '[]'::jsonb) || coalesce(p_room->'members', '[]'::jsonb)
    )
  loop
    select ordinality - 1, value
      into member_index, previous_member
      from jsonb_array_elements(stored_members) with ordinality as members(value, ordinality)
      where (
        incoming_member->>'id' is not null
        and value->>'id' = incoming_member->>'id'
      ) or (
        incoming_member->>'name' is not null
        and value->>'name' = incoming_member->>'name'
      )
      limit 1;

    if member_index is null then
      stored_members := stored_members || jsonb_build_array(incoming_member);
    else
      stored_members := jsonb_set(
        stored_members,
        array[member_index::text],
        previous_member || incoming_member || jsonb_build_object(
          'preferences', coalesce(previous_member->'preferences', '{}'::jsonb) || coalesce(incoming_member->'preferences', '{}'::jsonb)
        ),
        true
      );
    end if;
  end loop;

  stored_room := (stored_room || coalesce(p_room, '{}'::jsonb))
    || jsonb_build_object('inviteCode', normalized_code, 'members', stored_members);
  stored_preferences := stored_preferences || coalesce(p_preferences, '{}'::jsonb);

  insert into public.team_rooms (invite_code, room, preferences, updated_at)
    values (normalized_code, stored_room, stored_preferences, now())
    on conflict (invite_code) do update set
      room = excluded.room,
      preferences = excluded.preferences,
      updated_at = now();

  return query select stored_room, stored_preferences;
end;
$$;

revoke all on function public.upsert_team_room(text, jsonb, jsonb) from public;
grant execute on function public.upsert_team_room(text, jsonb, jsonb) to anon, authenticated;
