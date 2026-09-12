import { supabase } from '@/api/supabaseClient';
import { getSearchableFoodCountries } from '@/lib/countries';
import { normalizeFoodCategory } from '@/lib/foodCategories';
import { OPTIONAL_NUTRIENTS, scaleFoodNutrientsForPlan, getFoodNutrientValue } from '@/lib/foodNutrients';
import { chunkedIn, paginateAll } from '@/lib/supabaseBatch';
import { logger } from '@/lib/logger';
import { normalizeSearchText } from '@/lib/searchText';

export type DataSource = 'supabase';

export type HouseholdMeasure = {
  id?: string;
  food_id?: string;
  name: string;
  quantity?: number | null;
  weight_grams: number;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FoodNutrientsMap = Record<string, number | null>;

export type CatalogFoodRecord = {
  id: string;
  nutritionist_id?: string | null;
  submitted_by_nutritionist_id?: string | null;
  reviewed_by_nutritionist_id?: string | null;
  review_status?: 'pending' | 'approved' | 'rejected' | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  // Cuando el alimento es una "revisión" de uno ya aprobado, apunta al id del
  // alimento maestro original. null en alimentos normales.
  supersedes_food_id?: string | null;
  name: string;
  category?: string | null;
  // Código ISO 3166-1 alpha-2 ('PE', 'CL', 'US', 'MX', ...) o 'INT' para
  // alimentos universales (USDA, FAO). Permite filtrar la base por país.
  country?: string | null;
  portion_grams?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  notes?: string | null;
  household_measures?: HouseholdMeasure[] | null;
  nutrients?: FoodNutrientsMap | null;
  created_at?: string | null;
  [key: string]: unknown;
};

export type CatalogRecipeRecord = {
  id: string;
  nutritionist_id?: string | null;
  submitted_by_nutritionist_id?: string | null;
  reviewed_by_nutritionist_id?: string | null;
  review_status?: 'pending' | 'approved' | 'rejected' | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  published_at?: string | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  source?: string | null;
  // País de origen (ISO alpha-2 o 'INT'). Solo etiqueta/priorización en comunidad.
  country?: string | null;
  difficulty?: string | null;
  prep_time?: number | null;
  cook_time?: number | null;
  created_by?: string | null;
  author_name?: string | null;
  calories_per_serving?: number | null;
  protein_per_serving?: number | null;
  carbs_per_serving?: number | null;
  fat_per_serving?: number | null;
  fiber_per_serving?: number | null;
  ingredients?: Record<string, unknown>[];
  instructions?: string | null;
  servings?: number | null;
  created_at?: string | null;
  [key: string]: unknown;
};

const BASE_FOOD_COLUMNS = new Set([
  'nutritionist_id',
  'submitted_by_nutritionist_id',
  'reviewed_by_nutritionist_id',
  'review_status',
  'review_notes',
  'reviewed_at',
  'published_at',
  'supersedes_food_id',
  'name',
  'category',
  'country',
  'portion_grams',
  'calories',
  'protein',
  'carbs',
  'fat',
  'notes',
]);

const DIRECT_NUTRIENT_COLUMN_MAP: Record<string, string> = {
  alcohol: 'alcohol',
  ashes: 'ash',
  caffeine: 'caffeine',
  calcium: 'calcium',
  available_carbs: 'available_carbs',
  alpha_carotene: 'alpha_carotene',
  beta_carotene: 'beta_carotene',
  fiber: 'fiber',
  sodium: 'sodium',
};

const REMOTE_TO_LOCAL_NUTRIENT_KEY_MAP: Record<string, string> = {
  ash: 'ashes',
};

const FOOD_HOUSEHOLD_MEASURE_COLUMNS = 'id,food_id,name,quantity,weight_grams,sort_order,created_at,updated_at';

const FOOD_COLUMNS = [
  'id', 'nutritionist_id', 'submitted_by_nutritionist_id', 'reviewed_by_nutritionist_id',
  'review_status', 'review_notes', 'reviewed_at', 'published_at', 'supersedes_food_id',
  'name', 'category', 'country', 'portion_grams',
  'calories', 'protein', 'carbs', 'fat', 'notes',
  'nutrients', 'household_measures',
  'alcohol', 'ash', 'caffeine', 'calcium', 'available_carbs',
  'alpha_carotene', 'beta_carotene', 'fiber', 'sodium',
  'created_at',
].join(',');

// Columnas para la LISTA/prefetch del buscador: FOOD_COLUMNS SIN el JSON
// `nutrients`, que es la columna más pesada (~61% del payload y ~1.6 KB/fila).
// La lista solo muestra nombre + macros y las filtros de cliente solo leen
// country/nutritionist_id/review_status/household_measures, así que el perfil
// completo de micronutrientes NO hace falta hasta que el alimento se agrega a
// una dieta (ahí se hidrata con getFoodById). Los registros ligeros se marcan
// con `_lite: true` en el prefetch para saber cuándo hidratar.
export const FOOD_LIST_COLUMNS = FOOD_COLUMNS
  .split(',')
  .filter((column) => column !== 'nutrients')
  .join(',');

const RECIPE_COLUMNS = [
  'id', 'nutritionist_id', 'submitted_by_nutritionist_id', 'reviewed_by_nutritionist_id',
  'review_status', 'review_notes', 'reviewed_at', 'published_at',
  'name', 'description', 'image_url', 'category',
  'source', 'country', 'difficulty', 'prep_time', 'cook_time', 'created_by', 'author_name',
  'calories_per_serving', 'protein_per_serving', 'carbs_per_serving',
  'fat_per_serving', 'fiber_per_serving',
  'ingredients', 'instructions', 'servings', 'created_at',
].join(',');
const FOOD_HOUSEHOLD_MEASURE_BATCH_SIZE = 25;

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

const hasMeaningfulValue = (value: unknown): boolean => {
  if (value == null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value)
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.');

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toOptionalString = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeNutrientsMap = (value: unknown): FoodNutrientsMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<FoodNutrientsMap>((accumulator, [rawKey, rawValue]) => {
    const normalizedKey = REMOTE_TO_LOCAL_NUTRIENT_KEY_MAP[rawKey] ?? rawKey;
    const parsedValue = toOptionalNumber(rawValue);

    if (parsedValue != null) {
      accumulator[normalizedKey] = parsedValue;
    }

    return accumulator;
  }, {});
};

const extractFoodNutrients = (payload: CatalogFoodRecord): FoodNutrientsMap => {
  const nutrients = normalizeNutrientsMap(payload.nutrients);

  OPTIONAL_NUTRIENTS.forEach((nutrient) => {
    if (!Object.prototype.hasOwnProperty.call(payload, nutrient.key)) {
      return;
    }

    const parsedValue = toOptionalNumber(payload[nutrient.key]);
    if (parsedValue == null) {
      delete nutrients[nutrient.key];
      return;
    }

    nutrients[nutrient.key] = parsedValue;
  });

  return nutrients;
};

const normalizeHouseholdMeasure = (value: unknown): HouseholdMeasure | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawMeasure = value as Record<string, unknown>;
  const name = String(rawMeasure.name ?? '').trim();
  const weightGrams = toOptionalNumber(rawMeasure.weight_grams);

  if (weightGrams === null || !Number.isFinite(weightGrams) || weightGrams <= 0 || !name) {
    return null;
  }

  const quantity = toOptionalNumber(rawMeasure.quantity);
  const sortOrder = toOptionalNumber(rawMeasure.sort_order);

  return {
    id: typeof rawMeasure.id === 'string' ? rawMeasure.id : undefined,
    food_id: typeof rawMeasure.food_id === 'string' ? rawMeasure.food_id : undefined,
    name,
    quantity: quantity && quantity > 0 ? quantity : 1,
    weight_grams: weightGrams as number,
    sort_order: sortOrder,
    created_at: typeof rawMeasure.created_at === 'string' ? rawMeasure.created_at : null,
    updated_at: typeof rawMeasure.updated_at === 'string' ? rawMeasure.updated_at : null,
  };
};

