import { supabase } from '@/api/supabaseClient';
import { normalizeFoodCategory } from '@/lib/foodCategories';
import { logger } from '@/lib/logger';
import { paginateAll } from '@/lib/supabaseBatch';
import type { OfficialFoodImportRecord } from './parseOfficialFoodsWorkbook';

const IMPORT_FOOD_BATCH_SIZE = 100;
const FOOD_HOUSEHOLD_MEASURE_BATCH_SIZE = 25;

export type ImportMasterFoodsBatchOptions = {
  submittedByUserId?: string;
  onProgress?: (done: number, total: number) => void;
};

export type ImportMasterFoodsBatchResult = {
  insertedCount: number;
  updatedCount: number;
};

type MasterFoodNameRow = {
  id: string;
  name: string;
};

type HouseholdMeasureInput = OfficialFoodImportRecord['household_measures'][number];

type MeasureRow = {
  food_id: string;
  name: string;
  quantity: number;
  weight_grams: number;
  sort_order: number;
};

const normalizeFoodLookupKey = (value: string | null | undefined): string => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error) {
    const message = 'message' in error ? String(error.message ?? '') : '';
    const details = 'details' in error ? String(error.details ?? '') : '';
    const hint = 'hint' in error ? String(error.hint ?? '') : '';
    return [message, details, hint].filter(Boolean).join(' · ');
  }

  return String(error ?? '');
};

const toReadableError = (error: unknown, fallbackMessage: string): Error => {
  const message = getErrorMessage(error).trim();
  return new Error(message || fallbackMessage);
};

const isFoodMeasureTableMissingError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /food_household_measures/i.test(message)
    && /(does not exist|42P01|Could not find the table|schema cache)/i.test(message);
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

const mergeIncomingRecords = (
  previous: OfficialFoodImportRecord,
  incoming: OfficialFoodImportRecord,
): OfficialFoodImportRecord => {
  const measureMap = new Map<string, HouseholdMeasureInput>();
  normalizeHouseholdMeasures(previous.household_measures).forEach((measure) => {
    measureMap.set(normalizeFoodLookupKey(measure.name), measure);
  });
  normalizeHouseholdMeasures(incoming.household_measures).forEach((measure) => {
    measureMap.set(normalizeFoodLookupKey(measure.name), measure);
  });

  return {
    ...incoming,
    household_measures: Array.from(measureMap.values()).map((measure, index) => ({
      ...measure,
      sort_order: index,
    })),
  };
};

