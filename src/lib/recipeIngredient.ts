// Converts a recipe ingredient into a diet plan item with proper unit options
// and per-unit macros + micros.
//
// Recipe ingredients vary by origin:
//  - Added via IngredientSearch (modern): carry _unitOptions, _unitIndex,
//    _householdMeasures, _perGramMacros, grams, and all scaled nutrients
//    spread on top — fully self-describing.
//  - Added before that change (legacy): only name, quantity, unit, macros.
//
// To produce a diet item that matches the recipe's nutritional values AND
// supports unit switching, this module derives per-gram values for both
// macros and micros from whatever signal is available, in priority order:
//   1. _perGramMacros[key] (authoritative)
//   2. ingredient total[key] / ing.grams (recipe knows exact gram weight)
//   3. catalog food[key] / portion_grams (name match)
//   4. ingredient total[key] / ing.quantity (last-resort)

import { OPTIONAL_NUTRIENTS, getFoodNutrientValue } from '@/lib/foodNutrients';

export type UnitOption = {
  label: string;
  grams: number;
  isHousehold: boolean;
};

export type HouseholdMeasure = {
  name: string;
  weight_grams: number;
};

export type PerGramMacros = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  [nutrient: string]: number | undefined;
};

export type RecipeIngredient = {
  name?: string;
  quantity?: number | string;
  unit?: string;
  grams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  nutrients?: Record<string, number>;
  _unitOptions?: UnitOption[];
  _unitIndex?: number;
  _householdMeasures?: HouseholdMeasure[];
  _perGramMacros?: PerGramMacros;
  [key: string]: unknown;
};

export type CatalogFood = {
  name?: string;
  portion_grams?: number;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  household_measures?: HouseholdMeasure[];
  [key: string]: unknown;
};

// Marker attached to every ingredient that came from the same "Add recipe"
// action. All items sharing the same instance_id render together inside a
// single RecipeGroupCard. Storing instance_id (vs. just recipe_id) means
// adding the same recipe twice produces independent groups.
export type RecipeGroup = {
  instance_id: string;
  recipe_id?: string;
  name: string;
  image_url?: string;
  servings: number;
  order: number;
};

export type DietPlanItem = Record<string, unknown> & {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  is_recipe: boolean;
  unit_options?: UnitOption[];
  selected_unit_index?: number;
  household_measures?: HouseholdMeasure[];
  reference_food?: Record<string, unknown>;
  recipe_group?: RecipeGroup;
};

const CORE_MACRO_KEYS = ['calories', 'protein', 'carbs', 'fat'] as const;
const GRAM_UNIT_LABELS = new Set(['g', 'gramos', 'gramo', 'grams', 'gram']);
const DEFAULT_GRAM_UNIT: UnitOption = { label: 'gramos', grams: 1, isHousehold: false };

const safeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const safePositive = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const roundDietValue = (value: number): number => Math.round(value * 10) / 10;

export const normalizeUnitOptions = (options: unknown): UnitOption[] => {
  if (!Array.isArray(options)) return [];
  return options
    .map((option) => {
      const opt = option as Partial<UnitOption> | null | undefined;
      return {
        label: String(opt?.label || '').trim(),
        grams: Number(opt?.grams),
        isHousehold: Boolean(opt?.isHousehold),
      };
    })
    .filter((opt) => opt.label && Number.isFinite(opt.grams) && opt.grams > 0);
};

export const normalizeHouseholdMeasures = (measures: unknown): HouseholdMeasure[] => {
  if (!Array.isArray(measures)) return [];
  return measures
    .map((m) => {
      const measure = m as Partial<HouseholdMeasure> | null | undefined;
      return {
        name: String(measure?.name || '').trim(),
        weight_grams: Number(measure?.weight_grams),
      };
    })
    .filter((m) => m.name && Number.isFinite(m.weight_grams) && m.weight_grams > 0);
};

export const buildUnitOptionsFromFood = (food: CatalogFood | null | undefined): UnitOption[] => {
  const base: UnitOption[] = [{ ...DEFAULT_GRAM_UNIT }];
  normalizeHouseholdMeasures(food?.household_measures).forEach((m) => {
    base.push({ label: m.name, grams: m.weight_grams, isHousehold: true });
  });
  return base;
};

