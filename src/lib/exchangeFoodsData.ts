import { supabase } from '@/api/supabaseClient';
import { logger } from '@/lib/logger';
import {
  EXCHANGE_GROUPS as STATIC_EXCHANGE_GROUPS,
  PATIENT_GROUP_LABELS,
  NUTRITIONIST_GROUP_LABELS,
} from '@/components/exchanges/exchangeData';

// Estructura mínima de un grupo según viene del catálogo estático.
// Se mantiene aquí (sin tipos en el JS) para que TS pueda validar consumidores.
export type StaticExchangeGroup = {
  key: string;
  label: string;
  shortLabel?: string;
  color?: string;
  headerBg?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  foods: Array<{
    id: string;
    name: string;
    grams_raw: number | null;
    grams_cooked: number | null;
    measure: string;
  }>;
};

export type ExchangeFoodRow = {
  id: string;
  group_key: string;
  name: string;
  grams_raw: number | null;
  grams_cooked: number | null;
  measure: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ExchangeFoodInput = {
  group_key: string;
  name: string;
  grams_raw: number | null;
  grams_cooked: number | null;
  measure: string;
  sort_order?: number;
};

export type ExchangeFood = {
  id: string;
  name: string;
  grams_raw: number | null;
  grams_cooked: number | null;
  measure: string;
  // 'static' = proviene del catálogo embebido en el código (semilla todavía no migrada).
  // 'custom' = guardado en la tabla exchange_foods de Supabase.
  source: 'static' | 'custom';
  sort_order: number;
};

export type ExchangeGroup = Omit<StaticExchangeGroup, 'foods'> & {
  foods: ExchangeFood[];
};

const STATIC_GROUPS = STATIC_EXCHANGE_GROUPS as StaticExchangeGroup[];

const STATIC_GROUPS_BY_KEY: Record<string, StaticExchangeGroup> = STATIC_GROUPS.reduce(
  (acc, group) => {
    acc[group.key] = group;
    return acc;
  },
  {} as Record<string, StaticExchangeGroup>,
);

// Devuelve la lista de claves de grupo válidas. La fuente sigue siendo el catálogo
// estático porque los grupos (con sus aportes nutricionales) no son editables por ahora.
export const listExchangeGroupKeys = (): string[] => STATIC_GROUPS.map((g) => g.key);

export const getStaticGroup = (groupKey: string): StaticExchangeGroup | null =>
  STATIC_GROUPS_BY_KEY[groupKey] || null;

export const getGroupLabel = (groupKey: string, variant: 'patient' | 'nutritionist' = 'patient'): string => {
  const group = STATIC_GROUPS_BY_KEY[groupKey];
  if (!group) return groupKey;
  if (variant === 'nutritionist') {
    return (NUTRITIONIST_GROUP_LABELS as Record<string, string>)[groupKey] || group.shortLabel || group.label;
  }
  return (PATIENT_GROUP_LABELS as Record<string, string>)[groupKey] || group.label;
};

// Lee todas las filas activas de la tabla exchange_foods.
const fetchCustomFoods = async (): Promise<ExchangeFoodRow[]> => {
  const { data, error } = await supabase
    .from('exchange_foods')
    .select('id, group_key, name, grams_raw, grams_cooked, measure, sort_order, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('group_key', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    // No bloqueamos la app si Supabase falla: caemos al catálogo estático.
    logger.warn('[exchangeFoodsData] No se pudieron leer alimentos personalizados:', { error: error.message });
    return [];
  }
  return (data || []) as ExchangeFoodRow[];
};

const toExchangeFoodFromRow = (row: ExchangeFoodRow): ExchangeFood => ({
  id: row.id,
  name: row.name,
  grams_raw: row.grams_raw,
  grams_cooked: row.grams_cooked,
  measure: row.measure || '',
  source: 'custom',
  sort_order: row.sort_order,
});

const toExchangeFoodFromStatic = (
  food: StaticExchangeGroup['foods'][number],
  index: number,
): ExchangeFood => ({
  id: food.id,
  name: food.name,
  grams_raw: food.grams_raw,
  grams_cooked: food.grams_cooked,
  measure: food.measure || '',
  source: 'static',
  sort_order: index,
});

// Combina la lista oficial estática con los alimentos personalizados guardados por el admin.
// Política: si un grupo tiene al menos un alimento custom, los custom REEMPLAZAN a los estáticos
// (esto permite al admin curar el catálogo). Si no hay custom, se muestran los estáticos como semilla.
export const buildMergedGroups = (customRows: ExchangeFoodRow[]): ExchangeGroup[] => {
  const customByGroup = customRows.reduce<Record<string, ExchangeFoodRow[]>>((acc, row) => {
    if (!acc[row.group_key]) acc[row.group_key] = [];
    acc[row.group_key].push(row);
    return acc;
  }, {});

  return STATIC_GROUPS.map((group) => {
    const custom = customByGroup[group.key];
    const foods: ExchangeFood[] = custom && custom.length > 0
      ? custom.map(toExchangeFoodFromRow)
      : group.foods.map(toExchangeFoodFromStatic);
    return { ...group, foods };
  });
};

// Carga los grupos efectivos (estáticos + overrides). Es la función que deben usar
// los consumidores (creador de dietas, vista del paciente y panel admin).
export const loadExchangeGroups = async (): Promise<ExchangeGroup[]> => {
  const rows = await fetchCustomFoods();
  return buildMergedGroups(rows);
};

// Inserta un nuevo alimento en el catálogo. RLS garantiza que solo el admin pueda hacerlo.
export const createExchangeFood = async (input: ExchangeFoodInput): Promise<ExchangeFoodRow> => {
  const payload = {
    group_key: input.group_key,
    name: input.name.trim(),
    grams_raw: input.grams_raw,
    grams_cooked: input.grams_cooked,
    measure: input.measure?.trim() || null,
    sort_order: input.sort_order ?? 0,
  };
  const { data, error } = await supabase
    .from('exchange_foods')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ExchangeFoodRow;
};

export const updateExchangeFood = async (
  id: string,
  patch: Partial<ExchangeFoodInput>,
): Promise<ExchangeFoodRow> => {
  const payload: Record<string, unknown> = {};
  if (patch.group_key !== undefined) payload.group_key = patch.group_key;
  if (patch.name !== undefined) payload.name = patch.name.trim();
  if (patch.grams_raw !== undefined) payload.grams_raw = patch.grams_raw;
  if (patch.grams_cooked !== undefined) payload.grams_cooked = patch.grams_cooked;
  if (patch.measure !== undefined) payload.measure = patch.measure?.trim() || null;
  if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;

  const { data, error } = await supabase
    .from('exchange_foods')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ExchangeFoodRow;
};

export const deleteExchangeFood = async (id: string): Promise<void> => {
  const { error } = await supabase.from('exchange_foods').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

// Sembrado masivo: copia el catálogo estático a la tabla. Pensado para usarse una sola vez,
// cuando el admin decide tomar el control editorial. Si ya hay datos, no hace nada.
export const seedExchangeFoodsFromStatic = async (): Promise<{ inserted: number; skipped: boolean }> => {
  const { count, error: countError } = await supabase
    .from('exchange_foods')
    .select('id', { count: 'exact', head: true });
  if (countError) throw new Error(countError.message);
  if ((count || 0) > 0) return { inserted: 0, skipped: true };

  const payload = STATIC_GROUPS.flatMap((group) =>
    group.foods.map((food, index) => ({
      group_key: group.key,
      name: food.name.trim(),
      grams_raw: food.grams_raw,
      grams_cooked: food.grams_cooked,
      measure: food.measure || null,
      sort_order: index,
    })),
  );

  // Inserción por bloques para no saturar el límite de payload.
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const chunk = payload.slice(i, i + CHUNK);
    const { error } = await supabase.from('exchange_foods').insert(chunk);
    if (error) throw new Error(error.message);
    inserted += chunk.length;
  }

  return { inserted, skipped: false };
};