const buildPersistedMasterRow = (
  record: OfficialFoodImportRecord,
  options?: ImportMasterFoodsBatchOptions,
): Record<string, unknown> => {
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
  const carbs = Number.isFinite(record.carbs) ? record.carbs : (nutrients.available_carbs ?? null);
  const category = normalizeFoodCategory(record.category);

  const row: Record<string, unknown> = {
    nutritionist_id: null,
    review_status: 'approved',
    published_at: new Date().toISOString(),
    name: record.name.trim(),
    category: category || null,
    country: 'PE',
    portion_grams: 100,
    calories: Number.isFinite(record.calories) ? record.calories : null,
    protein: Number.isFinite(record.protein) ? record.protein : null,
    carbs,
    fat: Number.isFinite(record.fat) ? record.fat : null,
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
};

const loadExistingMastersByName = async (): Promise<Map<string, MasterFoodNameRow>> => {
  const rows = await paginateAll<MasterFoodNameRow>((from, to) =>
    supabase
      .from('foods')
      .select('id, name')
      .is('nutritionist_id', null)
      .order('name', { ascending: true })
      .range(from, to),
  );

  const existingByName = new Map<string, MasterFoodNameRow>();
  rows.forEach((row) => {
    const key = normalizeFoodLookupKey(row.name);
    if (key && !existingByName.has(key)) {
      existingByName.set(key, row);
    }
  });

  return existingByName;
};

/**
 * Upserts MASTER catalog foods only (`nutritionist_id IS NULL`).
 * Matches by normalized name; replaces nutrient + household measure fields.
 * Does not delete masters absent from the batch.
 */
export async function importMasterFoodsBatch(
  foods: OfficialFoodImportRecord[],
  options?: ImportMasterFoodsBatchOptions,
): Promise<ImportMasterFoodsBatchResult> {
  if (foods.length === 0) {
    return { insertedCount: 0, updatedCount: 0 };
  }

  const existingByName = await loadExistingMastersByName();

  const incomingByName = new Map<string, OfficialFoodImportRecord>();
  foods.forEach((record) => {
    const key = normalizeFoodLookupKey(record.name);
    if (!key) {
      return;
    }
    const previous = incomingByName.get(key);
    incomingByName.set(key, previous ? mergeIncomingRecords(previous, record) : record);
  });

  const toInsert: OfficialFoodImportRecord[] = [];
  const toUpdate: Array<OfficialFoodImportRecord & { id: string }> = [];

  for (const [key, record] of incomingByName) {
    const existing = existingByName.get(key);
    if (existing) {
      toUpdate.push({ ...record, id: existing.id });
    } else {
      toInsert.push(record);
    }
  }

  const total = incomingByName.size;
  let done = 0;
  const newFoodIds = new Map<string, string>();

  for (let i = 0; i < toInsert.length; i += IMPORT_FOOD_BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + IMPORT_FOOD_BATCH_SIZE);
    const { data, error } = await supabase
      .from('foods')
      .insert(chunk.map((food) => buildPersistedMasterRow(food, options)))
      .select('id, name');

    if (error) {
      throw toReadableError(
        error,
        `Error insertando alimentos maestros (lote ${Math.floor(i / IMPORT_FOOD_BATCH_SIZE) + 1})`,
      );
    }

    (data as Array<{ id: string; name: string }> | null)?.forEach((row) => {
      const key = normalizeFoodLookupKey(row.name);
      if (key) {
        newFoodIds.set(key, row.id);
      }
    });

    done += chunk.length;
    options?.onProgress?.(done, total);
  }

  for (let i = 0; i < toUpdate.length; i += IMPORT_FOOD_BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + IMPORT_FOOD_BATCH_SIZE);
    const rows = chunk.map((food) => ({
      ...buildPersistedMasterRow(food, options),
      id: food.id,
    }));
    const { error } = await supabase.from('foods').upsert(rows, { onConflict: 'id' });
    if (error) {
      throw toReadableError(
        error,
        `Error actualizando alimentos maestros (lote ${Math.floor(i / IMPORT_FOOD_BATCH_SIZE) + 1})`,
      );
    }

    done += chunk.length;
    options?.onProgress?.(done, total);
  }

  const updatedIds = toUpdate.map((food) => food.id);
  for (let i = 0; i < updatedIds.length; i += IMPORT_FOOD_BATCH_SIZE) {
    const { error } = await supabase
      .from('food_household_measures')
      .delete()
      .in('food_id', updatedIds.slice(i, i + IMPORT_FOOD_BATCH_SIZE));
    if (error && !isFoodMeasureTableMissingError(error)) {
      throw toReadableError(error, 'Error limpiando medidas caseras antiguas.');
    }
  }

  const allMeasures: MeasureRow[] = [];
  const collectMeasures = (food: OfficialFoodImportRecord, foodId: string) => {
    normalizeHouseholdMeasures(food.household_measures).forEach((measure, index) => {
      allMeasures.push({
        food_id: foodId,
        name: measure.name,
        quantity: measure.quantity > 0 ? measure.quantity : 1,
        weight_grams: measure.weight_grams,
        sort_order: measure.sort_order ?? index,
      });
    });
  };

  for (const food of toInsert) {
    const id = newFoodIds.get(normalizeFoodLookupKey(food.name));
    if (id) {
      collectMeasures(food, id);
    }
  }
  for (const food of toUpdate) {
    collectMeasures(food, food.id);
  }

  for (let i = 0; i < allMeasures.length; i += FOOD_HOUSEHOLD_MEASURE_BATCH_SIZE) {
    const { error } = await supabase
      .from('food_household_measures')
      .insert(allMeasures.slice(i, i + FOOD_HOUSEHOLD_MEASURE_BATCH_SIZE));
    if (error && !isFoodMeasureTableMissingError(error)) {
      logger.warn('[importMasterFoodsBatch] Error insertando medidas caseras:', {
        error: error.message,
      });
    }
  }

  return {
    insertedCount: toInsert.length,
    updatedCount: toUpdate.length,
  };
}
