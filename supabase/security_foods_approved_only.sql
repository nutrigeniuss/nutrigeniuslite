-- Parche de seguridad: maestros solo si están aprobados.
-- Ejecutar en el SQL Editor de Supabase (Lite) si la política live aún
-- deja ver pending/rejected a nutricionistas normales.

drop policy if exists "foods_select_accessible" on public.foods;
create policy "foods_select_accessible"
  on public.foods for select
  using (
    public.has_lite_access()
    and (
      public.is_lite_admin()
      or nutritionist_id = auth.uid()
      or (
        nutritionist_id is null
        and coalesce(review_status, 'approved') = 'approved'
      )
    )
  );