export const formatUnitLabel = (unit: UnitOption | null | undefined, quantity: number): string => {
  const safeQty = safePositive(quantity, 1);
  if (!unit || !unit.isHousehold) {
    return `${safeQty} gramos`;
  }
  const totalGrams = roundDietValue(safeQty * unit.grams);
  return `${safeQty} ${unit.label} (${totalGrams}g)`;
};

const findFoodInCatalog = (
  name: string | undefined,
  catalog: CatalogFood[] | undefined,
): CatalogFood | undefined => {
  if (!name || !Array.isArray(catalog) || catalog.length === 0) return undefined;
  const target = name.toLowerCase().trim();
  if (!target) return undefined;

  const exact = catalog.find((f) => (f?.name || '').toLowerCase().trim() === target);
  if (exact) return exact;

  const targetHead = target.split(',')[0].trim();
  return catalog.find((f) => {
    const fName = (f?.name || '').toLowerCase().trim();
    if (!fName) return false;
    return fName.includes(target) || (targetHead && fName.split(',')[0].trim() === targetHead);
  });
};

// Reads a nutrient total from the ingredient, looking at top-level first
// then nested `nutrients`. Returns null when unavailable.
const readNutrientTotal = (ing: RecipeIngredient, key: string): number | null => {
  const direct = Number((ing as Record<string, unknown>)[key]);
  if (Number.isFinite(direct)) return direct;
  const nested = ing.nutrients && typeof ing.nutrients === 'object'
    ? Number((ing.nutrients as Record<string, unknown>)[key])
    : NaN;
  return Number.isFinite(nested) ? nested : null;
};

// All keys we attempt to extract: macros + every optional nutrient in the catalog.
const ALL_NUTRIENT_KEYS: string[] = [
  ...CORE_MACRO_KEYS,
  ...OPTIONAL_NUTRIENTS.map((n) => n.key),
];

// Computes a per-gram value for one nutrient key by walking the fallback chain.
// Returns null when no source has a usable value (so callers can omit the key).
const derivePerGramForKey = (
  key: string,
  ing: RecipeIngredient,
  catalogFood: CatalogFood | undefined,
): number | null => {
  // 1. Authoritative
  if (ing._perGramMacros && typeof ing._perGramMacros === 'object') {
    const v = (ing._perGramMacros as Record<string, unknown>)[key];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }

  // 2. Stored total / ing.grams
  const grams = safePositive(ing.grams, 0);
  if (grams > 0) {
    const total = readNutrientTotal(ing, key);
    if (total != null) return total / grams;
  }

  // 3. Catalog food / portion_grams
  const portion = safePositive(catalogFood?.portion_grams, 0);
  if (catalogFood && portion > 0) {
    const catalogValue = getFoodNutrientValue(catalogFood as Record<string, unknown>, key);
    if (catalogValue != null) return catalogValue / portion;
  }

  // 4. Last resort: stored total / ing.quantity (only for macros; for micros
  //    this would inflate values for non-gram units, so skip)
  if (CORE_MACRO_KEYS.includes(key as typeof CORE_MACRO_KEYS[number])) {
    const denom = safePositive(ing.quantity, 1);
    const total = readNutrientTotal(ing, key);
    if (total != null) return total / denom;
  }

  return null;
};

// Builds per-gram values for every known nutrient (macros + micros) by
// walking the fallback chain per key.
const derivePerGramMacros = (
  ing: RecipeIngredient,
  catalogFood: CatalogFood | undefined,
): PerGramMacros => {
  const result: PerGramMacros = {};
  ALL_NUTRIENT_KEYS.forEach((key) => {
    const value = derivePerGramForKey(key, ing, catalogFood);
    if (value != null) result[key] = value;
  });
  // Ensure macros always exist (even if 0) so item shape is predictable
  CORE_MACRO_KEYS.forEach((key) => {
    if (result[key] == null) result[key] = 0;
  });
  return result;
};

const resolveUnitOptions = (
  ing: RecipeIngredient,
  catalogFood: CatalogFood | undefined,
): UnitOption[] => {
  const stored = normalizeUnitOptions(ing._unitOptions);
  if (stored.length > 0) return stored;
  if (catalogFood) return buildUnitOptionsFromFood(catalogFood);
  return [{ ...DEFAULT_GRAM_UNIT }];
};

