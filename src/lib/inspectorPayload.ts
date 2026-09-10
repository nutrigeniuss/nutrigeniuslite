// Builds the display payload for the Nutrient Inspector drawer.
//
// Takes one or more diet items (single food OR all ingredients of a recipe
// instance) and produces a structure ready to render: header info, macros,
// and a sorted list of populated micronutrients (one chip per micro).
//
// The input items store per-unit values (calories/protein/etc. per gram
// or per household measure); displayed totals are (quantity × per-unit).

import { OPTIONAL_NUTRIENTS, FIXED_NUTRIENTS, getFoodNutrientValue } from '@/lib/foodNutrients';

type FoodNutrientDef = { key: string; label: string; unit: string };

const ALL_NUTRIENT_DEFS: FoodNutrientDef[] = [...FIXED_NUTRIENTS, ...OPTIONAL_NUTRIENTS];
const NUTRIENT_BY_KEY: Map<string, FoodNutrientDef> = new Map(ALL_NUTRIENT_DEFS.map((d) => [d.key, d]));
const NUTRIENT_DISPLAY_ORDER: Map<string, number> = new Map(
  ALL_NUTRIENT_DEFS.map((d, i) => [d.key, i]),
);

// Stops "show every numeric field" from accidentally surfacing structural
// fields (id, quantity, etc.). Anything not in NUTRIENT_BY_KEY is filtered.
const isNutrientKey = (key: string): boolean => NUTRIENT_BY_KEY.has(key);

const CORE_MACRO_KEYS = new Set(['calories', 'protein', 'carbs', 'fat']);

export type InspectorMicroRow = {
  key: string;
  label: string;
  unit: string;
  value: number;
};

export type InspectorPayload = {
  kind: 'item' | 'recipe';
  title: string;
  subtitle?: string;
  imageUrl?: string;
  // Sum across all included items
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  // Every populated micro/extended nutrient, sorted in canonical order
  micros: InspectorMicroRow[];
  // For recipe groups: per-ingredient contribution preview
  ingredients?: Array<{ id: string; name: string; quantity: number; unit: string; calories: number }>;
};

type AnyItem = Record<string, unknown>;

const numOr0 = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const itemTotal = (item: AnyItem, key: string): number => {
  const perUnit = getFoodNutrientValue(item, key);
  if (perUnit == null) return 0;
  const qty = numOr0(item.quantity) || 1;
  return perUnit * qty;
};

// Builds the inspector payload from a list of items. When `meta` is
// provided (recipe group), the title/subtitle/image come from it; otherwise
// they're derived from the single item.
export const buildInspectorPayload = (
  items: AnyItem[],
  meta?: { kind: 'item' | 'recipe'; title?: string; subtitle?: string; imageUrl?: string },
): InspectorPayload | null => {
  if (!Array.isArray(items) || items.length === 0) return null;

  const kind = meta?.kind ?? 'item';

  // Aggregate macros
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  items.forEach((item) => {
    totals.calories += itemTotal(item, 'calories');
    totals.protein += itemTotal(item, 'protein');
    totals.carbs += itemTotal(item, 'carbs');
    totals.fat += itemTotal(item, 'fat');
  });

  // Aggregate micros: scan every known nutrient key, sum across items.
  // Skip core macros (already in `totals`).
  const microTotals: Record<string, number> = {};
  ALL_NUTRIENT_DEFS.forEach((def) => {
    if (CORE_MACRO_KEYS.has(def.key)) return;
    let sum = 0;
    let anyPresent = false;
    items.forEach((item) => {
      const v = getFoodNutrientValue(item, def.key);
      if (v != null) {
        anyPresent = true;
        sum += v * (numOr0(item.quantity) || 1);
      }
    });
    // Threshold: ignore vanishingly small totals (rounding noise from per-gram
    // micros × small quantities). 0.01 is below the threshold of any unit's
    // clinical relevance.
    if (anyPresent && Math.abs(sum) >= 0.01) {
      microTotals[def.key] = sum;
    }
  });

  const micros: InspectorMicroRow[] = Object.keys(microTotals)
    .filter(isNutrientKey)
    .sort((a, b) => (NUTRIENT_DISPLAY_ORDER.get(a) ?? 999) - (NUTRIENT_DISPLAY_ORDER.get(b) ?? 999))
    .map((key): InspectorMicroRow | null => {
      // Defensive: NUTRIENT_BY_KEY should always contain `key` (we already
      // filtered through isNutrientKey), but never use non-null assertion
      // on a Map.get — if the definitions list ever changes, this would
      // crash production. Skip the row instead.
      const def = NUTRIENT_BY_KEY.get(key);
      if (!def) return null;
      return {
        key,
        // Strip parenthetical unit from label ("Fibra (g)" → "Fibra")
        label: def.label.replace(/\s*\([^)]*\)\s*$/, ''),
        unit: def.unit,
        value: microTotals[key],
      };
    })
    .filter((row): row is InspectorMicroRow => row !== null);

  const title = meta?.title ?? String(items[0]?.name ?? '');
  const subtitle = meta?.subtitle
    ?? (items.length === 1
      ? String(items[0]?.unit ?? '')
      : `${items.length} ingredientes`);

  const payload: InspectorPayload = {
    kind,
    title,
    subtitle,
    imageUrl: meta?.imageUrl,
    totals,
    micros,
  };

  if (kind === 'recipe') {
    payload.ingredients = items.map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      quantity: numOr0(item.quantity) || 1,
      unit: String(item.unit ?? ''),
      calories: itemTotal(item, 'calories'),
    }));
  }

  return payload;
};

