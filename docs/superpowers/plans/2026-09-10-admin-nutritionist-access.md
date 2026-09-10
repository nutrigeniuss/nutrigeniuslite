# Admin Nutritionist Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From Maestro (`/admin`), create nutritionists with temp passwords, grant/renew access with chosen duration (30/45/90/none), revoke, reset password, and delete accounts.

**Architecture:** Keep domain rules in pure modules (`adminAccess`), talk to Auth Admin API only through a thin client (`adminManageUserClient`), and keep `AdminAccessPage` as a composition root of small presentational components. Edge function gains `accessDays`; RLS `has_lite_access()` respects expiry.

**Tech Stack:** React 19, TypeScript, Supabase JS (`profiles` + `functions.invoke`), Deno edge function `admin-manage-user`, Vitest for pure logic, existing `ng-*` UI tokens.

## Global Constraints

- SOLID (mandatory):
  - **S** — one reason to change per module (domain vs API client vs UI piece).
  - **O** — add duration options / actions without rewriting page orchestration.
  - **L** — admin/user rows share the same list contract; admin simply disables forbidden actions.
  - **I** — UI depends on narrow functions (`createNutritionist`, `grantAccess`, …), not raw Supabase shapes.
  - **D** — page depends on abstractions in `src/lib/*`, not on Deno edge internals.
- Spec: `docs/superpowers/specs/2026-09-10-admin-nutritionist-access-design.md`
- Durations: `30 | 45 | 90 | null` (`null` = sin vencimiento); default grant duration `45`
- Grant patch: `access_mode: 'manual_preview'`, `is_active: true`, `access_expires_at` from days
- Revoke patch: `access_mode: 'lite_disabled'`, `is_active: false`, `access_expires_at: null`
- Never allow self password-reset / self-delete / delete of admin rows
- UI copy in Spanish; styles via `ng-*` (no new design system)
- YAGNI: no email invites, no billing, no new roles
- TDD for pure domain helpers; frequent small commits

---

## File map (SOLID decomposition)

| File | Responsibility |
|------|----------------|
| `src/lib/adminAccess.ts` | Pure domain: days → expiry, grant/revoke patches, admin detection, row display status |
| `src/lib/adminAccess.test.ts` | Unit tests for domain helpers |
| `src/lib/adminManageUserClient.ts` | Single place that invokes `admin-manage-user` (create / set_password / delete) |
| `src/components/admin/AccessDurationPicker.tsx` | Duration chips only |
| `src/components/admin/CreateNutritionistForm.tsx` | Create form UI + calls client |
| `src/components/admin/UserAccessCard.tsx` | One profile row + actions |
| `src/pages/AdminAccessPage.tsx` | Load list, wire handlers, compose sections |
| `supabase/functions/admin-manage-user/index.ts` | Accept `accessDays` on create |
| `supabase/foods.sql` | `has_lite_access()` honors expiry |
| `package.json` / `vite.config.ts` | Ensure `vitest` runnable for domain tests |

Do **not** dump all logic into `AdminAccessPage.tsx`.

---

### Task 1: Domain helpers (`adminAccess`) — TDD

**Files:**
- Create: `src/lib/adminAccess.ts`
- Create: `src/lib/adminAccess.test.ts`
- Modify: `package.json` (add `vitest` devDependency + `"test": "vitest run"` if missing)
- Modify: `vite.config.ts` (add `test: { environment: 'node', include: ['src/**/*.test.ts'] }` if missing)

