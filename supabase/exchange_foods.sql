-- NutriGenius Lite CALC — alimentos de intercambio editables (Supabase)
-- Pegar en SQL Editor DESPUÉS de schema.sql y foods.sql.
-- Idempotente: se puede re-ejecutar.
--
-- Si la tabla no existe, la app degrada al catálogo estático en código.

create extension if not exists pgcrypto;

create table if not exists public.exchange_foods (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  name text not null,
  grams_raw numeric,
  grams_cooked numeric,
  measure text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exchange_foods_group_key_idx
  on public.exchange_foods (group_key);

create index if not exists exchange_foods_active_idx
  on public.exchange_foods (is_active);

alter table public.exchange_foods enable row level security;

-- Lectura: usuarios con acceso Lite activo (o admin)
drop policy if exists "exchange_foods_select_access" on public.exchange_foods;
create policy "exchange_foods_select_access"
  on public.exchange_foods for select
  using (
    public.has_lite_access()
    and is_active = true
  );

-- Escritura: solo módulo maestro
drop policy if exists "exchange_foods_insert_admin" on public.exchange_foods;
create policy "exchange_foods_insert_admin"
  on public.exchange_foods for insert
  with check (public.is_lite_admin());

drop policy if exists "exchange_foods_update_admin" on public.exchange_foods;
create policy "exchange_foods_update_admin"
  on public.exchange_foods for update
  using (public.is_lite_admin())
  with check (public.is_lite_admin());

drop policy if exists "exchange_foods_delete_admin" on public.exchange_foods;
create policy "exchange_foods_delete_admin"
  on public.exchange_foods for delete
  using (public.is_lite_admin());
