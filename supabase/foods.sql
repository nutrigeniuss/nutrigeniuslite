-- NutriGenius Lite CALC — catálogo de alimentos (Supabase)
-- Pegar en SQL Editor del proyecto dedicado (después de schema.sql).

create extension if not exists pgcrypto;

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  -- null = catálogo maestro (visible para todos con acceso)
  -- uuid = alimento propio del nutricionista
  nutritionist_id uuid references auth.users (id) on delete cascade,
  submitted_by_nutritionist_id uuid references auth.users (id) on delete set null,
  reviewed_by_nutritionist_id uuid references auth.users (id) on delete set null,
  review_status text not null default 'approved'
    check (review_status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_at timestamptz,
  published_at timestamptz default now(),
  supersedes_food_id uuid,
  name text not null,
  category text,
  country text default 'PE',
  portion_grams numeric default 100,
  calories numeric default 0,
  protein numeric default 0,
  carbs numeric default 0,
  fat numeric default 0,
  notes text,
  nutrients jsonb,
  household_measures jsonb not null default '[]'::jsonb,
  alcohol numeric,
  ash numeric,
  caffeine numeric,
  calcium numeric,
  available_carbs numeric,
  alpha_carotene numeric,
  beta_carotene numeric,
  fiber numeric,
  sodium numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists foods_name_idx on public.foods (name);
create index if not exists foods_nutritionist_id_idx on public.foods (nutritionist_id);
create index if not exists foods_review_status_idx on public.foods (review_status);

alter table public.foods enable row level security;

-- Usuario con acceso activo (o admin)
create or replace function public.has_lite_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or p.access_mode = 'internal_admin'
        or (
          p.is_active = true
          and (p.access_expires_at is null or p.access_expires_at > now())
        )
      )
  );
$$;

drop policy if exists "foods_select_accessible" on public.foods;
create policy "foods_select_accessible"
  on public.foods for select
  using (
    public.has_lite_access()
    and (
      nutritionist_id is null
      or nutritionist_id = auth.uid()
      or public.is_lite_admin()
    )
  );

drop policy if exists "foods_insert_own_or_admin" on public.foods;
create policy "foods_insert_own_or_admin"
  on public.foods for insert
  with check (
    public.has_lite_access()
    and (
      (nutritionist_id = auth.uid())
      or (public.is_lite_admin() and nutritionist_id is null)
    )
  );

drop policy if exists "foods_update_own_or_admin" on public.foods;
create policy "foods_update_own_or_admin"
  on public.foods for update
  using (
    public.is_lite_admin()
    or (nutritionist_id = auth.uid() and public.has_lite_access())
  )
  with check (
    public.is_lite_admin()
    or (nutritionist_id = auth.uid() and public.has_lite_access())
  );

drop policy if exists "foods_delete_own_or_admin" on public.foods;
create policy "foods_delete_own_or_admin"
  on public.foods for delete
  using (
    public.is_lite_admin()
    or (nutritionist_id = auth.uid() and public.has_lite_access())
  );