**Interfaces:**
- Consumes: nothing (pure)
- Produces:
  - `export type AccessDays = 30 | 45 | 90 | null`
  - `export const ACCESS_DAY_OPTIONS: { value: AccessDays; label: string }[]`
  - `export function expiresAtFromDays(days: AccessDays, now?: Date): string | null`
  - `export function buildGrantProfilePatch(days: AccessDays, now?: Date): { access_mode: 'manual_preview'; is_active: true; access_expires_at: string | null; updated_at: string }`
  - `export function buildRevokeProfilePatch(now?: Date): { access_mode: 'lite_disabled'; is_active: false; access_expires_at: null; updated_at: string }`
  - `export function isAdminProfile(row: { role?: string | null; access_mode?: string | null }): boolean`
  - `export type AdminRowStatus = 'admin' | 'active' | 'pending' | 'disabled' | 'expired'`
  - `export function resolveAdminRowStatus(row: { role?: string | null; access_mode?: string | null; is_active?: boolean | null; access_expires_at?: string | null }, now?: Date): AdminRowStatus`

- [ ] **Step 1: Ensure Vitest can run**

If `vitest` is not in `package.json` devDependencies, add it and a script:

```json
"scripts": {
  "test": "vitest run"
}
```

In `vite.config.ts`:

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

Run: `npm install -D vitest`

- [ ] **Step 2: Write failing tests**

Create `src/lib/adminAccess.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildGrantProfilePatch,
  buildRevokeProfilePatch,
  expiresAtFromDays,
  isAdminProfile,
  resolveAdminRowStatus,
} from './adminAccess';

const FIXED = new Date('2026-09-10T12:00:00.000Z');

describe('expiresAtFromDays', () => {
  it('returns null for unlimited', () => {
    expect(expiresAtFromDays(null, FIXED)).toBeNull();
  });

  it('adds exact days for 30/45/90', () => {
    expect(expiresAtFromDays(30, FIXED)).toBe('2026-10-10T12:00:00.000Z');
    expect(expiresAtFromDays(45, FIXED)).toBe('2026-10-25T12:00:00.000Z');
    expect(expiresAtFromDays(90, FIXED)).toBe('2026-12-09T12:00:00.000Z');
  });
});

describe('buildGrantProfilePatch / buildRevokeProfilePatch', () => {
  it('grant sets manual_preview + active + expiry', () => {
    expect(buildGrantProfilePatch(45, FIXED)).toEqual({
      access_mode: 'manual_preview',
      is_active: true,
      access_expires_at: '2026-10-25T12:00:00.000Z',
      updated_at: FIXED.toISOString(),
    });
  });

  it('revoke clears access', () => {
    expect(buildRevokeProfilePatch(FIXED)).toEqual({
      access_mode: 'lite_disabled',
      is_active: false,
      access_expires_at: null,
      updated_at: FIXED.toISOString(),
    });
  });
});

describe('isAdminProfile / resolveAdminRowStatus', () => {
  it('detects admin by role or internal_admin', () => {
    expect(isAdminProfile({ role: 'admin', access_mode: 'billing_managed' })).toBe(true);
    expect(isAdminProfile({ role: 'user', access_mode: 'internal_admin' })).toBe(true);
    expect(isAdminProfile({ role: 'user', access_mode: 'manual_preview' })).toBe(false);
  });

  it('marks expired when is_active but past expiry', () => {
    expect(
      resolveAdminRowStatus(
        {
          role: 'user',
          access_mode: 'manual_preview',
          is_active: true,
          access_expires_at: '2026-09-01T00:00:00.000Z',
        },
        FIXED,
      ),
    ).toBe('expired');
  });

  it('marks active when unlimited', () => {
    expect(
      resolveAdminRowStatus(
        {
          role: 'user',
          access_mode: 'manual_preview',
          is_active: true,
          access_expires_at: null,
        },
        FIXED,
      ),
    ).toBe('active');
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npm test -- src/lib/adminAccess.test.ts`  
Expected: FAIL (module not found / exports missing)

- [ ] **Step 4: Implement `src/lib/adminAccess.ts`**

