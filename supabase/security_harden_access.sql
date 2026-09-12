-- NutriGenius Lite — endurecer has_lite_access (alineado con resolveLiteAccess del cliente)
-- Pegar en SQL Editor si ya tenías foods.sql aplicado (idempotente).

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
