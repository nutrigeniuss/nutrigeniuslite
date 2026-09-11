import { normalizeFoodCategory } from '@/lib/foodCategories';
import type { OfficialFoodImportRecord } from './parseOfficialFoodsWorkbook';

export type BuildPersistedMasterRowOptions = {
  submittedByUserId?: string;
};

type HouseholdMeasureInput = OfficialFoodImportRecord['household_measures'][number];

const normalizeFoodLookupKey = (value: string | null | undefined): string => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const cleanNutrientsMap = (
  nutrients: Record<string, number | null> | undefined,
): Record<string, number | null> => {
  if (!nutrients) {
    return {};
  }

  return Object.entries(nutrients).reduce<Record<string, number | null>>((accumulator, [key, value]) => {
    if (value == null || !Number.isFinite(value)) {
      return accumulator;
    }
    accumulator[key] = value;
    return accumulator;
  }, {});
};

const normalizeHouseholdMeasures = (
  measures: OfficialFoodImportRecord['household_measures'] | undefined,
): HouseholdMeasureInput[] => {
  if (!Array.isArray(measures) || measures.length === 0) {
    return [];
  }

  const deduped = new Map<string, HouseholdMeasureInput>();
  measures.forEach((measure, index) => {
    const name = String(measure?.name ?? '').trim();
    const key = normalizeFoodLookupKey(name);
    const weightGrams = Number(measure?.weight_grams);
    if (!key || !Number.isFinite(weightGrams) || weightGrams <= 0) {
      return;
    }

    const quantity = Number(measure?.quantity);
    deduped.set(key, {
      name,
      weight_grams: weightGrams,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      sort_order: Number.isFinite(Number(measure?.sort_order))
        ? Number(measure.sort_order)
        : index,
    });
  });

  return Array.from(deduped.values()).map((measure, index) => ({
    ...measure,
    sort_order: index,
  }));
};

/** Pure MASTER row shaping for upsert — no Supabase dependency. */
export function buildPersistedMasterRow(
  record: OfficialFoodImportRecord,
  options?: BuildPersistedMasterRowOptions,
): Record<string, unknown> {
  const nutrients = cleanNutrientsMap(record.nutrients);

  if (record.fiber != null && Number.isFinite(record.fiber)) {
    nutrients.fiber = record.fiber;
  }
  if (record.sodium != null && Number.isFinite(record.sodium)) {
    nutrients.sodium = record.sodium;
  }
  if (record.available_carbs != null && Number.isFinite(record.available_carbs)) {
    nutrients.available_carbs = record.available_carbs;
  }

  const householdMeasures = normalizeHouseholdMeasures(record.household_measures);
  const carbs =
    record.carbs != null && Number.isFinite(record.carbs)
      ? record.carbs
      : (nutrients.available_carbs ?? null);
  const category = normalizeFoodCategory(record.category);

  const row: Record<string, unknown> = {
    nutritionist_id: null,
    review_status: 'approved',
    published_at: new Date().toISOString(),
    name: record.name.trim(),
    category: category || null,
    country: 'PE',
    portion_grams: 100,
    calories: record.calories != null && Number.isFinite(record.calories) ? record.calories : null,
    protein: record.protein != null && Number.isFinite(record.protein) ? record.protein : null,
    carbs,
    fat: record.fat != null && Number.isFinite(record.fat) ? record.fat : null,
    notes: record.notes?.trim() || null,
    household_measures: householdMeasures,
    nutrients,
    fiber: nutrients.fiber ?? null,
    sodium: nutrients.sodium ?? null,
    available_carbs: nutrients.available_carbs ?? null,
    alcohol: nutrients.alcohol ?? null,
    ash: nutrients.ashes ?? null,
    caffeine: nutrients.caffeine ?? null,
    calcium: nutrients.calcium ?? null,
    alpha_carotene: nutrients.alpha_carotene ?? null,
    beta_carotene: nutrients.beta_carotene ?? null,
  };

  if (options?.submittedByUserId) {
    row.submitted_by_nutritionist_id = options.submittedByUserId;
  }

  return row;
}