```ts
export type AccessDays = 30 | 45 | 90 | null;

export const ACCESS_DAY_OPTIONS: { value: AccessDays; label: string }[] = [
  { value: 30, label: '30 días' },
  { value: 45, label: '45 días' },
  { value: 90, label: '90 días' },
  { value: null, label: 'Sin vencimiento' },
];

export function expiresAtFromDays(days: AccessDays, now: Date = new Date()): string | null {
  if (days === null) return null;
  const ms = now.getTime() + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export function buildGrantProfilePatch(days: AccessDays, now: Date = new Date()) {
  return {
    access_mode: 'manual_preview' as const,
    is_active: true as const,
    access_expires_at: expiresAtFromDays(days, now),
    updated_at: now.toISOString(),
  };
}

export function buildRevokeProfilePatch(now: Date = new Date()) {
  return {
    access_mode: 'lite_disabled' as const,
    is_active: false as const,
    access_expires_at: null,
    updated_at: now.toISOString(),
  };
}

export function isAdminProfile(row: { role?: string | null; access_mode?: string | null }): boolean {
  return row.role === 'admin' || row.access_mode === 'internal_admin';
}

export type AdminRowStatus = 'admin' | 'active' | 'pending' | 'disabled' | 'expired';

export function resolveAdminRowStatus(
  row: {
    role?: string | null;
    access_mode?: string | null;
    is_active?: boolean | null;
    access_expires_at?: string | null;
  },
  now: Date = new Date(),
): AdminRowStatus {
  if (isAdminProfile(row)) return 'admin';

  const expired =
    typeof row.access_expires_at === 'string' &&
    !Number.isNaN(Date.parse(row.access_expires_at)) &&
    Date.parse(row.access_expires_at) < now.getTime();

  if (expired) return 'expired';
  if (row.access_mode === 'lite_disabled' || row.is_active === false) return 'disabled';
  if (row.is_active === true || row.access_mode === 'manual_preview') return 'active';
  return 'pending';
}
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm test -- src/lib/adminAccess.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/adminAccess.ts src/lib/adminAccess.test.ts
git commit -m "feat(admin): add access domain helpers with tests"
```

---

### Task 2: Edge function `accessDays` + RLS expiry

**Files:**
- Modify: `supabase/functions/admin-manage-user/index.ts`
- Modify: `supabase/foods.sql` (`has_lite_access`)

**Interfaces:**
- Consumes: same admin auth gate as today
- Produces: `create` accepts `accessDays?: 30 | 45 | 90 | null`; when `grantAccess`, sets expiry via same day math as client (default 45 if `accessDays` omitted)

- [ ] **Step 1: Update create branch in edge function**

In `Body` type add:

```ts
accessDays?: 30 | 45 | 90 | null
```

Replace the grant expiry block with:

```ts
const grant = Boolean(body.grantAccess)
const accessDays = body.accessDays === undefined ? 45 : body.accessDays
const accessExpiresAt = (() => {
  if (!grant) return null
  if (accessDays === null) return null
  if (accessDays !== 30 && accessDays !== 45 && accessDays !== 90) {
    return new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString()
  }
  return new Date(Date.now() + 1000 * 60 * 60 * 24 * accessDays).toISOString()
})()

await admin.from('profiles').upsert({
  id: created.user.id,
  email,
  full_name: fullName,
  role: 'user',
  access_mode: grant ? 'manual_preview' : 'billing_managed',
  is_active: grant,
  access_expires_at: accessExpiresAt,
})
```

If `grant` is true and `accessDays` is an invalid number (not 30/45/90/null/undefined), return `400` with `{ error: 'accessDays inválido' }` before create.

- [ ] **Step 2: Fix `has_lite_access` in `supabase/foods.sql`**

Replace function body with:

```sql
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
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/admin-manage-user/index.ts supabase/foods.sql
git commit -m "feat(admin): support accessDays and enforce expiry in RLS"
```

Note for implementer: after merge, deploy with  
`npx supabase functions deploy admin-manage-user`  
and run the SQL replace against the Lite project.

---

### Task 3: `adminManageUserClient` (DIP)

**Files:**
- Create: `src/lib/adminManageUserClient.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase`, `AccessDays` from `@/lib/adminAccess`
- Produces:
  - `createNutritionist(input: { email: string; password: string; fullName?: string; grantAccess: boolean; accessDays: AccessDays }): Promise<{ userId: string }>`
  - `setNutritionistPassword(userId: string, password: string): Promise<void>`
  - `deleteNutritionist(userId: string): Promise<void>`

