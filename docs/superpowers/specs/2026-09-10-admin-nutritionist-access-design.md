# Admin: acceso a nutricionistas (Lite Calc)

Fecha: 2026-09-10  
Estado: aprobado en conversación (opción C + duración B + alta con clave A + enfoque 1)

## Problema

El módulo Maestro (`/admin`) ya lista perfiles y puede dar/quitar acceso, pero:

- No permite **crear** cuentas de nutricionista desde la UI.
- El grant usa **45 días fijos**; no se elige duración ni “sin vencimiento”.
- No hay **cambiar clave** ni **eliminar** cuenta desde Maestro.
- La edge function `admin-manage-user` existe pero **no está cableada**.
- RLS `has_lite_access()` ignora `access_expires_at` (el cliente sí lo respeta).

## Objetivos

Desde `/admin`, un admin debe poder:

1. Crear nutricionista (nombre, email, contraseña temporal) con opción de dar acceso al crear.
2. Elegir duración al dar/renovar acceso: 30 / 45 / 90 días o sin vencimiento.
3. Quitar acceso.
4. Cambiar contraseña de un nutri.
5. Eliminar cuenta (no admin, no uno mismo).
6. Seguir enlazando a la base maestra de alimentos.

Fuera de alcance: invitaciones por email, billing automático, roles distintos de user/admin.

## Arquitectura

```
AdminAccessPage (/admin)
  ├─ Formulario crear ──► supabase.functions.invoke('admin-manage-user', { action: 'create', ... })
  ├─ Lista profiles     ◄── supabase.from('profiles').select(...)
  ├─ Dar / Renovar      ──► supabase.from('profiles').update({ access_mode, is_active, access_expires_at })
  ├─ Quitar             ──► profiles update (lite_disabled)
  ├─ Cambiar clave      ──► admin-manage-user { action: 'set_password' }
  └─ Eliminar           ──► admin-manage-user { action: 'delete' }
```

Autorización: solo `role === 'admin'` o `access_mode === 'internal_admin'` (cliente + edge + RLS de update en profiles).

## UI (Maestro)

### Bloque crear

Campos:

- Nombre (opcional)
- Email (obligatorio)
- Contraseña temporal (mín. 6)
- Duración: chips `30` | `45` | `90` | `Sin vencimiento` (default 45)
- Checkbox “Dar acceso al crear” (default ON)

Éxito: limpia formulario, recarga lista, toast/mensaje OK.

### Lista

Por fila (no admin):

- Nombre, email
- Estado: activo / pendiente / sin acceso / vencido (+ fecha de vencimiento si aplica)
- Acciones: Dar acceso | Renovar | Quitar | Cambiar clave | Eliminar

“Dar acceso” y “Renovar” abren el mismo selector de duración (inline o diálogo corto).  
Filas admin: badge “Acceso permanente”, sin acciones destructivas.  
No se puede cambiar clave / eliminar / quitar acceso de la cuenta propia admin.

Estilo: tokens `ng-*` existentes (Fitia Lite).

## Modelo de datos

Tabla existente `public.profiles`:

| Campo | Significado en este flujo |
|-------|---------------------------|
| `role` | `user` (nutri) / `admin` |
| `access_mode` | grant → `manual_preview`; revoke → `lite_disabled`; alta sin grant → `billing_managed` |
| `is_active` | `true` con acceso; `false` sin acceso |
| `access_expires_at` | ISO timestamptz; `null` = sin vencimiento |

Cliente: `resolveLiteAccess` ya trata vencido como `disabled`. Mantener ese comportamiento.

## Edge function `admin-manage-user`

Extender body de `create`:

```ts
accessDays?: 30 | 45 | 90 | null  // null = sin vencimiento; omitido con grant → default 45
grantAccess?: boolean
```

Al grant en create:

- `access_mode: 'manual_preview'`
- `is_active: true`
- `access_expires_at`: now + N días, o `null` si sin vencimiento

`set_password` y `delete` se mantienen; UI los invoca con JWT del admin.

## Grant / renew / revoke (cliente)

Helpers compartidos (p. ej. en `access.ts` o módulo admin):

```ts
expiresAtFromDays(days: 30 | 45 | 90 | null): string | null
```

Update grant/renew:

```ts
{
  access_mode: 'manual_preview',
  is_active: true,
  access_expires_at: expiresAtFromDays(days),
  updated_at: now
}
```

Revoke:

```ts
{
  access_mode: 'lite_disabled',
  is_active: false,
  access_expires_at: null,
  updated_at: now
}
```

## RLS / SQL

Actualizar `public.has_lite_access()` en `supabase/foods.sql` (y cualquier copia en schema si aplica) para exigir:

```sql
p.is_active = true
and (p.access_expires_at is null or p.access_expires_at > now())
```

además de admin / `internal_admin`. Así el vencimiento también corta acceso a datos (foods, etc.), no solo la UI.

## Errores

- Email duplicado / clave corta / sin sesión / no admin → mensaje visible en Maestro.
- Confirmación obligatoria antes de eliminar.
- Edge function no desplegada → mensaje que indique deploy pendiente.

## Verificación

- Admin crea nutri con acceso 30 días → aparece activo; login funciona.
- Crear sin “dar acceso” → pendiente/disabled hasta grant.
- Renovar 90 / sin vencimiento → `access_expires_at` correcto.
- Quitar → no entra a `/app` (AwaitingAccess).
- Cambiar clave → login con la nueva.
- Eliminar → desaparece de lista; no puede entrar.
- Usuario vencido: UI + RLS sin acceso.
- Admin no puede borrarse ni resetearse a sí mismo por este flujo.

## Archivos principales

- `src/pages/AdminAccessPage.tsx` — UI principal
- `src/lib/access.ts` — helper de vencimiento (si aplica)
- `supabase/functions/admin-manage-user/index.ts` — `accessDays`
- `supabase/foods.sql` — `has_lite_access()`
- Estilos: `src/index.css` (`ng-*`)
