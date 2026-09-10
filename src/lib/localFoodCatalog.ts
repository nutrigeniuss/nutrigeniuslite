/**
 * Catálogo de alimentos 100% local (sin backend).
 * Se guarda en localStorage; se puede importar/exportar JSON.
 */

export type LocalFood = {
  id: string;
  name: string;
  category?: string | null;
  country?: string | null;
  portion_grams?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  sodium?: number | null;
  notes?: string | null;
  household_measures?: Array<{
    id?: string;
    name: string;
    quantity?: number | null;
    weight_grams: number;
  }> | null;
  nutrients?: Record<string, number | null> | null;
  created_at?: string | null;
  _local?: true;
  [key: string]: unknown;
};

const STORAGE_KEY = 'ng_lite_calc_foods_v1';

function uid() {
  return crypto.randomUUID?.() || `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readLocalFoods(): LocalFood[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalFood[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalFoods(foods: LocalFood[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(foods));
  window.dispatchEvent(new CustomEvent('ng-local-foods-changed'));
}

export function clearLocalFoods(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('ng-local-foods-changed'));
}

function normalizeIncoming(row: Partial<LocalFood>, fallbackId?: string): LocalFood {
  const name = String(row.name || '').trim();
  return {
    ...row,
    id: String(row.id || fallbackId || uid()),
    name,
    category: row.category ?? null,
    country: row.country ?? 'PE',
    portion_grams: row.portion_grams ?? 100,
    calories: Number(row.calories) || 0,
    protein: Number(row.protein) || 0,
    carbs: Number(row.carbs) || 0,
    fat: Number(row.fat) || 0,
    fiber: row.fiber == null ? null : Number(row.fiber) || 0,
    sodium: row.sodium == null ? null : Number(row.sodium) || 0,
    notes: row.notes ?? null,
    household_measures: Array.isArray(row.household_measures) ? row.household_measures : [],
    nutrients: row.nutrients ?? null,
    created_at: row.created_at || new Date().toISOString(),
    _local: true,
  };
}

/** Reemplaza o fusiona por id/nombre. */
export function importLocalFoods(
  rows: Partial<LocalFood>[],
  mode: 'replace' | 'merge' = 'replace',
): { count: number; foods: LocalFood[] } {
  const incoming = rows
    .filter((r) => r && String(r.name || '').trim())
    .map((r) => normalizeIncoming(r));

  if (mode === 'replace') {
    writeLocalFoods(incoming);
    return { count: incoming.length, foods: incoming };
  }

  const current = readLocalFoods();
  const byId = new Map(current.map((f) => [f.id, f]));
  const byName = new Map(current.map((f) => [f.name.toLowerCase(), f]));

  incoming.forEach((food) => {
    const existing = byId.get(food.id) || byName.get(food.name.toLowerCase());
    if (existing) {
      const merged = { ...existing, ...food, id: existing.id, _local: true as const };
      byId.set(existing.id, merged);
      byName.set(merged.name.toLowerCase(), merged);
    } else {
      byId.set(food.id, food);
      byName.set(food.name.toLowerCase(), food);
    }
  });

  const foods = Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  writeLocalFoods(foods);
  return { count: incoming.length, foods };
}

export function upsertLocalFood(input: Partial<LocalFood>): LocalFood {
  const foods = readLocalFoods();
  const normalized = normalizeIncoming(input, input.id);
  const idx = foods.findIndex((f) => f.id === normalized.id || f.name.toLowerCase() === normalized.name.toLowerCase());
  if (idx >= 0) {
    foods[idx] = { ...foods[idx], ...normalized, id: foods[idx].id };
  } else {
    foods.push(normalized);
  }
  foods.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  writeLocalFoods(foods);
  return idx >= 0 ? foods[idx] : normalized;
}

export function deleteLocalFood(id: string): void {
  writeLocalFoods(readLocalFoods().filter((f) => f.id !== id));
}

export function exportLocalFoodsJson(): string {
  return JSON.stringify(readLocalFoods(), null, 2);
}

/** Plantilla mínima para que el maestro sepa el formato. */
export const FOODS_JSON_EXAMPLE: LocalFood[] = [
  {
    id: 'ejemplo-arroz',
    name: 'Arroz cocido',
    category: 'Cereales',
    country: 'PE',
    portion_grams: 100,
    calories: 130,
    protein: 2.7,
    carbs: 28.2,
    fat: 0.3,
    household_measures: [{ name: 'taza', weight_grams: 150 }],
    _local: true,
  },
  {
    id: 'ejemplo-pollo',
    name: 'Pechuga de pollo cocida',
    category: 'Carnes',
    country: 'PE',
    portion_grams: 100,
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    household_measures: [{ name: 'filete', weight_grams: 120 }],
    _local: true,
  },
];