- [ ] **Step 1: Implement client**

```ts
import { supabase } from '@/lib/supabase';
import type { AccessDays } from '@/lib/adminAccess';

type FnErrorBody = { error?: string };

async function invokeAdminManageUser<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.functions.invoke('admin-manage-user', { body });
  if (error) {
    const msg = error.message || 'No se pudo contactar admin-manage-user (¿deploy pendiente?)';
    throw new Error(msg);
  }
  const payload = data as FnErrorBody & T;
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(String(payload.error));
  }
  return payload as T;
}

export async function createNutritionist(input: {
  email: string;
  password: string;
  fullName?: string;
  grantAccess: boolean;
  accessDays: AccessDays;
}): Promise<{ userId: string }> {
  const result = await invokeAdminManageUser<{ ok?: boolean; userId?: string }>({
    action: 'create',
    email: input.email,
    password: input.password,
    fullName: input.fullName ?? '',
    grantAccess: input.grantAccess,
    accessDays: input.accessDays,
  });
  if (!result.userId) throw new Error('Respuesta inválida al crear usuario');
  return { userId: result.userId };
}

export async function setNutritionistPassword(userId: string, password: string): Promise<void> {
  await invokeAdminManageUser({ action: 'set_password', userId, password });
}

export async function deleteNutritionist(userId: string): Promise<void> {
  await invokeAdminManageUser({ action: 'delete', userId });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/adminManageUserClient.ts
git commit -m "feat(admin): add admin-manage-user client wrapper"
```

---

### Task 4: Presentational components (ISP / SRP)

**Files:**
- Create: `src/components/admin/AccessDurationPicker.tsx`
- Create: `src/components/admin/CreateNutritionistForm.tsx`
- Create: `src/components/admin/UserAccessCard.tsx`

**Interfaces:**
- Consumes: `ACCESS_DAY_OPTIONS`, `AccessDays`, `AdminRowStatus`, `resolveAdminRowStatus`, `isAdminProfile` from domain; create/set/delete from client; grant/revoke patches from domain
- Produces: controlled UI components used only by `AdminAccessPage`

- [ ] **Step 1: `AccessDurationPicker.tsx`**

```tsx
import { ACCESS_DAY_OPTIONS, type AccessDays } from '@/lib/adminAccess';

type Props = {
  value: AccessDays;
  onChange: (value: AccessDays) => void;
  disabled?: boolean;
};

export default function AccessDurationPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACCESS_DAY_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={active ? 'ng-pill ng-pill-active' : 'ng-pill ng-pill-idle'}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `CreateNutritionistForm.tsx`**

Form state local. On submit call `createNutritionist`. Props:

```ts
type Props = {
  busy: boolean;
  onSubmit: (input: {
    fullName: string;
    email: string;
    password: string;
    grantAccess: boolean;
    accessDays: AccessDays;
  }) => Promise<void>;
};
```

Fields: nombre, email, password (min 6), `AccessDurationPicker`, checkbox “Dar acceso al crear” (default true). Disable submit while `busy`. Use `ng-input`, `ng-btn-primary`, `ng-card ng-inset`.

- [ ] **Step 3: `UserAccessCard.tsx`**

Props:

```ts
type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  access_mode: string | null;
  is_active: boolean | null;
  access_expires_at: string | null;
};

type Props = {
  row: ProfileRow;
  selfId?: string;
  busy: boolean;
  durationDraft: AccessDays;
  onDurationDraftChange: (days: AccessDays) => void;
  onGrant: () => void;
  onRevoke: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
};
```

Show status label from `resolveAdminRowStatus`:
- `admin` → “Acceso permanente”
- `active` → “con acceso” + expiry text if date present
- `expired` → “vencido”
- `disabled` → “sin acceso”
- `pending` → “pendiente”

Actions for non-admin / non-self: duration picker + “Dar / Renovar acceso”, “Quitar acceso”, “Cambiar clave”, “Eliminar”. Hide destructive actions for admin rows and for `selfId === row.id`.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AccessDurationPicker.tsx src/components/admin/CreateNutritionistForm.tsx src/components/admin/UserAccessCard.tsx
git commit -m "feat(admin): add Maestro presentational components"
```