const resolveUnitIndex = (
  ing: RecipeIngredient,
  unitOptions: UnitOption[],
): number => {
  // 1. Explicit stored index, if valid
  if (ing._unitIndex != null) {
    const stored = Number(ing._unitIndex);
    if (Number.isInteger(stored) && unitOptions[stored]) return stored;
  }

  // 2. Match by unit label (for ingredients without _unitIndex)
  if (ing.unit) {
    const ingUnit = String(ing.unit).toLowerCase().trim();
    if (ingUnit && !GRAM_UNIT_LABELS.has(ingUnit)) {
      const idx = unitOptions.findIndex((u) => u.label.toLowerCase().trim() === ingUnit);
      if (idx >= 0) return idx;
    }
  }

  return 0;
};

// Main entry point: converts a recipe ingredient to a diet plan item.
// Returns null if the ingredient is missing required fields (no name).
//
// `foodCatalog` is optional — when provided, ingredients without rich data
// fall back to matching against the catalog by name to recover household
// measures and accurate per-gram macros.
//
// `recipeGroup` is optional — when provided, gets stamped on the item so
// the rendering layer can group ingredients from the same recipe instance.
export const buildRecipeIngredientItem = (
  ing: RecipeIngredient | null | undefined,
  recipeMultiplier: number = 1,
  foodCatalog?: CatalogFood[],
  recipeGroup?: RecipeGroup,
): DietPlanItem | null => {
  if (!ing || typeof ing !== 'object') return null;
  if (!ing.name || typeof ing.name !== 'string' || !ing.name.trim()) return null;

  const multiplier = safePositive(recipeMultiplier, 1);
  const catalogFood = findFoodInCatalog(ing.name, foodCatalog);

  const unitOptions = resolveUnitOptions(ing, catalogFood);
  const unitIndex = resolveUnitIndex(ing, unitOptions);
  const selectedUnit = unitOptions[unitIndex] || unitOptions[0] || DEFAULT_GRAM_UNIT;

  const perGram = derivePerGramMacros(ing, catalogFood);
  const householdMeasures = normalizeHouseholdMeasures(
    ing._householdMeasures || catalogFood?.household_measures,
  );

  const ingQuantity = safePositive(ing.quantity, 1) * multiplier;
  const perUnitFactor = selectedUnit.isHousehold ? selectedUnit.grams : 1;

  const referenceFood: Record<string, unknown> = {
    name: ing.name,
    portion_grams: 1,
    household_measures: householdMeasures,
  };
  Object.entries(perGram).forEach(([key, value]) => {
    referenceFood[key] = safeNumber(value);
  });

  const item: DietPlanItem = {
    name: ing.name,
    quantity: ingQuantity,
    unit: formatUnitLabel(selectedUnit, ingQuantity),
    calories: safeNumber(perGram.calories) * perUnitFactor,
    protein: safeNumber(perGram.protein) * perUnitFactor,
    carbs: safeNumber(perGram.carbs) * perUnitFactor,
    fat: safeNumber(perGram.fat) * perUnitFactor,
    unit_options: unitOptions,
    selected_unit_index: unitIndex,
    household_measures: householdMeasures,
    reference_food: referenceFood,
    is_recipe: false,
  };

  // Propagate any micros stored per-gram (fiber, sodium, vitamins, …)
  Object.entries(perGram).forEach(([key, value]) => {
    if (CORE_MACRO_KEYS.includes(key as typeof CORE_MACRO_KEYS[number])) return;
    item[key] = safeNumber(value) * perUnitFactor;
  });

  if (recipeGroup) {
    // Coerce numeric fields so a malformed group (e.g. servings stored as
    // string in the DB) doesn't poison downstream UI math like NaN totals.
    item.recipe_group = {
      instance_id: String(recipeGroup.instance_id || ''),
      recipe_id: recipeGroup.recipe_id ? String(recipeGroup.recipe_id) : undefined,
      name: String(recipeGroup.name || 'Receta'),
      image_url: recipeGroup.image_url ? String(recipeGroup.image_url) : undefined,
      servings: safePositive(recipeGroup.servings, 1),
      order: Number.isFinite(Number(recipeGroup.order)) ? Number(recipeGroup.order) : 0,
    };
  }

  return item;
};
