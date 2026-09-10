-- NutriGenius Lite (calculadora) — esquema mínimo
-- Pegar en SQL Editor del proyecto Supabase dedicado.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  access_mode text not null default 'billing_managed',
  access_expires_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, access_mode, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'user',
    'billing_managed',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lectura: cada usuario su perfil; admin ve todos.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.role = 'admin' or p.access_mode = 'internal_admin')
    )
  );

-- Update: solo admin (activar/desactivar).
create policy "profiles_update_admin"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.role = 'admin' or p.access_mode = 'internal_admin')
    )
  );

-- Tras el primer registro, promover admin manualmente:
-- update public.profiles
-- set role = 'admin', access_mode = 'internal_admin', is_active = true
-- where email = 'tu@correo.com';
