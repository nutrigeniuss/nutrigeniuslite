# Excel Master Foods Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Maestro upload the SaaS official foods `.xlsx` at `/admin/alimentos`, parse it in the browser, and upsert master foods by name (replace if exists, insert if new).

**Architecture:** Pure parser (`parseOfficialFoodsRows`) maps Excel AOA → food records; a thin `xlsx` adapter reads the file; `importMasterFoodsBatch` upserts only `nutritionist_id IS NULL` rows via existing `buildPersistedFoodFields` patterns; `FoodsCatalogPage` adds the Excel upload UI and keeps JSON as backup.

**Tech Stack:** React 19, TypeScript, Vitest, SheetJS (`xlsx`), Supabase `foods` table, existing `catalogData` persistence helpers.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-10-excel-foods-import-design.md`
- Upsert only: same normalized name → replace master row; new name → insert; foods absent from Excel are **not** deleted
- Masters only: `nutritionist_id = null` (never match/update personal foods)
- Headers matched by **name** (accent/case flexible), not fixed column index
- Support both plantilla variants: with unit row + optional `porcion_gramos` (file 19), and data starting at row 2 without `porcion_gramos` (file `-1`)
- Normalize nutrients to **per 100 g** using measure grams (or `porcion_gramos` / 100 fallback)
- Repeated name rows → `household_measures`; do not create duplicate master rows
- UI copy in Spanish; reuse `ng-*` styles
- Do **not** commit the full ~2 MB Excel; use a tiny AOA fixture in tests
- YAGNI: no edge function, no auto-delete missing foods, no nutritionist-facing Excel UI
- TDD for parser; frequent small commits
- Add `xlsx` dependency; extend `package.json` `"test"` script to include the new parser test file

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/officialFoodsExcelMap.ts` | Header aliases → nutrient/macro keys; header normalization |
| `src/lib/officialFoodsExcelMap.test.ts` | Tests for header resolve |
| `src/lib/parseOfficialFoodsWorkbook.ts` | Pure AOA → `OfficialFoodImportRecord[]` + skipped count |
| `src/lib/parseOfficialFoodsWorkbook.test.ts` | Parser TDD (arroz measures, unit row, no portion col, blank name) |
| `src/lib/readOfficialFoodsXlsx.ts` | `File`/`ArrayBuffer` → AOA via `xlsx` |
| `src/lib/importMasterFoodsBatch.ts` | List masters only + upsert by name (reuse persistence rules from `catalogData`) |
| `src/pages/FoodsCatalogPage.tsx` | Excel upload section + progress/message |
| `package.json` | `xlsx` dep + test script includes parser tests |

Do **not** put Excel parsing inside `FoodsCatalogPage.tsx`.

---

### Task 1: Header map — TDD

**Files:**
- Create: `src/lib/officialFoodsExcelMap.ts`
- Create: `src/lib/officialFoodsExcelMap.test.ts`
- Modify: `package.json` (extend `"test"` script)

**Interfaces:**
- Consumes: nothing (pure)
- Produces:
  - `export function normalizeExcelHeader(value: unknown): string`
  - `export type OfficialExcelField = 'category' | 'name' | 'measure' | 'measure_grams' | 'portion_grams' | 'notes' | 'calories' | 'protein' | 'carbs' | 'available_carbs' | 'fat' | \`nutrient:${string}\``
  - `export function resolveOfficialExcelField(header: unknown): OfficialExcelField | null`
  - Macro aliases at least: `alimento`/`ALIMENTO`→`name`, `categoria`→`category`, `medida casera`→`measure`, `gramos o ml de la medida casera`→`measure_grams`, `porcion_gramos`→`portion_grams`, `calorias`→`calories`, `proteinas`/`proteínas`→`protein`, `carbohidratos`/`carbohidratos totales`→`carbs`, `carbohidratos disponibles`→`available_carbs`, `grasas`/`grasas total`→`fat`, `notas`→`notes`
  - Micronutrient headers map to `nutrient:<key>` using labels aligned with `OPTIONAL_NUTRIENTS` (e.g. `Agua`→`nutrient:water`, `fibra`→`nutrient:fiber`, `Sodio`→`nutrient:sodium`)

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeExcelHeader, resolveOfficialExcelField } from './officialFoodsExcelMap';