// Categorizes a nutrient for visual grouping (chip colors). Returns one of
// a small set of category keys consumed by the UI layer.
export type NutrientCategory =
  | 'mineral'
  | 'vitamin'
  | 'lipid'
  | 'sugar'
  | 'amino'
  | 'carotenoid'
  | 'bioactive'
  | 'index'
  | 'fiber-water'
  | 'other';

const NUTRIENT_CATEGORY: Record<string, NutrientCategory> = {
  // Fiber / water / energy components
  water: 'fiber-water', fiber: 'fiber-water', soluble_fiber: 'fiber-water',
  insoluble_fiber: 'fiber-water', ashes: 'fiber-water', cholesterol: 'fiber-water',
  // Minerals
  sodium: 'mineral', calcium: 'mineral', iron: 'mineral', potassium: 'mineral',
  magnesium: 'mineral', zinc: 'mineral', copper: 'mineral', phosphorus: 'mineral',
  selenium: 'mineral', manganese: 'mineral', iodine: 'mineral', chromium: 'mineral',
  molybdenum: 'mineral', chloride: 'mineral', sulfur: 'mineral', boron: 'mineral',
  fluoride: 'mineral',
  // Vitamins
  vitamin_a: 'vitamin', vitamin_b6: 'vitamin', vitamin_b12: 'vitamin',
  vitamin_c: 'vitamin', vitamin_d: 'vitamin', vitamin_d2: 'vitamin',
  vitamin_d3: 'vitamin', vitamin_e: 'vitamin', vitamin_k: 'vitamin',
  thiamine: 'vitamin', riboflavin: 'vitamin', niacin: 'vitamin',
  pantothenic_acid: 'vitamin', folate: 'vitamin', biotin: 'vitamin',
  retinol: 'vitamin', choline: 'vitamin',
  // Lipids
  saturated_fat: 'lipid', trans_fat: 'lipid', mufa: 'lipid', pufa: 'lipid',
  omega3_total: 'lipid', omega6_total: 'lipid', linoleic_acid: 'lipid',
  alcohol: 'lipid',
  epa: 'lipid', dha: 'lipid', ala: 'lipid', omega6_omega3_ratio: 'lipid',
  // Sugars
  fructose: 'sugar', glucose: 'sugar', lactose: 'sugar', galactose: 'sugar',
  maltose: 'sugar', sucrose: 'sugar', starch: 'sugar',
  sorbitol: 'sugar', mannitol: 'sugar', raffinose: 'sugar',
  stachyose: 'sugar', nystose: 'sugar', kestose: 'sugar',
  // Amino acids
  aspartic_acid: 'amino', threonine: 'amino', serine: 'amino',
  glutamic_acid: 'amino', proline: 'amino', glycine: 'amino', alanine: 'amino',
  cysteine: 'amino', valine: 'amino', methionine: 'amino', isoleucine: 'amino',
  leucine: 'amino', tyrosine: 'amino', phenylalanine: 'amino',
  histidine: 'amino', lysine: 'amino', arginine: 'amino', tryptophan: 'amino',
  // Carotenoids
  alpha_carotene: 'carotenoid', beta_carotene: 'carotenoid',
  beta_cryptoxanthin: 'carotenoid', lutein_zeaxanthin: 'carotenoid',
  lycopene: 'carotenoid',
  // Bioactives
  caffeine: 'bioactive', theobromine: 'bioactive', polyphenols: 'bioactive',
  flavonoids: 'bioactive', oxalates: 'bioactive', purines: 'bioactive',
  // Indices
  glycemic_index: 'index', glycemic_load: 'index', energy_density: 'index',
};

export const getNutrientCategory = (key: string): NutrientCategory =>
  NUTRIENT_CATEGORY[key] ?? 'other';

// Formats a value with sensible precision per unit. Avoids spurious decimals
// (e.g. 13.0 mg) for whole-number-friendly units.
export const formatNutrientValue = (value: number, unit: string): string => {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  // Very small values get 2 decimals so they don't all show as 0.0
  if (abs < 1) return value.toFixed(2);
  // Mid-range gets 1 decimal
  if (abs < 100) return value.toFixed(1);
  // Large values rounded to integer
  return Math.round(value).toString();
};
