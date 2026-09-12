# Maestro food review + create food from diet

**Date:** 2026-09-12  
**Status:** Approved (product)  
**Repo:** NutriGenius Lite Calc

## Problem

1. In diet-by-foods (“Agregar a Desayuno”, etc.) there is no way to create a catalog food; nutritionists must leave the editor and open Alimentos.
2. Maestro can import/manage the master catalog but has no inbox to approve, reject, or correct foods submitted by nutritionists.

## Goals

- Create foods from the diet add modal using the **same** `FoodFormModal` as Alimentos (in-place, no navigation away).
- Maestro base-foods screen gains **Pendientes** and **Rechazados** with clear ownership rules.
- Keep session/ficha data local; catalog foods remain in Supabase `foods`.

## Non-goals

- USDA search/create changes.
- Clinical history / diet plan persistence in Supabase.
- Recipe review inbox.
- Navigating to `/MyFoods` as the create path from diet.

---

## Part A — Create food from diet

### UX

- In `FoodSearchModal` / `RecallFoodSearch` (Mis Alimentos tab): visible **Crear alimento** (mobile and desktop).
- Opens existing `FoodFormModal` layered above the add-meal search (same fields and save path as MyFoods).
- On save:
  - Persists via `saveFood(..., nutritionistId)` → `review_status: pending`, owned by the nutri.
  - Invalidates/refreshes food catalog cache so the new food appears in Mis Alimentos search.
  - Nutritionist can add it to the current meal without closing the diet flow (same session).

### Components

| Piece | Role |
|-------|------|
| `RecallFoodSearch.jsx` / `FoodSearchModal.jsx` / `DietCreator.jsx` | Host CTA + mount `FoodFormModal` |
| `FoodFormModal.jsx` | Unchanged form contract; reuse as-is |
| `foodCatalogCache` / MyFoods invalidate | Refresh after save |

---

## Part B — Maestro review inbox

### Screen

Extend `/admin/alimentos` (`FoodsCatalogPage`) with tabs:

1. **Catálogo** — current master list (`nutritionist_id IS NULL`) + import/delete.
2. **Pendientes** — foods with `review_status = pending` and `nutritionist_id` set (submissions / revisions).
3. **Rechazados** — foods with `review_status = rejected` still eligible for Maestro rescue (see retention).

### Decisions

| Action | Result |
|--------|--------|
| **Aprobar** (no edits) | Same row becomes master: `review_status = approved`, `nutritionist_id = null`. One food for everyone. |
| **Editar e incorporar** | Insert **new** master row with Maestro’s corrected data (`approved`, `nutritionist_id = null`). Original nutri row stays private: set `rejected` (or equivalent “not published as-is”) with `reviewed_at`. Nutri search can show **two** same-named foods (master + personal). Leaves Pendientes. |
| **Rechazar** (+ optional notes) | Not added to master. Nutri keeps private copy. Row appears under Rechazados. |
| No action | Remains `pending`. |
| From **Rechazados** → edit/improve → incorporate | Same as Editar e incorporar (new master + leave/update nutri private row). |

### Duplicate visibility (confirmed)

- **Approve as-is:** single shared food (no duplicate for that submission).
- **Edit & incorporate:** duplicate intentional — nutri keeps original measures; master holds corrected version so they can notice and optionally delete theirs.

### Rechazados retention (30 days)

- Purpose: stop accumulation in Maestro’s “candidate for master base” queue.
- After 30 days from rejection (`reviewed_at`): remove from Maestro **Rechazados** list only (filter/hide by age).
- **Do not delete** the nutri’s private food row; it remains visible in Mis Alimentos / search for that nutritionist.

Implementation note: prefer query filter `reviewed_at >= now() - 30 days` for the Rechazados tab (no destructive purge required for v1). Optional later: cron hard-delete only Maestro inbox metadata if added; not required if filtering suffices.

### APIs (existing + thin wrappers)

Reuse / extend `src/lib/catalogData.ts`:

- `listFoodsPaginated({ reviewStatus: 'pending' | 'rejected', ... })` for inbox lists.
- `updateFoodReview(id, { review_status, review_notes })` for approve-as-is and reject.
- New helper e.g. `incorporateEditedFood(sourceId, editedPayload)`:
  1. Insert master clone from edited payload (`nutritionist_id: null`, `approved`).
  2. Mark source `rejected` + `reviewed_at` + optional notes (“Incorporado con correcciones” / user notes).
- Ensure admin RLS already allows select/update on others’ foods (`is_lite_admin`).

### UI actions on a pending/rejected card

- Show name, macros summary, submitter id/email if available, household measures summary, status.
- Buttons: **Aprobar** | **Editar e incorporar** (opens `FoodFormModal` or admin edit) | **Rechazar**.
- Rejected tab: **Editar e incorporar** (and optionally view notes); no need for second reject.

---

## Data rules summary

```
pending + nutritionist_id set  → only nutri + admin (RLS)
approved + nutritionist_id null → all with lite access (master)
rejected + nutritionist_id set → nutri private + Maestro Rechazados (≤30d window)
```

Approve-as-is mutates ownership to master.  
Edit-and-incorporate never mutates nutri measures into master; it clones.

---

## Testing checklist

- [ ] Mobile diet modal: Crear alimento → save → appears in Mis Alimentos list → add to meal.
- [ ] Approve pending without edit → food only in Catálogo; nutri no longer “owns” that id.
- [ ] Edit & incorporate → master has corrected food; nutri still has original; nutri search shows both.
- [ ] Reject → not in Catálogo; in Rechazados; nutri still sees private food.
- [ ] Rechazados older than 30 days not listed for Maestro; nutri still has food.
- [ ] Rechazados → edit & incorporate → appears in Catálogo.

## Out of scope follow-ups

- Email/push when approved/rejected.
- Auto-merge duplicate names.
- Hard delete of rejected rows.
