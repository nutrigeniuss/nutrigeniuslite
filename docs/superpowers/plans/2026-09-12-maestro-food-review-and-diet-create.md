# Maestro food review + diet create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let nutris create foods from the diet add modal (`FoodFormModal` in-place), and give Maestro Pendientes/Rechazados with approve / reject / edit-and-incorporate.

**Architecture:** Reuse `FoodFormModal` + `saveFood` / `updateFoodReview`. Add `incorporateEditedFood` (insert master clone + reject source). Extend `FoodsCatalogPage` with three tabs. Wire “Crear alimento” in `RecallFoodSearch` (used by DietCreator + Dietética).

**Tech Stack:** React, Supabase `foods`, existing Lite catalog helpers.

## Global Constraints

- Same `FoodFormModal` as MyFoods (no navigation to `/MyFoods` for create-from-diet).
- Approve as-is → one shared row (`nutritionist_id = null`).
- Edit & incorporate → new master + original stays private (`rejected`); nutri may see two names.
- Reject → private + Maestro Rechazados; hide from Maestro inbox after 30 days via `reviewed_at` filter; do not delete nutri row.
- Remote push only to `nutrigeniuss/nutrigeniuslite` if user asks.

---

### Task 1: Catalog APIs for review queue

**Files:**
- Modify: `src/lib/catalogData.ts`
- Optional test: pure date helper if extracted

**Interfaces:**
- Produces:
  - `updateFoodReview` sets `reviewed_at` ISO when status changes
  - `listReviewQueueFoods({ status: 'pending' | 'rejected', page, pageSize, searchTerm? })`
  - `incorporateEditedFood(sourceId, editedPayload: CatalogFoodRecord)` → `{ master, source }`

- [ ] **Step 1:** Extend `updateFoodReview` to set `reviewed_at: new Date().toISOString()` on every review status update.

- [ ] **Step 2:** Add `listReviewQueueFoods`:
  - `review_status` eq status
  - `.not('nutritionist_id', 'is', null)`
  - if `rejected`: `.gte('reviewed_at', thirtyDaysAgoIso)`
  - order `reviewed_at`/`created_at` desc, paginate like `listFoodsPaginated`

- [ ] **Step 3:** Add `incorporateEditedFood(sourceId, editedPayload)`:
  1. `saveFood({ ...editedPayload, id omitted, review_status: 'approved' }, undefined, undefined)` → master
  2. `updateFoodReview(sourceId, { review_status: 'rejected', review_notes: 'Incorporado con correcciones' })`
  3. `clearFoodCatalogCache` caller-side after success

- [ ] **Step 4:** Smoke in browser/console or temporary admin UI later.

---

### Task 2: Crear alimento in diet search

**Files:**
- Modify: `src/components/ficha/dietetica/RecallFoodSearch.jsx`
- Uses: `FoodFormModal`, `useAuth`, `clearFoodCatalogCache` / `prefetchFoodCatalog`

- [ ] **Step 1:** On Mis Alimentos tab toolbar, add button **Crear alimento** (visible mobile+desktop).

- [ ] **Step 2:** State `showCreateFood`; render `FoodFormModal` with `nutritionistId={user?.id}`, `food={null}`.

- [ ] **Step 3:** `onSaved`: close form, `clearFoodCatalogCache()`, `prefetchFoodCatalog()` → `setFoods`, toast OK.

- [ ] **Step 4:** Verify from DietCreator “Agregar a Desayuno” on narrow viewport.

---

### Task 3: Maestro tabs UI

**Files:**
- Modify: `src/pages/FoodsCatalogPage.tsx`
- Optional extract: `src/components/admin/FoodReviewQueue.tsx` if page gets large

- [ ] **Step 1:** Tab state: `catalog | pending | rejected`.

- [ ] **Step 2:** Catalog tab = existing import + master list.

- [ ] **Step 3:** Pending: list via `listReviewQueueFoods({ status: 'pending' })`; actions Aprobar / Editar e incorporar / Rechazar (notes optional).

- [ ] **Step 4:** Rejected: same list helper with `rejected` + 30d filter; only **Editar e incorporar**.

- [ ] **Step 5:** Aprobar → `updateFoodReview(id, { approved })` + clear cache + reload.
- [ ] **Step 6:** Rechazar → `updateFoodReview(id, { rejected, review_notes })` + reload.
- [ ] **Step 7:** Editar e incorporar → `FoodFormModal` with draft = `{ ...food, id: undefined }`, no `nutritionistId`; onSaved path: if opened for incorporate, call `incorporateEditedFood(sourceId, savedPayload)` — **prefer** modal that does not auto-save as update: open with `food` clone without id so `saveFood` inserts master, then reject source in parent `onSaved` using stored `sourceId` (FoodFormModal already saved master). Simpler parent flow:
  1. Modal save creates master (`nutritionistId` omitted).
  2. Parent `onSaved` receives nothing with full payload today — only callback. **Fix:** either extend `onSaved(food)` to pass saved record, or call `incorporateEditedFood` inside a thin wrapper that uses form then API.

**Preferred API path for edit:** use `incorporateEditedFood` only (modal must not double-insert). Extend `FoodFormModal` with optional `onSubmitOverride?: (data) => Promise<void>` OR `mode="incorporate"` + `sourceFoodId`.

- [ ] **Step 8:** Add `onSubmitOverride` (or `mode`) to `FoodFormModal.jsx` / `.d.ts`: when set, call override instead of `saveFood`/`createFoodRevision`, then `onSaved()`.

- [ ] **Step 9:** Manual test checklist from spec.

---

### Task 4: Verify + deploy notes

- [ ] `npm run build` (or project script).
- [ ] Manual: create from diet; approve; edit-incorporate (two foods for nutri); reject; rejected older than 30d hidden.
- [ ] Commit only if user asks; push only to Lite remote if asked.

## Spec coverage

| Spec item | Task |
|-----------|------|
| Create in diet modal | 2 |
| Same FoodFormModal | 2, 3 |
| Tabs Catálogo/Pendientes/Rechazados | 3 |
| Approve as-is | 1, 3 |
| Edit & incorporate + duplicate | 1, 3 |
| Reject + 30d Maestro filter | 1, 3 |
| Nutri keeps private on reject | 1 (no delete) |
