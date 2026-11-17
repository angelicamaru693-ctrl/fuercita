-- Fuercita: tablas del gym. Van en el MISMO proyecto de Supabase que Repasito (misma cuenta).
-- Pégalo completo en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

create table if not exists public.gym_workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_key      text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz not null default now()
);

create table if not exists public.gym_sets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id    uuid not null references public.gym_workouts(id) on delete cascade,
  exercise_key  text not null,
  variant       text not null,
  set_no        integer not null,
  weight_kg     real not null default 0,
  reps          integer not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.gym_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on  date not null default current_date,
  weight_kg    real,
  waist_cm     real,
  hips_cm      real,
  notes        text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists gym_workouts_user_idx on public.gym_workouts (user_id, finished_at desc);
create index if not exists gym_sets_workout_idx on public.gym_sets (workout_id);
create index if not exists gym_sets_user_ex_idx on public.gym_sets (user_id, exercise_key, created_at);

-- Seguridad: cada usuaria solo ve y modifica sus propias filas.
alter table public.gym_workouts     enable row level security;
alter table public.gym_sets         enable row level security;
alter table public.gym_measurements enable row level security;

drop policy if exists "own gym_workouts" on public.gym_workouts;
create policy "own gym_workouts" on public.gym_workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own gym_sets" on public.gym_sets;
create policy "own gym_sets" on public.gym_sets
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own gym_measurements" on public.gym_measurements;
create policy "own gym_measurements" on public.gym_measurements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