describe('normalizeExcelHeader', () => {
  it('lowercases, strips accents, collapses spaces', () => {
    expect(normalizeExcelHeader('  Proteínas  ')).toBe('proteinas');
    expect(normalizeExcelHeader('ALIMENTO')).toBe('alimento');
  });
});

describe('resolveOfficialExcelField', () => {
  it('maps core columns', () => {
    expect(resolveOfficialExcelField('ALIMENTO')).toBe('name');
    expect(resolveOfficialExcelField('categoria')).toBe('category');
    expect(resolveOfficialExcelField('medida casera')).toBe('measure');
    expect(resolveOfficialExcelField('gramos o ml de la medida casera')).toBe('measure_grams');
    expect(resolveOfficialExcelField('porcion_gramos')).toBe('portion_grams');
    expect(resolveOfficialExcelField('calorias')).toBe('calories');
    expect(resolveOfficialExcelField('proteínas')).toBe('protein');
    expect(resolveOfficialExcelField('carbohidratos totales')).toBe('carbs');
    expect(resolveOfficialExcelField('carbohidratos disponibles')).toBe('available_carbs');
    expect(resolveOfficialExcelField('grasas total')).toBe('fat');
    expect(resolveOfficialExcelField('notas')).toBe('notes');
  });

  it('maps micronutrients to nutrient keys', () => {
    expect(resolveOfficialExcelField('Agua')).toBe('nutrient:water');
    expect(resolveOfficialExcelField('fibra')).toBe('nutrient:fiber');
    expect(resolveOfficialExcelField('Sodio')).toBe('nutrient:sodium');
  });

  it('returns null for unknown headers', () => {
    expect(resolveOfficialExcelField('columna inventada')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/officialFoodsExcelMap.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement map**

Implement `officialFoodsExcelMap.ts` with a `Record<string, OfficialExcelField>` keyed by `normalizeExcelHeader` output. Build nutrient aliases from a explicit list mirroring common plantilla headers → `OPTIONAL_NUTRIENTS` keys (do not import React). Prefer an explicit alias table over scraping labels at runtime so tests stay stable.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/officialFoodsExcelMap.test.ts`

- [ ] **Step 5: Extend package.json test script**

Change `"test"` to also run the new file (keep existing admin tests):

```json
"test": "vitest run src/lib/adminAccess.test.ts src/lib/adminWhatsAppInvite.test.ts src/lib/officialFoodsExcelMap.test.ts src/lib/parseOfficialFoodsWorkbook.test.ts"
```

(`parseOfficialFoodsWorkbook.test.ts` will be added in Task 2; including it early is fine once the file exists — if vitest errors on missing file, add the path only after Task 2 Step 1.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/officialFoodsExcelMap.ts src/lib/officialFoodsExcelMap.test.ts package.json
git commit -m "$(cat <<'EOF'
feat: map official foods Excel headers to nutrient keys

EOF
)"
```

---

### Task 2: Pure parser — TDD

**Files:**
- Create: `src/lib/parseOfficialFoodsWorkbook.ts`
- Create: `src/lib/parseOfficialFoodsWorkbook.test.ts`

**Interfaces:**
- Consumes: `normalizeExcelHeader`, `resolveOfficialExcelField` from Task 1
- Produces:
  - `export type OfficialFoodImportRecord = { name: string; category: string | null; country: 'PE'; portion_grams: 100; calories: number; protein: number; carbs: number; fat: number; notes: string | null; household_measures: Array<{ name: string; weight_grams: number; quantity: number; sort_order: number }>; nutrients: Record<string, number | null>; fiber?: number | null; sodium?: number | null; available_carbs?: number | null; }`
  - `export type OfficialFoodsParseResult = { foods: OfficialFoodImportRecord[]; skippedRows: number; }`
  - `export function parseOfficialFoodsRows(rows: unknown[][]): OfficialFoodsParseResult`
  - Behavior:
    1. Row 0 = headers → field index map (ignore null fields).
    2. If row 1 looks like units (majority of non-empty cells match `/^(g|mg|ug|µg|mcg|kcal|kcal\/g|ml)$/i` or empty), skip it; else treat as data.
    3. Require a `name` column; if missing throw `Error('Falta la columna alimento en la plantilla.')`.
    4. Skip rows with blank name (`skippedRows++`).
    5. Group by normalized name (same algorithm as catalog: NFD strip accents, lower, collapse spaces).
    6. For each data row: read measure name + grams (`measure_grams`, else `portion_grams`, else 100 if nutrients present).
    7. If measure name non-empty and grams > 0, push household measure (dedupe by measure name).
    8. Nutrient anchor: among rows for a name, prefer grams closest to 100 with most numeric nutrient cells; scale all macros/nutrients by `100 / grams`.
    9. Set `portion_grams: 100`. Put optional micros into `nutrients`; also set top-level `fiber`/`sodium`/`available_carbs` when present.
    10. `country: 'PE'`.

- [ ] **Step 1: Write failing tests** (fixture AOA — no real xlsx file)

```ts
import { describe, expect, it } from 'vitest';
import { parseOfficialFoodsRows } from './parseOfficialFoodsWorkbook';

const headers19 = [
  'categoria', 'ALIMENTO', 'medida casera', 'gramos o ml de la medida casera', 'porcion_gramos',
  'calorias', 'Agua', 'proteínas', 'Grasas', 'Carbohidratos', 'fibra', 'Sodio', 'notas',
];
const units19 = [
  'categoria', 'ALIMENTO', 'medida casera', 'g', 'g', 'kcal', 'g', 'g', 'g', 'g', 'g', 'mg', null,
];

describe('parseOfficialFoodsRows', () => {
  it('groups repeated names into household measures and scales to 100g', () => {
    const result = parseOfficialFoodsRows([
      headers19,
      units19,
      ['CEREALES Y DERIVADOS', 'Arroz blanco cocido', 'Gramos', '100', '100', '130', null, '2.7', '0.3', '28.2', '0.4', '1', 'nota'],
      ['CEREALES Y DERIVADOS', 'Arroz blanco cocido', 'Cucharada llena', '20', null, null, null, null, null, null, null, null, null],
      ['CEREALES Y DERIVADOS', 'Arroz blanco cocido', 'Taza pequeña (250 ml)', '158', null, null, null, null, null, null, null, null, null],
    ]);
    expect(result.foods).toHaveLength(1);
    expect(result.skippedRows).toBe(0);
    const food = result.foods[0];
    expect(food.name).toBe('Arroz blanco cocido');
    expect(food.portion_grams).toBe(100);
    expect(food.calories).toBeCloseTo(130, 1);
    expect(food.protein).toBeCloseTo(2.7, 1);
    expect(food.household_measures.map((m) => m.name)).toEqual([
      'Gramos',
      'Cucharada llena',
      'Taza pequeña (250 ml)',
    ]);
    expect(food.household_measures[1].weight_grams).toBe(20);
    expect(food.household_measures[2].weight_grams).toBe(158);
  });

  it('parses plantilla-1 style without porcion_gramos and without unit row', () => {
    const headers = [
      'categoria', 'alimento', 'medida casera', 'gramos o ml de la medida casera',
      'calorias', 'proteinas', 'carbohidratos totales', 'grasas total',
    ];
    const result = parseOfficialFoodsRows([
      headers,
      ['CEREALES Y DERIVADOS', 'Arroz blanco, cocido', 'Taza loza al ras', '193.2', '222.18', '4.6368', '48.6864', '0.1932'],
      ['CEREALES Y DERIVADOS', 'Arroz blanco, cocido', 'Cucharada llena', '17.8', '20.47', '0.4272', '4.4856', '0.0178'],
    ]);
    expect(result.foods).toHaveLength(1);
    const food = result.foods[0];
    // 222.18 kcal / 193.2 g * 100 ≈ 115.0
    expect(food.calories).toBeCloseTo(115, 0);
    expect(food.household_measures).toHaveLength(2);
  });

  it('skips blank names and throws if alimento column missing', () => {
    expect(() => parseOfficialFoodsRows([['categoria', 'calorias'], ['x', 1]])).toThrow(/alimento/i);
    const result = parseOfficialFoodsRows([
      headers19,
      units19,
      ['CAT', '', 'g', '100', '100', '10', null, '1', '1', '1', null, null, null],
    ]);
    expect(result.foods).toHaveLength(0);
    expect(result.skippedRows).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/lib/parseOfficialFoodsWorkbook.test.ts`

- [ ] **Step 3: Implement parser**

Implement `parseOfficialFoodsRows` in `parseOfficialFoodsWorkbook.ts` per Interfaces above. Keep helpers (`isUnitRow`, `toNumber`, `normalizeName`, `scaleNutrients`) private in the same file.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/lib/parseOfficialFoodsWorkbook.test.ts src/lib/officialFoodsExcelMap.test.ts`

- [ ] **Step 5: Update package.json test script** to include `src/lib/parseOfficialFoodsWorkbook.test.ts` if not already.

- [ ] **Step 6: Commit**

```bash
git add src/lib/parseOfficialFoodsWorkbook.ts src/lib/parseOfficialFoodsWorkbook.test.ts package.json
git commit -m "$(cat <<'EOF'
feat: parse official foods Excel rows into master food records

EOF
)"
```

---

### Task 3: XLSX file adapter

**Files:**
- Create: `src/lib/readOfficialFoodsXlsx.ts`
- Modify: `package.json` (add dependency `xlsx`)

**Interfaces:**
- Consumes: `parseOfficialFoodsRows` from Task 2
- Produces:
  - `export async function parseOfficialFoodsWorkbook(file: File): Promise<OfficialFoodsParseResult>`
  - Reads workbook with SheetJS; prefers sheet named `Alimentos` (case-insensitive), else first sheet; converts to AOA with `header: 1`; passes to `parseOfficialFoodsRows`.

- [ ] **Step 1: Install dependency**

```bash
npm install xlsx
```

- [ ] **Step 2: Implement adapter**

```ts
import * as XLSX from 'xlsx';
import { parseOfficialFoodsRows, type OfficialFoodsParseResult } from './parseOfficialFoodsWorkbook';

export async function parseOfficialFoodsWorkbook(file: File): Promise<OfficialFoodsParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName =
    workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'alimentos')
    ?? workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('El Excel no tiene hojas.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];
  return parseOfficialFoodsRows(rows);
}
```

- [ ] **Step 3: Typecheck / build smoke**

Run: `npx tsc --noEmit` if available, or `npm run build`  
Expected: success (or only pre-existing unrelated warnings)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/readOfficialFoodsXlsx.ts
git commit -m "$(cat <<'EOF'
feat: read official foods xlsx workbook in the browser

EOF
)"
```

---

### Task 4: Master upsert batch

**Files:**
- Create: `src/lib/importMasterFoodsBatch.ts`
- Modify: `src/lib/catalogData.ts` only if a small export is required (prefer **not** exporting private helpers; duplicate the minimal insert/upsert loop here using `supabase` + the same column shaping by calling `importFoodsBatch` **only if** you first fix it to scope masters — otherwise implement dedicated master import)

**Preferred approach (do this):** implement `importMasterFoodsBatch` that:
1. Loads existing masters: `supabase.from('foods').select('id, name').is('nutritionist_id', null)` (paginate if needed via existing `paginateAll` / chunking patterns used in repo).
2. Builds map by normalized name (copy the same normalize algorithm used in parser / catalog).
3. Dedupes incoming `OfficialFoodImportRecord[]` by name (last write wins for nutrients; union measures — parser already groups).
4. Splits insert vs update.
5. Inserts/upserts in chunks of 100 with `nutritionist_id: null`, `review_status: 'approved'`, `published_at: now`, `country: 'PE'`, macros + `household_measures` + `nutrients` (+ fiber/sodium/available_carbs columns when present).
6. Returns `{ insertedCount, updatedCount }`.
7. Accepts optional `onProgress?: (done: number, total: number) => void` and `submittedByUserId?: string` for `submitted_by_nutritionist_id`.

**Do not** call bare `listFoods(undefined)` — it currently returns all foods and would risk matching personal rows.

**Interfaces:**
- Consumes: `OfficialFoodImportRecord`, Supabase client used by the app (`@/lib/supabase` or `@/api/supabaseClient` — match whatever `FoodsCatalogPage` / `catalogData` already use; stay consistent with `catalogData.ts`)
- Produces:
  - `export async function importMasterFoodsBatch(foods: OfficialFoodImportRecord[], options?: { submittedByUserId?: string; onProgress?: (done: number, total: number) => void }): Promise<{ insertedCount: number; updatedCount: number }>`

- [ ] **Step 1: Implement `importMasterFoodsBatch`**

Mirror chunk size `100` from `IMPORT_FOOD_BATCH_SIZE`. On insert/update failures, throw readable `Error` with the Supabase message.

- [ ] **Step 2: Manual type smoke**

Ensure TypeScript compiles (`npm run build`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/importMasterFoodsBatch.ts
git commit -m "$(cat <<'EOF'
feat: upsert master foods by name without touching personal rows

EOF
)"
```

---

### Task 5: Wire Maestro UI

**Files:**
- Modify: `src/pages/FoodsCatalogPage.tsx`

**Interfaces:**
- Consumes: `parseOfficialFoodsWorkbook`, `importMasterFoodsBatch`, `clearFoodCatalogCache` (already used)
- Produces: Excel import section in UI

- [ ] **Step 1: Add Excel import section above JSON**

UI requirements:
- Title: `Importar Excel (plantilla oficial)`
- Helper text: same SaaS plantilla; repeated rows = household measures; same name replaces, new name adds.
- One file input `accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"` labeled **Subir .xlsx**
- On select:
  1. `setBusy(true)`, clear messages
  2. `parseOfficialFoodsWorkbook(file)`
  3. If `foods.length === 0`, throw/show `No se encontraron alimentos en el Excel.`
  4. `importMasterFoodsBatch(foods, { submittedByUserId: user.id, onProgress })`
  5. `await load()` (existing loader already clears cache)
  6. Message: `${foods.length} alimentos · ${inserted} nuevos · ${updated} actualizados · ${skippedRows} filas omitidas`
- Keep JSON replace/merge section below as backup
- Disable controls while `busy`
- Show progress text when `onProgress` fires (e.g. `Guardando 40/1129…`)

Sketch (adapt to existing `ng-*` classes in the page):

```tsx
<section className="ng-card mb-5 p-4 sm:p-5">
  <p className="ng-section-title">Importar Excel (plantilla oficial)</p>
  <p className="ng-muted mt-1">
    Misma plantilla del SaaS. Filas repetidas = medidas caseras. Si el nombre ya existe se reemplaza; si no, se agrega.
  </p>
  <div className="mt-3 flex flex-wrap gap-2">
    <label className={`ng-btn-primary cursor-pointer ${busy ? 'opacity-50' : ''}`}>
      <Upload className="h-3.5 w-3.5" /> Subir .xlsx
      <input
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onImportXlsx(file);
          e.target.value = '';
        }}
      />
    </label>
  </div>
  {progress ? <p className="ng-muted mt-2">{progress}</p> : null}
</section>
```

- [ ] **Step 2: Manual UI check**

Run: `npm run dev`  
Open `/admin/alimentos` as Maestro. Confirm Excel section appears and JSON section still works.

- [ ] **Step 3: Commit**

```bash
git add src/pages/FoodsCatalogPage.tsx
git commit -m "$(cat <<'EOF'
feat: upload official foods xlsx from Maestro catalog page

EOF
)"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Unit tests**

Run: `npm test`  
Expected: all listed tests PASS (admin + excel map + parser)

- [ ] **Step 2: Build**

Run: `npm run build`  
Expected: success

- [ ] **Step 3: Import real file (manual)**

1. Sign in as Maestro.
2. Go to `/admin/alimentos`.
3. Upload `c:\Users\LENOVO\Downloads\plantilla-alimentos-oficial-1.xlsx`.
4. Expect ~1129 unique foods message; list count rises accordingly.
5. Search `Arroz blanco, cocido` — one master row; opening/editing or diet search should expose multiple household measures.
6. Re-upload the same file — expect mostly **actualizados**, few/no nuevos; count stable.
7. Confirm a nutritionist personal food (if any) was not overwritten.

- [ ] **Step 4: Final commit only if verification fixes were needed**; otherwise done.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Maestro `.xlsx` upload | 5 |
| Browser parse (SheetJS) | 3 |
| Upsert by name; no delete missing | 4, 5 |
| Group measures; normalize 100 g | 2 |
| Header-by-name; both plantilla variants | 1, 2 |
| JSON backup kept | 5 |
| Progress / Spanish messages | 5 |
| Unit tests + small fixture | 1, 2 |
| Masters only (`nutritionist_id` null) | 4 |
| No full Excel in repo | 2 (AOA fixture) |