const normalizeHouseholdMeasures = (value: unknown): HouseholdMeasure[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const measures = value
    .map((measure) => normalizeHouseholdMeasure(measure))
    .filter((measure): measure is HouseholdMeasure => measure != null);

  const dedupedMeasures = new Map<string, HouseholdMeasure>();

  measures.forEach((measure) => {
    const normalizedName = normalizeFoodLookupKey(measure.name);
    if (!normalizedName) {
      return;
    }

    dedupedMeasures.set(normalizedName, measure);
  });

  return dedupedMeasures.size > 0 ? Array.from(dedupedMeasures.values()) : null;
};

const mergeHouseholdMeasures = (
  baseMeasures?: CatalogFoodRecord['household_measures'],
  incomingMeasures?: CatalogFoodRecord['household_measures'],
): HouseholdMeasure[] | null => {
  const merged = new Map<string, HouseholdMeasure>();

  const appendMeasures = (measures?: CatalogFoodRecord['household_measures']) => {
    measures?.forEach((measure) => {
      const normalizedName = normalizeFoodLookupKey(measure?.name);
      if (!normalizedName) return;
      if (!Number.isFinite(measure.weight_grams) || measure.weight_grams <= 0) return;

      merged.set(normalizedName, {
        id: measure.id,
        food_id: measure.food_id,
        name: measure.name.trim(),
        quantity: measure.quantity && measure.quantity > 0 ? measure.quantity : 1,
        weight_grams: measure.weight_grams,
        sort_order: measure.sort_order ?? null,
        created_at: measure.created_at ?? null,
        updated_at: measure.updated_at ?? null,
      });
    });
  };

  // Las filas repetidas del Excel representan medidas caseras adicionales del mismo alimento.
  appendMeasures(baseMeasures);
  appendMeasures(incomingMeasures);

  return merged.size > 0 ? Array.from(merged.values()) : null;
};

const mergeFoodRecords = (baseRecord: CatalogFoodRecord, incomingRecord: CatalogFoodRecord): CatalogFoodRecord => {
  const mergedRecord = {
    ...baseRecord,
    nutrients: {
      ...normalizeNutrientsMap(baseRecord.nutrients),
      ...normalizeNutrientsMap(incomingRecord.nutrients),
    },
  } as CatalogFoodRecord;

  Object.entries(incomingRecord).forEach(([key, value]) => {
    if (key === 'household_measures' || key === 'nutrients') {
      return;
    }

    if (hasMeaningfulValue(value)) {
      mergedRecord[key] = value;
    }
  });

  mergedRecord.household_measures = mergeHouseholdMeasures(
    baseRecord.household_measures,
    incomingRecord.household_measures,
  );

  return mergedRecord;
};

const buildPersistedFoodFields = (payload: CatalogFoodRecord): Record<string, unknown> => {
  const {
    id: _ignoredId,
    created_at: _ignoredCreatedAt,
    household_measures: _ignoredMeasures,
    nutrients: _ignoredNutrients,
    ...persistedPayload
  } = payload;

  const nutrients = extractFoodNutrients(payload);
  const householdMeasures = normalizeHouseholdMeasures(payload.household_measures) ?? [];
  const carbs = toOptionalNumber(payload.carbs) ?? nutrients.available_carbs ?? null;
  const normalizedCategory = normalizeFoodCategory(toOptionalString(payload.category));

  return {
    ...Object.fromEntries(
      Object.entries(persistedPayload).filter(([key]) => BASE_FOOD_COLUMNS.has(key)),
    ),
    category: normalizedCategory || null,
    portion_grams: toOptionalNumber(payload.portion_grams) ?? 100,
    calories: toOptionalNumber(payload.calories),
    protein: toOptionalNumber(payload.protein),
    carbs,
    fat: toOptionalNumber(payload.fat),
    household_measures: householdMeasures,
    nutrients,
    alcohol: nutrients.alcohol ?? null,
    ash: nutrients.ashes ?? null,
    caffeine: nutrients.caffeine ?? null,
    calcium: nutrients.calcium ?? null,
    available_carbs: nutrients.available_carbs ?? null,
    alpha_carotene: nutrients.alpha_carotene ?? null,
    beta_carotene: nutrients.beta_carotene ?? null,
    fiber: nutrients.fiber ?? null,
    sodium: nutrients.sodium ?? null,
  };
};

const normalizeFoodRecord = (
  value: Record<string, unknown>,
  measuresByFoodId?: Map<string, HouseholdMeasure[]>,
): CatalogFoodRecord => {
  const nutrients = normalizeNutrientsMap(value.nutrients);

  // Algunos entornos exponen nutrientes como jsonb y otros además como columnas planas.
  // Rehidratar ambos evita perder datos tras importar y volver a consultar el catálogo.
  OPTIONAL_NUTRIENTS.forEach((nutrient) => {
    if (nutrients[nutrient.key] != null) {
      return;
    }

    const remoteKey = DIRECT_NUTRIENT_COLUMN_MAP[nutrient.key] ?? nutrient.key;
    const parsedValue = toOptionalNumber(value[remoteKey]);
    if (parsedValue != null) {
      nutrients[nutrient.key] = parsedValue;
    }
  });

  const fallbackMeasures = normalizeHouseholdMeasures(value.household_measures);
  const linkedMeasures = typeof value.id === 'string' ? measuresByFoodId?.get(value.id) : null;
  const householdMeasures = linkedMeasures ?? fallbackMeasures;
  const calories = toOptionalNumber(value.calories) ?? nutrients.calories_kj ?? null;
  const protein = toOptionalNumber(value.protein);
  const carbs = toOptionalNumber(value.carbs) ?? nutrients.available_carbs ?? null;
  const fat = toOptionalNumber(value.fat);

  const {
    food_household_measures: _ignoredFoodHouseholdMeasures,
    household_measures: _ignoredLegacyMeasures,
    nutrients: _ignoredNutrients,
    ash: _ignoredAsh,
    ...rest
  } = value;

  return {
    ...(rest as CatalogFoodRecord),
    calories,
    protein,
    carbs,
    fat,
    household_measures: householdMeasures,
    nutrients,
    ...nutrients,
  };
};

const loadFoodHouseholdMeasures = async (foodIds: string[]): Promise<Map<string, HouseholdMeasure[]> | null> => {
  const uniqueFoodIds = Array.from(new Set(foodIds.filter(Boolean)));

  if (uniqueFoodIds.length === 0) {
    return new Map<string, HouseholdMeasure[]>();
  }

  // chunkedIn divide los UUID en lotes de tamaño seguro para evitar que la URL
  // del `.in(...)` exceda el límite práctico de PostgREST (incidente 2026-04-18).
  // Si la tabla de medidas aún no existe (migración pendiente) devolvemos null
  // para que el caller degrade hacia la columna legacy household_measures.
  let tableMissing = false;

  const rows = await chunkedIn<Record<string, unknown>>(
    uniqueFoodIds,
    async (batch) => {
      const result = await supabase
        .from('food_household_measures')
        .select(FOOD_HOUSEHOLD_MEASURE_COLUMNS)
        .in('food_id', batch)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (result.error && isFoodMeasureTableMissingError(result.error)) {
        tableMissing = true;
        return { data: [], error: null };
      }

      return result;
    },
    FOOD_HOUSEHOLD_MEASURE_BATCH_SIZE,
  );

  if (tableMissing) {
    return null;
  }

  return rows.reduce<Map<string, HouseholdMeasure[]>>((accumulator, row) => {
    const measure = normalizeHouseholdMeasure(row);
    if (!measure?.food_id) {
      return accumulator;
    }

    const currentMeasures = accumulator.get(measure.food_id) ?? [];
    currentMeasures.push(measure);
    accumulator.set(measure.food_id, currentMeasures);
    return accumulator;
  }, new Map<string, HouseholdMeasure[]>());
};

