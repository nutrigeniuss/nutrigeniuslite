-- NutriGenius Lite — endurecer has_lite_access + profiles update
-- Pegar en SQL Editor (idempotente).

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
          and coalesce(p.access_mode, '') <> 'lite_disabled'
          and (p.access_expires_at is null or p.access_expires_at > now())
        )
      )
  );
$$;

-- Admin puede gestionar accesos, pero no promover a admin / internal_admin por API.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_lite_admin())
  with check (
    public.is_lite_admin()
    and role = 'user'
    and coalesce(access_mode, '') <> 'internal_admin'
  );
