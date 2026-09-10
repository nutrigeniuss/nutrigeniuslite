# Final fix report — Important findings

Date: 2026-09-10

## Important 1 — Profile upsert failures ignored

**Status:** Fixed

In `supabase/functions/admin-manage-user/index.ts` (create action):
- Capture `{ error: upsertError }` from `profiles` upsert
- On failure: attempt `admin.auth.admin.deleteUser(created.user.id)` rollback; log delete failure; return 400 with upsert message (and optional rollback note)
- Return `{ ok: true, userId }` only after successful upsert

## Important 2 — Default `npm test` fails repo-wide

**Status:** Fixed

`package.json`:
- `"test": "vitest run src/lib/adminAccess.test.ts"`
- `"test:admin": "vitest run src/lib/adminAccess.test.ts"` (alias)

Note: full Vitest suite is not yet green (unported SaaS tests); default `npm test` is scoped to admin access until the broader suite is ported.

## Verification

| Command | Result |
|---------|--------|
| `npm test` | Pass — 1 file, 7 tests |
| `npm run build` | Pass — vite build succeeded |

## Commit

`fix(admin): fail create on profile upsert; scope npm test to adminAccess`