const syncFoodHouseholdMeasures = async (foodId: string, measures: HouseholdMeasure[] | null): Promise<void> => {
  try {
    const { error: deleteError } = await supabase.from('food_household_measures').delete().eq('food_id', foodId);
    if (deleteError) {
      // Lite Calc guarda medidas en foods.household_measures (jsonb); la tabla
      // auxiliar del SaaS puede no existir.
      return;
    }

    if (!measures || measures.length === 0) {
      return;
    }

    const rows = measures.map((measure, index) => ({
      food_id: foodId,
      name: measure.name,
      quantity: measure.quantity && measure.quantity > 0 ? measure.quantity : 1,
      weight_grams: measure.weight_grams,
      sort_order: index,
    }));

    const { error: insertError } = await supabase.from('food_household_measures').insert(rows);
    if (insertError) {
      return;
    }
  } catch {
    // ignore — jsonb column is enough for calc
  }
};

const stripPersistedRecipeFields = (payload: CatalogRecipeRecord): Omit<CatalogRecipeRecord, 'id' | 'created_at'> => {
  const { id: _ignoredId, created_at: _ignoredCreatedAt, ...persistedPayload } = payload;
  return persistedPayload;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- query builder genérico que funciona con cualquier tabla de Supabase
const scopeByNutritionist = (query: any, nutritionistId?: string) => {
  return nutritionistId ? query.eq('nutritionist_id', nutritionistId) : query;
};

// "Mis recetas": incluye las que el nutricionista ENVIÓ, aunque ya estén aprobadas.
// Al aprobar una receta pública el trigger pone nutritionist_id = null, así que
// filtrar por nutritionist_id la haría desaparecer del catálogo propio. Se usa
// submitted_by_nutritionist_id, que se conserva tras la aprobación.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mismo motivo que scopeByNutritionist
const scopeByRecipeSubmitter = (query: any, nutritionistId?: string) => {
  return nutritionistId ? query.eq('submitted_by_nutritionist_id', nutritionistId) : query;
};

const withTenantOwnership = <T extends { nutritionist_id?: string | null }>(
  payload: T,
  nutritionistId?: string,
): T => {
  if (!nutritionistId) {
    return payload;
  }

  return {
    ...payload,
    nutritionist_id: payload.nutritionist_id || nutritionistId,
  };
};

// Cuando el caller no pide un límite explícito, paginamos contra PostgREST
// para no quedar silenciosamente capados por el cutoff por defecto de 1000
// filas. Con `limit` explícito asumimos que el caller ya sabe el rango que
// necesita (ej. autocompletes).
/**
 * Obtiene alimentos paginados y filtrados por búsqueda desde el backend.
 * @param nutritionistId - Si se pasa, filtra por alimentos privados de ese nutricionista.
 * @param options - { limit, offset, searchTerm }
 */
export const listFoods = async (
  nutritionistId?: string,
  options?: { limit?: number; offset?: number; searchTerm?: string; includeMasterCatalog?: boolean; country?: string | null; includeAllReviewStatuses?: boolean; scopeBySubmitter?: boolean }
): Promise<{ data: CatalogFoodRecord[]; source: DataSource }> => {
  let query = supabase
    .from('foods')
    .select(FOOD_LIST_COLUMNS)
    .order('name', { ascending: true });

  if (options?.searchTerm?.trim()) {
    query = query.ilike('name', `%${options.searchTerm.trim()}%`);
  }

  // Mis Alimentos: solo los del nutricionista (propios o enviados por él).
  if (nutritionistId && options?.scopeBySubmitter) {
    query = query.or(
      `nutritionist_id.eq.${nutritionistId},submitted_by_nutritionist_id.eq.${nutritionistId}`,
    );
  } else if (nutritionistId && !options?.includeMasterCatalog) {
    query = query.eq('nutritionist_id', nutritionistId);
  }

  const from = options?.offset || 0;
  if (typeof options?.limit === 'number') {
    query = query.range(from, from + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return {
    data: ((data as Record<string, unknown>[]) || []).map((food) => normalizeFoodRecord(food)),
    source: 'supabase',
  };
};

export const listAccessibleFoods = async (limit?: number, columns: string = FOOD_LIST_COLUMNS): Promise<{ data: CatalogFoodRecord[]; source: DataSource }> => {
  // Con límite: una sola página (autocomplete). Sin límite: paginar todo el
  // catálogo — PostgREST corta en 1000 si no usamos range.
  if (typeof limit === 'number') {
    const { data, error } = await supabase
      .from('foods')
      .select(columns)
      .order('name', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return {
      data: ((data as Record<string, unknown>[]) || []).map((food) => normalizeFoodRecord(food)),
      source: 'supabase',
    };
  }

  const rows = await paginateAll<Record<string, unknown>>((from, to) =>
    supabase
      .from('foods')
      .select(columns)
      .order('name', { ascending: true })
      .range(from, to),
  );

  return {
    data: rows.map((food) => normalizeFoodRecord(food)),
    source: 'supabase',
  };
};

export const getFoodById = async (id: string, _nutritionistId?: string): Promise<{ data: CatalogFoodRecord | null; source: DataSource }> => {
  const { data, error } = await supabase
    .from('foods')
    .select(FOOD_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { data: null, source: 'supabase' };
  return {
    data: normalizeFoodRecord(data as Record<string, unknown>),
    source: 'supabase',
  };
};

// Hidrata el perfil completo de micronutrientes de un alimento que vino del
// prefetch LIGERO (marcado con `_lite`, sin la columna `nutrients`). Devuelve el
// registro COMPLETO y normalizado listo para agregar a una dieta/receta/recall.
// Falla suave: si no es ligero, o la consulta no responde, devuelve el mismo
// registro recibido (macros correctos, micros parciales) para no bloquear al
// usuario. El caller re-procesa el registro devuelto con su propia vista.
export const hydrateFoodNutrients = async (
  food: (CatalogFoodRecord & { _lite?: boolean }) | null | undefined,
  nutritionistId?: string,
): Promise<CatalogFoodRecord | null | undefined> => {
  if (!food?._lite || !food.id) return food;
  try {
    const { data } = await getFoodById(food.id, nutritionistId);
    return data ?? food;
  } catch {
    return food;
  }
};

export const saveFood = async (payload: CatalogFoodRecord, id?: string, nutritionistId?: string): Promise<{ data: CatalogFoodRecord; source: DataSource }> => {
  const normalizedMeasures = normalizeHouseholdMeasures(payload.household_measures);
  // Cuando NO viene nutritionistId asumimos que el caller es el panel admin
  // (importación masiva o creación manual desde catalogo maestro). En ese
  // caso marcamos el alimento como aprobado/publicado para que sea visible
  // de inmediato a todos los clientes (catálogo maestro). El trigger
  // apply_food_review_workflow detecta que el actor es admin + approved y
  // setea published_at=now() y nutritionist_id=null automáticamente.
  // Cuando hay nutritionistId, el alimento es del nutricionista (privado +
  // pending) hasta que el admin lo apruebe en la bandeja de revisión.
  // Si el alimento es privado (nutritionistId presente) y está rechazado, al editarlo vuelve a pending
  let adjustedPayload: CatalogFoodRecord;
  if (!nutritionistId) {
    adjustedPayload = { ...payload, review_status: payload.review_status || 'approved' };
  } else {
    // Si el alimento estaba rechazado, al editarlo vuelve a pending
    if (payload.review_status === 'rejected') {
      adjustedPayload = { ...payload, review_status: 'pending', review_notes: null };
    } else {
      // Alimento personal: forzamos 'pending' explícito. La columna tiene
      // default 'approved', así que si el actor es admin el trigger publicaría
      // el alimento al maestro (nutritionist_id=null) y desaparecería de "Mis
      // Alimentos". Con 'pending' el alimento se conserva como privado del
      // nutricionista (incluido un admin) hasta que se apruebe desde el panel.
      adjustedPayload = { ...payload, review_status: payload.review_status || 'pending' };
    }
  }
  const persistedPayload = withTenantOwnership(buildPersistedFoodFields(adjustedPayload), nutritionistId);

  if (id) {
    const { data, error } = await scopeByNutritionist(
      supabase.from('foods').update(persistedPayload).eq('id', id),
      nutritionistId,
    ).select(FOOD_COLUMNS).single();
    if (error) {
      throw toReadableError(error, 'No se pudo actualizar el alimento en Supabase.');
    }

    if (!data) {
      throw new Error('Supabase no devolvió el alimento actualizado. Revisa los permisos de edición para este registro.');
    }

    await syncFoodHouseholdMeasures(id, normalizedMeasures);

    return {
      data: normalizeFoodRecord(
        {
          ...(data as Record<string, unknown>),
          household_measures: normalizedMeasures,
          nutrients: persistedPayload.nutrients,
        },
      ),
      source: 'supabase',
    };
  } else {
    const { data, error } = await supabase.from('foods').insert([persistedPayload]).select(FOOD_COLUMNS).single();
    if (error) {
      throw toReadableError(error, 'No se pudo crear el alimento en Supabase.');
    }

    if (!data) {
      throw new Error('Supabase no devolvió el alimento recién creado.');
    }

    const row = data as unknown as Record<string, unknown>;
    await syncFoodHouseholdMeasures(String(row.id), normalizedMeasures);

    return {
      data: normalizeFoodRecord({
        ...row,
        household_measures: normalizedMeasures,
        nutrients: persistedPayload.nutrients,
      }),
      source: 'supabase',
    };
  }
};

// Crea una "revisión" de un alimento YA APROBADO: una copia propia del
// nutricionista (pending) enlazada al maestro original vía supersedes_food_id.
// No toca el alimento maestro; el admin decide si la fusiona al aprobarla.
// Se usa cuando el nutri edita un aprobado (que tiene nutritionist_id = null y
// por RLS no puede modificar directamente).
export const createFoodRevision = async (
  payload: CatalogFoodRecord,
  originalFoodId: string,
  nutritionistId: string,
): Promise<{ data: CatalogFoodRecord; source: DataSource }> => {
  const normalizedMeasures = normalizeHouseholdMeasures(payload.household_measures);
  const revisionPayload: CatalogFoodRecord = {
    ...payload,
    review_status: 'pending',
    review_notes: null,
    supersedes_food_id: originalFoodId,
  };
  const persistedPayload = withTenantOwnership(buildPersistedFoodFields(revisionPayload), nutritionistId);
  // buildPersistedFoodFields descarta `id`; supersedes_food_id sí se conserva
  // porque está en BASE_FOOD_COLUMNS.

  const { data, error } = await supabase.from('foods').insert([persistedPayload]).select(FOOD_COLUMNS).single();
  if (error) {
    throw toReadableError(error, 'No se pudo crear la revisión del alimento.');
  }
  if (!data) {
    throw new Error('Supabase no devolvió la revisión recién creada.');
  }

  const row = data as unknown as Record<string, unknown>;
  await syncFoodHouseholdMeasures(String(row.id), normalizedMeasures);

  return {
    data: normalizeFoodRecord({
      ...row,
      household_measures: normalizedMeasures,
      nutrients: persistedPayload.nutrients,
    }),
    source: 'supabase',
  };
};

// Aprueba una revisión: el RPC fusiona sus valores sobre el alimento maestro
// original (conservando su id) y retira la revisión. Solo admins (validado en
// el RPC). Devuelve el id del alimento maestro actualizado.
export const approveFoodRevision = async (revisionId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('approve_food_revision', { p_revision_id: revisionId });
  if (error) {
    throw toReadableError(error, 'No se pudo aprobar la revisión del alimento.');
  }
  return (data as string) ?? '';
};

// "Quitar de mi lista": el autor oculta un alimento aprobado de su vista de
// "Mis Alimentos" sin borrarlo del catálogo maestro (sigue en la comunidad y
// en el buscador de dietas). En Lite Calc no hay RPC: si es propio se borra;
// si es maestro se guarda oculto en localStorage.
const hiddenMyFoodsKey = (userId: string) => `ng_calc_hidden_my_foods_${userId}`;

export const readHiddenMyFoodIds = (userId: string): Set<string> => {
  try {
    const raw = localStorage.getItem(hiddenMyFoodsKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
};

const persistHiddenMyFoodId = (userId: string, foodId: string): void => {
  const next = readHiddenMyFoodIds(userId);
  next.add(foodId);
  localStorage.setItem(hiddenMyFoodsKey(userId), JSON.stringify([...next]));
};

export const hideFoodFromMyList = async (foodId: string, userId?: string): Promise<void> => {
  const { data: row, error: readError } = await supabase
    .from('foods')
    .select('id, nutritionist_id')
    .eq('id', foodId)
    .maybeSingle();

  if (readError) {
    throw toReadableError(readError, 'No se pudo quitar el alimento de tu lista.');
  }

  // Maestro / comunidad: no borrar; ocultar solo en esta cuenta.
  if (!row?.nutritionist_id) {
    if (userId) persistHiddenMyFoodId(userId, foodId);
    return;
  }

  const { error } = await supabase.from('foods').delete().eq('id', foodId);
  if (error) {
    throw toReadableError(error, 'No se pudo quitar el alimento de tu lista.');
  }
};

// Tamaño de lote para batch inserts/updates en la importación masiva.
// 100 filas por request = ~30 requests para 3 000 alimentos (vs 3 000 individuales).
const IMPORT_FOOD_BATCH_SIZE = 100;

export const importFoodsBatch = async (
  payload: CatalogFoodRecord[],
  nutritionistId?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ insertedCount: number; updatedCount: number; source: DataSource }> => {
  if (payload.length === 0) return { insertedCount: 0, updatedCount: 0, source: 'supabase' };

  // ── 1. Fetch existing foods once ──────────────────────────────────────────
  const existingResult = await listFoods(nutritionistId);
  const existingByName = new Map<string, CatalogFoodRecord>();
  existingResult.data.forEach(f => {
    const k = normalizeFoodLookupKey(f.name);
    if (k && !existingByName.has(k)) existingByName.set(k, f);
  });

  // ── 2. Deduplicate incoming (múltiples filas = misma medida casera) ───────
  const incomingByName = new Map<string, CatalogFoodRecord>();
  payload.forEach(record => {
    const k = normalizeFoodLookupKey(record.name);
    if (!k) return;
    const prev = incomingByName.get(k);
    incomingByName.set(k, prev ? mergeFoodRecords(prev, record) : record);
  });

  const total = incomingByName.size;
  let done = 0;

  // ── 3. Separar: nuevos vs existentes ─────────────────────────────────────
  const toInsert: CatalogFoodRecord[] = [];
  const toUpdate: CatalogFoodRecord[] = [];
  for (const [k, record] of incomingByName) {
    const ex = existingByName.get(k);
    if (ex) toUpdate.push({ ...record, id: ex.id, created_at: ex.created_at });
    else toInsert.push(record);
  }

  // Usa la misma lógica de saveFood para construir el payload de DB
  const buildRow = (food: CatalogFoodRecord): Record<string, unknown> => {
    const adjusted = !nutritionistId
      ? { ...food, review_status: food.review_status ?? 'approved' }
      : food;
    return withTenantOwnership(buildPersistedFoodFields(adjusted), nutritionistId);
  };

  // ── 4. Batch INSERT nuevos → recuperar IDs asignados ─────────────────────
  const newFoodIds = new Map<string, string>(); // normalizedName → uuid

  for (let i = 0; i < toInsert.length; i += IMPORT_FOOD_BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + IMPORT_FOOD_BATCH_SIZE);
    const { data, error } = await supabase
      .from('foods')
      .insert(chunk.map(buildRow))
      .select('id, name');
    if (error) throw toReadableError(error, `Error insertando alimentos (lote ${Math.floor(i / IMPORT_FOOD_BATCH_SIZE) + 1})`);
    (data as Array<{ id: string; name: string }>).forEach(row => {
      const k = normalizeFoodLookupKey(row.name);
      if (k) newFoodIds.set(k, row.id);
    });
    done += chunk.length;
    onProgress?.(done, total);
  }

  // ── 5. Batch UPSERT existentes (conflict por id) ──────────────────────────
  for (let i = 0; i < toUpdate.length; i += IMPORT_FOOD_BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + IMPORT_FOOD_BATCH_SIZE);
    const rows = chunk.map(f => ({ ...buildRow(f), id: f.id }));
    const { error } = await supabase.from('foods').upsert(rows, { onConflict: 'id' });
    if (error) throw toReadableError(error, `Error actualizando alimentos (lote ${Math.floor(i / IMPORT_FOOD_BATCH_SIZE) + 1})`);
    done += chunk.length;
    onProgress?.(done, total);
  }

  // ── 6. Medidas caseras: delete batch + insert batch ───────────────────────
  // Borrar medidas antiguas de los alimentos actualizados
  const updatedIds = toUpdate.map(f => f.id).filter((id): id is string => !!id);
  for (let i = 0; i < updatedIds.length; i += IMPORT_FOOD_BATCH_SIZE) {
    const { error } = await supabase
      .from('food_household_measures')
      .delete()
      .in('food_id', updatedIds.slice(i, i + IMPORT_FOOD_BATCH_SIZE));
    if (error && !isFoodMeasureTableMissingError(error)) {
      throw toReadableError(error, 'Error limpiando medidas caseras antiguas.');
    }
  }

  // Recolectar todas las medidas nuevas
  type MeasureRow = { food_id: string; name: string; quantity: number; weight_grams: number; sort_order: number };
  const allMeasures: MeasureRow[] = [];
  const collectMeasures = (food: CatalogFoodRecord, foodId: string) => {
    (normalizeHouseholdMeasures(food.household_measures) ?? []).forEach((m, idx) => {
      allMeasures.push({
        food_id: foodId,
        name: m.name,
        quantity: (m.quantity ?? 0) > 0 ? (m.quantity as number) : 1,
        weight_grams: m.weight_grams,
        sort_order: m.sort_order ?? idx,
      });
    });
  };
  for (const food of toInsert) {
    const id = newFoodIds.get(normalizeFoodLookupKey(food.name) ?? '');
    if (id) collectMeasures(food, id);
  }
  for (const food of toUpdate) {
    if (food.id) collectMeasures(food, food.id);
  }

  for (let i = 0; i < allMeasures.length; i += FOOD_HOUSEHOLD_MEASURE_BATCH_SIZE) {
    const { error } = await supabase
      .from('food_household_measures')
      .insert(allMeasures.slice(i, i + FOOD_HOUSEHOLD_MEASURE_BATCH_SIZE));
    if (error && !isFoodMeasureTableMissingError(error)) {
      logger.warn('[importFoodsBatch] Error insertando medidas caseras:', { error: error.message });
    }
  }

  return { insertedCount: toInsert.length, updatedCount: toUpdate.length, source: 'supabase' };
};

export const deleteFoodById = async (id: string, nutritionistId?: string): Promise<DataSource> => {
  // .select('id') nos devuelve las filas realmente borradas. Sin esto, si RLS
  // bloquea el borrado (p. ej. un no-admin intentando eliminar un alimento del
  // catálogo maestro con nutritionist_id=null), PostgREST no da error: borra 0
  // filas en silencio y la UI mostraba "eliminado" en falso. Verificamos y
  // lanzamos un error claro cuando no se borró nada.
  const { data, error } = await scopeByNutritionist(
    supabase.from('foods').delete().eq('id', id),
    nutritionistId,
  ).select('id');
  if (error) {
    throw error;
  }
  if (!data || (data as unknown[]).length === 0) {
    throw new Error('No se pudo eliminar el alimento: no existe o no tienes permisos para borrarlo.');
  }

  return 'supabase';
};

export const updateFoodReview = async (
  id: string,
  input: Pick<CatalogFoodRecord, 'review_status' | 'review_notes'>,
): Promise<{ data: CatalogFoodRecord; source: DataSource }> => {
  // Defense-in-depth: el trigger apply_food_review_workflow ya nulifica
  // nutritionist_id cuando un admin aprueba (catálogo maestro compartido),
  // pero enviamos el nulo explícito para que el alimento se vea en cuanto
  // termine el UPDATE aunque el trigger no esté actualizado todavía.
  const reviewPayload: Record<string, unknown> = {
    review_status: input.review_status,
    review_notes: input.review_notes ?? null,
    reviewed_at: new Date().toISOString(),
  };
  if (input.review_status === 'approved') {
    reviewPayload.nutritionist_id = null;
  }

  const { data, error } = await supabase
    .from('foods')
    .update(reviewPayload)
    .eq('id', id)
    .select(FOOD_COLUMNS)
    .single();

  if (error) {
    throw error;
  }

  return { data: data as unknown as CatalogFoodRecord, source: 'supabase' };
};

const REVIEW_QUEUE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Bandeja Maestro: pendientes / rechazados (rechazados solo últimos 30 días). */
export const listReviewQueueFoods = async (params: {
  status: 'pending' | 'rejected';
  page?: number;
  pageSize?: number;
  searchTerm?: string;
}): Promise<{ data: CatalogFoodRecord[]; total: number; page: number; pageSize: number }> => {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? 50;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('foods')
    .select(FOOD_COLUMNS, { count: 'exact' })
    .eq('review_status', params.status)
    .not('nutritionist_id', 'is', null)
    .order(params.status === 'rejected' ? 'reviewed_at' : 'created_at', { ascending: false })
    .range(from, to);

  if (params.status === 'rejected') {
    const since = new Date(Date.now() - REVIEW_QUEUE_RETENTION_MS).toISOString();
    query = query.gte('reviewed_at', since);
  }

  if (params.searchTerm?.trim()) {
    query = query.ilike('name', `%${params.searchTerm.trim()}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const rows = (data as Record<string, unknown>[]) || [];
  const measuresByFoodId = await loadFoodHouseholdMeasures(
    rows.map((food) => String(food.id ?? '')).filter(Boolean),
  );

  return {
    data: rows.map((food) => normalizeFoodRecord(food, measuresByFoodId ?? undefined)),
    total: count ?? 0,
    page,
    pageSize,
  };
};

/**
 * Maestro corrige e incorpora: inserta copia en catálogo maestro y deja el
 * original del nutri como privado rechazado (pueden coexistir dos con mismo nombre).
 */
export const incorporateEditedFood = async (
  sourceId: string,
  editedPayload: CatalogFoodRecord,
  reviewNotes?: string | null,
): Promise<{ master: CatalogFoodRecord; source: CatalogFoodRecord }> => {
  const { id: _omitId, nutritionist_id: _omitOwner, ...rest } = editedPayload;
  const { data: master } = await saveFood(
    {
      ...rest,
      review_status: 'approved',
      nutritionist_id: null,
    },
    undefined,
    undefined,
  );

  const { data: source } = await updateFoodReview(sourceId, {
    review_status: 'rejected',
    review_notes: reviewNotes?.trim() || 'Incorporado con correcciones',
  });

  return { master, source };
};

export const listRecipes = async (_nutritionistId?: string, _limit?: number): Promise<{ data: CatalogRecipeRecord[]; source: DataSource }> => {
  // Lite Calc: sin backend de recetas.
  return { data: [], source: 'supabase' };
};

// Paginación server-side con .range() y conteo total en una sola request.
// Devuelve la página solicitada y el total para que la UI pueda renderizar
// controles "Anterior / Siguiente" o "Página X de N" sin pedir el conteo aparte.
// Patrón replicable para foods, patients, etc. — mismo shape de retorno.
export const listRecipesPaginated = async (params: {
  nutritionistId?: string;
  page: number;
  pageSize: number;
  searchTerm?: string;
  reviewStatus?: 'all' | 'pending' | 'approved' | 'rejected';
}): Promise<{ data: CatalogRecipeRecord[]; total: number; page: number; pageSize: number }> => {
  const { nutritionistId, page, pageSize, searchTerm, reviewStatus = 'all' } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mismo motivo que listFoods
  let query: any = supabase
    .from('recipes')
    .select(RECIPE_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchTerm && searchTerm.trim()) {
    query = query.ilike('name', `%${searchTerm.trim()}%`);
  }

  if (reviewStatus !== 'all') {
    query = query.eq('review_status', reviewStatus);
  }

  const scopedQuery = scopeByNutritionist(query, nutritionistId);
  const { data, count, error } = await scopedQuery;
  if (error) {
    throw error;
  }

  return {
    data: (data as CatalogRecipeRecord[]) || [],
    total: count ?? 0,
    page,
    pageSize,
  };
};

export const listFoodsPaginated = async (params: {
  nutritionistId?: string;
  page: number;
  pageSize: number;
  searchTerm?: string;
  reviewStatus?: 'all' | 'pending' | 'approved' | 'rejected';
  country?: string;
}): Promise<{ data: CatalogFoodRecord[]; total: number; page: number; pageSize: number }> => {
  const { nutritionistId, page, pageSize, searchTerm, reviewStatus = 'all', country } = params;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mismo motivo que listFoods
  let query: any = supabase
    .from('foods')
    .select(FOOD_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (searchTerm && searchTerm.trim()) {
    query = query.ilike('name', `%${searchTerm.trim()}%`);
  }

  if (reviewStatus !== 'all') {
    query = query.eq('review_status', reviewStatus);
  }

  if (country && country !== 'all') {
    query = query.eq('country', country);
  }

  const scopedQuery = scopeByNutritionist(query, nutritionistId);
  const { data, count, error } = await scopedQuery;
  if (error) {
    throw error;
  }

  const rows = (data as Record<string, unknown>[]) || [];
  const measuresByFoodId = await loadFoodHouseholdMeasures(
    rows.map((food) => String(food.id ?? '')).filter(Boolean),
  );

  return {
    data: rows.map((food) => normalizeFoodRecord(food, measuresByFoodId ?? undefined)),
    total: count ?? 0,
    page,
    pageSize,
  };
};

export const getRecipeById = async (id: string, nutritionistId?: string): Promise<{ data: CatalogRecipeRecord | null; source: DataSource }> => {
  const { data, error } = await scopeByNutritionist(
    supabase.from('recipes').select(RECIPE_COLUMNS).eq('id', id),
    nutritionistId,
  ).maybeSingle();
  if (error) {
    throw error;
  }

  return { data: (data as CatalogRecipeRecord | null) || null, source: 'supabase' };
};

export const saveRecipe = async (payload: CatalogRecipeRecord, id?: string, nutritionistId?: string): Promise<{ data: CatalogRecipeRecord; source: DataSource }> => {
  const persistedPayload = withTenantOwnership(stripPersistedRecipeFields(payload), nutritionistId);

  if (id) {
    const { data, error } = await scopeByNutritionist(
      supabase.from('recipes').update(persistedPayload).eq('id', id),
      nutritionistId,
    ).select(RECIPE_COLUMNS).single();
    if (error) {
      throw error;
    }

    return { data: data as CatalogRecipeRecord, source: 'supabase' };
  } else {
    const { data, error } = await supabase.from('recipes').insert([persistedPayload]).select(RECIPE_COLUMNS).single();
    if (error) {
      throw error;
    }

    return { data: data as unknown as CatalogRecipeRecord, source: 'supabase' };
  }
};

// "Guardar en Mis Recetas": clona una receta de la comunidad al catálogo PROPIO
// del nutricionista como copia PRIVADA (source 'Propia'), independiente y
// editable. La original y sus valoraciones quedan intactas. Se conserva el país
// de origen (badge). Evita duplicados: si ya tiene una receta propia con el
// mismo nombre, no vuelve a clonar y lo indica con `alreadyExists`.
export const adoptCommunityRecipe = async (
  recipe: CatalogRecipeRecord,
  nutritionistId: string,
): Promise<{ data: CatalogRecipeRecord | null; alreadyExists: boolean; source: DataSource }> => {
  const name = (recipe.name || '').trim();
  if (!name) {
    throw new Error('La receta no tiene nombre y no se puede guardar.');
  }

  // ¿Ya la adoptó antes? Buscamos por nombre usando EXACTAMENTE el mismo criterio
  // que "Mis Recetas" (submitted_by_nutritionist_id). Si usáramos nutritionist_id
  // podríamos detectar una fila que "Mis Recetas" no muestra (criterios distintos)
  // y bloquear el guardado con un falso positivo. Con el mismo criterio, "no está
  // en Mis Recetas" ⇒ el chequeo no la bloquea y el guardado procede.
  const { data: existing, error: existingError } = await supabase
    .from('recipes')
    .select('id')
    .eq('submitted_by_nutritionist_id', nutritionistId)
    .ilike('name', name)
    .limit(1);
  if (existingError) {
    throw toReadableError(existingError, 'No se pudo verificar tus recetas existentes.');
  }
  if (existing && existing.length > 0) {
    return { data: null, alreadyExists: true, source: 'supabase' };
  }

  const payload: CatalogRecipeRecord = {
    name,
    // Columna legacy `title` con NOT NULL: se duplica el nombre.
    title: name,
    description: recipe.description ?? null,
    image_url: recipe.image_url ?? null,
    category: recipe.category ?? null,
    country: recipe.country ?? null,
    difficulty: recipe.difficulty ?? null,
    prep_time: recipe.prep_time ?? null,
    cook_time: recipe.cook_time ?? null,
    calories_per_serving: recipe.calories_per_serving ?? null,
    protein_per_serving: recipe.protein_per_serving ?? null,
    carbs_per_serving: recipe.carbs_per_serving ?? null,
    fat_per_serving: recipe.fat_per_serving ?? null,
    fiber_per_serving: recipe.fiber_per_serving ?? null,
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    instructions: recipe.instructions ?? null,
    servings: recipe.servings ?? null,
    // La copia es PRIVADA del nutricionista (no se re-publica a la comunidad).
    source: 'Propia',
  } as unknown as CatalogRecipeRecord;

  const result = await saveRecipe(payload, undefined, nutritionistId);
  return { data: result.data, alreadyExists: false, source: 'supabase' };
};

export const updateRecipeReview = async (
  id: string,
  input: Pick<CatalogRecipeRecord, 'review_status' | 'review_notes'>,
): Promise<{ data: CatalogRecipeRecord; source: DataSource }> => {
  const reviewPayload: Record<string, unknown> = {
    review_status: input.review_status,
    review_notes: input.review_notes ?? null,
  };
  // El trigger apply_recipe_review_workflow pone nutritionist_id = null al aprobar,
  // pero lo enviamos explícito como defensa en profundidad.
  if (input.review_status === 'approved') {
    reviewPayload.nutritionist_id = null;
  }

  const { data, error } = await supabase
    .from('recipes')
    .update(reviewPayload)
    .eq('id', id)
    .select(RECIPE_COLUMNS)
    .single();

  if (error) throw error;
  return { data: data as unknown as CatalogRecipeRecord, source: 'supabase' };
};

export const deleteRecipeById = async (id: string, nutritionistId?: string): Promise<DataSource> => {
  const { error } = await scopeByNutritionist(
    supabase.from('recipes').delete().eq('id', id),
    nutritionistId,
  );
  if (error) {
    throw error;
  }

  return 'supabase';
};

/**
 * Alimentos del catálogo que corresponden a una lista de nombres de ingrediente.
 *
 * ─── Por qué UNA lectura del catálogo y no una consulta por nombre ───────────
 *
 * Esta función hacía `ilike '%nombre%'` una vez por ingrediente, 50 en paralelo.
 * Con el Excel de recetas real eso son 66 consultas simultáneas, y cada una:
 *
 *   · no puede usar índice —el comodín va delante—, así que recorre los 1392
 *     alimentos uno a uno;
 *   · arrastra `nutrients`, la columna más pesada del catálogo;
 *   · y evalúa por CADA fila la política de seguridad de `foods`, que llama a
 *     `assert_current_nutritionist_session_access()`: una función declarada sin
 *     `stable`, así que Postgres la ejecuta una vez por fila y por consulta.
 *
 * Medido contra producción: **una sola** de esas consultas tarda 1,9 s, y
 * traerse el catálogo ENTERO tarda 1,0 s. Las 66 juntas superaban el límite de
 * tiempo de la base, que las cancelaba con `57014` — y el error se descartaba en
 * silencio (`const { data } = await …`), así que la importación guardaba las
 * recetas con todos los ingredientes a 0 kcal y anunciaba "procesadas
 * correctamente". Ese silencio es lo que hizo el fallo invisible durante días.
 *
 * Ahora se lee el catálogo de una vez —el mismo camino que ya usa el prefetch
 * del buscador, que sí aguanta— y el emparejamiento se hace en memoria. De 66
 * consultas a 2 ó 3, y cualquier fallo se propaga en vez de tragarse.
 */
export const getFoodsForIngredients = async (
  names: string[]
): Promise<CatalogFoodRecord[]> => {
  const unique = Array.from(new Set(names.map(n => (n || '').trim()).filter(Boolean)));
  if (unique.length === 0) return [];

  // Lectura ligera: sin `nutrients`, igual que el prefetch del buscador. Si la
  // base falla, `listAccessibleFoods` lanza y el caller se entera.
  const { data: catalogo } = await listAccessibleFoods(undefined, FOOD_LIST_COLUMNS);
  if (catalogo.length === 0) return [];

  // Se conservan los que alguna búsqueda podría necesitar, con el mismo criterio
  // que aplicaba el `ilike`: que el nombre del catálogo CONTENGA el buscado. Se
  // añade la coincidencia por el primer segmento ("Arroz blanco, crudo" →
  // "arroz blanco") porque es la segunda pasada que hace
  // `buscarAlimentoDelIngrediente`, y sin ella se quedaría sin candidatos.
  const buscados = unique.map(normalizeSearchText).filter(Boolean);
  const cabezas = new Set(buscados.map(nombre => nombre.split(',')[0].trim()).filter(Boolean));

  const relevantes = catalogo.filter(food => {
    const nombre = normalizeSearchText(food.name);
    if (!nombre) return false;
    return buscados.some(buscado => nombre.includes(buscado))
      || cabezas.has(nombre.split(',')[0].trim());
  });

  if (relevantes.length === 0) return [];

  return hidratarMicronutrientes(relevantes);
};

/**
 * Devuelve los alimentos con su columna `nutrients`, que la lectura masiva deja
 * fuera por peso (el 61% del payload). Se piden solo los que de verdad se van a
 * usar —decenas, no miles— en una consulta por lotes.
 *
 * Si la columna no llega, el alimento se devuelve igual: los macros y los
 * micronutrientes de columna propia (fibra, sodio, calcio…) ya venían en la
 * lectura ligera. Se pierde detalle, no exactitud.
 */
const hidratarMicronutrientes = async (
  foods: CatalogFoodRecord[],
): Promise<CatalogFoodRecord[]> => {
  const ids = foods.map(food => String(food.id ?? '')).filter(Boolean);
  if (ids.length === 0) return foods;

  const filas = await chunkedIn<{ id: string; nutrients: FoodNutrientsMap | null }>(
    ids,
    chunk => supabase.from('foods').select('id,nutrients').in('id', chunk),
  );

  const porId = new Map(filas.map(fila => [String(fila.id), fila.nutrients]));

  return foods.map(food => {
    const nutrients = porId.get(String(food.id));
    if (!nutrients) return food;
    return normalizeFoodRecord({ ...food, nutrients } as Record<string, unknown>);
  });
};

// ── Resolución de la medida casera escrita a mano ───────────────────────────
//
// La unidad llega de la columna `unidad_N` del Excel de importación, escrita por
// una persona: "taza", "Cucharadas", "cda. colmada". El catálogo, en cambio,
// guarda nombres largos y exactos: "Taza de loza al ras", "Cucharada colmada".
//
// Antes se comparaban con `===` sobre el texto en minúsculas. No coincidía casi
// nunca —ni siquiera con el ejemplo que daba nuestra propia guía, que sugería
// "cucharadas" en plural— y el ingrediente caía en la opción 0, que es gramos.
// El daño no era solo la etiqueta: "3 cucharadas de aceite" se guardaba como
// 3 GRAMOS de aceite, porque los gramos se calculan con la unidad elegida.
//
// Ahora se intenta en cuatro pasadas, de la más estricta a la más tolerante, y
// —esto es lo importante— cuando ninguna acierta se DICE, en vez de caer a
// gramos sin avisar.

const UNIDADES_QUE_SON_GRAMOS = new Set([
  'g', 'gr', 'grs', 'gramo', 'gramos',
  'ml', 'mililitro', 'mililitros', 'cc',
]);

/** "cucharadas colmadas" → "cucharada colmada". Plural español, sin diccionario. */
const enSingular = (texto: string): string =>
  texto
    .split(' ')
    .map((palabra) => {
      if (palabra.length > 4 && palabra.endsWith('es')) return palabra.slice(0, -2);
      if (palabra.length > 3 && palabra.endsWith('s')) return palabra.slice(0, -1);
      return palabra;
    })
    .join(' ');

// Palabras que no distinguen una medida de otra. El catálogo guarda "Taza loza
// al ras" y en el Excel se escribe "Taza de loza al ras": es la misma medida, y
// ese "de" no puede ser lo que la haga fallar.
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'al', 'a', 'con', 'en', 'y']);

/**
 * Raíz de una palabra para comparar sin que el género la estropee:
 * "plastica" y "plastico" son la misma medida escrita por dos personas.
 * Solo se recorta la vocal final, así que "ras" o "al" quedan intactas.
 */
const raiz = (palabra: string): string => palabra.replace(/[aeo]$/, '');

/** Palabras que de verdad identifican la medida, ya en singular y sin género. */
const palabrasClave = (texto: string): string[] =>
  enSingular(texto)
    .split(' ')
    .filter((palabra) => palabra && !PALABRAS_VACIAS.has(palabra))
    .map(raiz);

export type ResultadoDeUnidad = 'gramos' | 'exacta' | 'aproximada' | 'sin_coincidencia';

export type ResolucionDeUnidad = { index: number; resultado: ResultadoDeUnidad };

/**
 * Devuelve qué opción de unidad corresponde a lo que se escribió en el Excel.
 *
 * `index` es siempre utilizable: cuando no hay coincidencia vale 0 (gramos),
 * igual que antes. Lo que cambia es que `resultado` permite distinguir "pidió
 * gramos" de "pidió algo que no supimos reconocer", y avisar solo del segundo.
 */
export const resolveHouseholdUnitIndex = (
  unitOptions: { label: string; grams: number; isHousehold: boolean }[],
  unidadEscrita: string | null | undefined,
): ResolucionDeUnidad => {
  const escrita = normalizeSearchText(unidadEscrita);
  if (!escrita) return { index: 0, resultado: 'gramos' };
  if (UNIDADES_QUE_SON_GRAMOS.has(escrita)) return { index: 0, resultado: 'gramos' };

  const caseras = unitOptions
    .map((opcion, index) => ({ index, normalizada: normalizeSearchText(opcion.label), isHousehold: opcion.isHousehold }))
    .filter((opcion) => opcion.isHousehold);

  // 1. Tal cual: "taza de loza al ras" = "Taza de loza al ras".
  const exacta = caseras.find((opcion) => opcion.normalizada === escrita);
  if (exacta) return { index: exacta.index, resultado: 'exacta' };

  // 2. Ignorando el plural: "cucharadas" = "Cucharada".
  const escritaSingular = enSingular(escrita);
  const porSingular = caseras.find((opcion) => enSingular(opcion.normalizada) === escritaSingular);
  if (porSingular) return { index: porSingular.index, resultado: 'exacta' };

  // 3. Por el principio del nombre: "taza" → "Taza de loza al ras". Si encajan
  //    varias se toma la primera, que es la que el nutricionista puso arriba al
  //    ordenar las medidas del alimento.
  const porPrefijo = caseras.find((opcion) => opcion.normalizada.startsWith(escritaSingular));
  if (porPrefijo) return { index: porPrefijo.index, resultado: 'aproximada' };

  // 4. Por las palabras que identifican la medida, ignorando las de relleno y
  //    el género. Es la pasada que salva los casos reales del Excel del
  //    nutricionista: "Taza de loza al ras" → "Taza loza al ras" (sobra el
  //    "de") y "Taza plástica llena" → "Taza plástico llena" (género).
  //
  //    Sigue exigiendo que estén TODAS las palabras clave, así que no confunde
  //    medidas del mismo alimento: "Taza plástica llena" no puede acabar en
  //    "Taza plástico al ras", porque "llena" no aparece.
  const clave = palabrasClave(escrita);
  if (clave.length > 0) {
    const porPalabras = caseras.find((opcion) => {
      const delCatalogo = palabrasClave(opcion.normalizada);
      return clave.every((palabra) => delCatalogo.includes(palabra));
    });
    if (porPalabras) return { index: porPalabras.index, resultado: 'aproximada' };
  }

  return { index: 0, resultado: 'sin_coincidencia' };
};

// Enriches a bare ingredient (name/quantity/unit only) with macros, grams,
// household measures and per-gram values looked up from catalogFoods.
// Returns the original ingredient unchanged if no catalog match is found.
/**
 * Busca el alimento del catálogo que corresponde al nombre de un ingrediente.
 *
 * Se compara con `normalizeSearchText` —sin tildes y con los espacios
 * colapsados— y no con un `toLowerCase()` pelado. El motivo es prosaico: en el
 * catálogo hay nombres con dos espacios seguidos ("Pimiento  rojo"), invisibles
 * al leerlos, que hacían fallar la búsqueda de un ingrediente escrito bien.
 */
const buscarAlimentoDelIngrediente = (
  nombre: string,
  catalogFoods: CatalogFoodRecord[],
): CatalogFoodRecord | undefined => {
  const target = normalizeSearchText(nombre);
  if (!target || catalogFoods.length === 0) return undefined;

  const exacto = catalogFoods.find(f => normalizeSearchText(f.name) === target);
  if (exacto) return exacto;

  const head = target.split(',')[0].trim();
  return catalogFoods.find(f => {
    const fn = normalizeSearchText(f.name);
    return fn.includes(target) || (head && fn.split(',')[0].trim() === head);
  });
};

/** Las unidades elegibles de un alimento: gramos, más sus medidas caseras. */
const construirOpcionesDeUnidad = (food: CatalogFoodRecord) => {
  const measures: HouseholdMeasure[] = (food.household_measures || []).filter(
    (m): m is HouseholdMeasure => !!m?.name && Number.isFinite(m.weight_grams) && (m.weight_grams ?? 0) > 0,
  );
  return [
    { label: 'gramos', grams: 1, isHousehold: false },
    ...measures.map(m => ({ label: m.name, grams: m.weight_grams, isHousehold: true })),
  ];
};

/**
 * Valores de cada nutriente por gramo de alimento. `IngredientRow` los usa para
 * reescalar en vivo al cambiar la cantidad o la unidad, sin volver al catálogo.
 */
const construirMacrosPorGramo = (food: CatalogFoodRecord, portionG: number): Record<string, number> => {
  const perGram: Record<string, number> = {};
  const foodAsRecord = food as Record<string, unknown>;

  ['calories', 'protein', 'carbs', 'fat'].forEach(key => {
    const val = Number(foodAsRecord[key]);
    if (Number.isFinite(val)) perGram[key] = val / portionG;
  });
  OPTIONAL_NUTRIENTS.forEach(({ key }) => {
    const val = getFoodNutrientValue(foodAsRecord, key);
    if (val != null) perGram[key] = val / portionG;
  });

  return perGram;
};

/**
 * Adjunta a un ingrediente YA calculado las medidas caseras de su alimento, sin
 * tocar cantidad, gramos ni macros.
 *
 * Para qué: el editor de recetas solo enseña el desplegable de unidades cuando
 * el ingrediente trae más de una opción. Los ingredientes importados y los de
 * recetas viejas no traen ninguna, así que su unidad quedaba congelada en
 * "gramos" —texto gris, sin desplegable— aunque el alimento del catálogo
 * tuviera sus tazas y cucharadas registradas. Esto se las devuelve.
 *
 * Devuelve el ingrediente tal cual si no hay alimento, si no tiene medidas
 * caseras, o si el ingrediente ya traía sus opciones.
 */
export const attachHouseholdUnitOptions = (
  ing: Record<string, unknown>,
  catalogFoods: CatalogFoodRecord[],
): Record<string, unknown> => {
  const yaTieneOpciones = Array.isArray(ing._unitOptions) && ing._unitOptions.length > 1;
  if (yaTieneOpciones) return ing;

  const food = buscarAlimentoDelIngrediente(String(ing.name || ''), catalogFoods);
  if (!food) return ing;

  const unitOptions = construirOpcionesDeUnidad(food);
  if (unitOptions.length <= 1) return ing;

  // El índice sale de la unidad que el ingrediente ya tiene guardada, para no
  // cambiarle nada de lo que el nutricionista ve: solo se le abre la puerta a
  // elegir otra.
  const { index } = resolveHouseholdUnitIndex(unitOptions, String(ing.unit || ''));
  const perGram = construirMacrosPorGramo(food, food.portion_grams || 100);

  return {
    ...ing,
    _householdMeasures: food.household_measures || [],
    _unitOptions: unitOptions,
    _unitIndex: index,
    // Sin esto, cambiar de unidad no sabría reescalar los macros.
    _perGramMacros: (ing._perGramMacros as Record<string, number>) || perGram,
  };
};

export const enrichRecipeIngredient = (
  ing: { name: string; quantity: number; unit?: string | null },
  catalogFoods: CatalogFoodRecord[],
): Record<string, unknown> => {
  const food = buscarAlimentoDelIngrediente(ing.name, catalogFoods);
  if (!food) return { ...ing };

  const portionG = food.portion_grams || 100;
  const unitOptions = construirOpcionesDeUnidad(food);

  const resolucion = resolveHouseholdUnitIndex(unitOptions, ing.unit);
  const unitIndex = resolucion.index;

  const unit = unitOptions[unitIndex];
  const totalGrams = unit.isHousehold ? ing.quantity * unit.grams : ing.quantity;
  const factor = portionG > 0 ? totalGrams / portionG : 0;
  const r1 = (v: number) => Math.round(v * 10) / 10;

  const perGram = construirMacrosPorGramo(food, portionG);
  const nutrientPayload = scaleFoodNutrientsForPlan(food as Record<string, unknown>, factor);

  return {
    name: ing.name,
    quantity: ing.quantity,
    unit: unit.isHousehold ? unit.label : 'g',
    grams: r1(totalGrams),
    calories: r1((food.calories || 0) * factor),
    protein: r1((food.protein || 0) * factor),
    carbs: r1((food.carbs || 0) * factor),
    fat: r1((food.fat || 0) * factor),
    ...nutrientPayload,
    _householdMeasures: food.household_measures || [],
    _unitOptions: unitOptions,
    _unitIndex: unitIndex,
    _perGramMacros: perGram,
    // Marca de paso, NO se guarda: el importador la lee para avisar al admin de
    // qué unidades no reconoció y la borra antes de persistir la receta. Sin
    // esto, una unidad mal escrita se convertía en gramos sin que nadie se
    // enterase, y la cantidad quedaba mal (3 cucharadas → 3 gramos).
    ...(resolucion.resultado === 'sin_coincidencia'
      ? { _unidadSinReconocer: String(ing.unit || '').trim() }
      : {}),
  };
};