---

### Task 5: Wire `AdminAccessPage` (composition root)

**Files:**
- Modify: `src/pages/AdminAccessPage.tsx` (replace grant/revoke-only UI with composition)

**Interfaces:**
- Consumes: all Task 1–4 exports + `supabase` profile list/update
- Produces: full Maestro UX matching the approved spec

- [ ] **Step 1: Rewrite page orchestration**

Keep route/guard behavior (`if (!admin) …`). Structure:

1. Header + link to `/admin/alimentos` + Actualizar
2. Error banner
3. `<CreateNutritionistForm />`
4. Mapped `<UserAccessCard />` list

Handlers (page owns state only):

```ts
const grant = async (id: string, days: AccessDays) => {
  if (!supabase) return;
  setBusyId(id);
  const { error } = await supabase.from('profiles').update(buildGrantProfilePatch(days)).eq('id', id);
  // set error / reload / clear busy
};

const revoke = async (id: string) => { /* buildRevokeProfilePatch */ };

const create = async (input) => {
  await createNutritionist(input);
  await load();
};

const resetPassword = async (id: string) => {
  const password = window.prompt('Nueva contraseña temporal (mín. 6)');
  if (!password) return;
  if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
  await setNutritionistPassword(id, password);
};

const remove = async (id: string) => {
  if (!window.confirm('¿Eliminar esta cuenta? No se puede deshacer.')) return;
  await deleteNutritionist(id);
  await load();
};
```

Per-row duration draft: `Record<string, AccessDays>` defaulting to `45`, or one shared draft — prefer **per-row** map keyed by id.

Empty state copy: “Aún no hay perfiles. Crea uno arriba o espera a que alguien se registre.”

- [ ] **Step 2: Manual smoke (local)**

Run: `npm run build`  
Expected: success.

If Supabase + function deployed: create user, grant 30d, revoke, reset password, delete.

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminAccessPage.tsx
git commit -m "feat(admin): wire Maestro create, grant duration, reset and delete"
```

---

### Task 6: Verification checklist

**Files:** none (manual + automated)

- [ ] **Step 1: Automated**

Run: `npm test -- src/lib/adminAccess.test.ts`  
Expected: PASS

Run: `npm run build`  
Expected: PASS

- [ ] **Step 2: Manual against Lite project (when credentials available)**

1. Deploy function + apply SQL `has_lite_access`
2. As admin: create nutri with grant 30 days → appears active
3. Create without grant → pending/disabled until grant
4. Renew 90 / sin vencimiento → `access_expires_at` correct in DB
5. Revoke → AwaitingAccess on login
6. Reset password → login with new password
7. Delete → gone from list
8. Expired `is_active` user → UI expired + foods RLS denied

- [ ] **Step 3: Final commit only if docs/notes changed**

If you added a short deploy note under the edge function header comment, commit:

```bash
git add supabase/functions/admin-manage-user/index.ts
git commit -m "docs(admin): note accessDays deploy after Maestro wiring"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Create with email + temp password | 3, 4, 5 |
| Duration 30/45/90/none on create + grant/renew | 1, 2, 4, 5 |
| Revoke | 1, 5 |
| Reset password | 3, 4, 5 |
| Delete (not self / not admin) | 2 (edge), 4, 5 |
| Link to master foods | 5 (keep existing link) |
| Edge `accessDays` | 2 |
| RLS expiry | 2 |
| SOLID file split | File map + Tasks 1–5 |

No placeholders left. Types `AccessDays` / patches / client signatures are consistent across tasks.
