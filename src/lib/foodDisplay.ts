// Utilidades compartidas para mostrar alimentos en pantallas de recetas,
// dietas y recordatorio 24h. Centralizan la normalización de macros a base
// por 100 g y la extracción correcta de las medidas caseras reales guardadas
// en el registro del alimento.
//
// Motivo: antes del refactor del importador, cada medida casera se guardaba
// como una fila separada con el mismo `name` y un `portion_grams` distinto.
// Tras el refactor, cada alimento es un único registro con su arreglo
// `household_measures`. Este helper cubre ambos escenarios.

import { scaleFoodNutrientsForPlan, getFoodMacroValue } from "./foodNutrients";

type FoodLike = {
  id?: string | number;
  name?: string;
  category?: string;
  portion_grams?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  notes?: string | null;
  household_measures?: Array<{ name?: string; weight_grams?: number }> | null;
  [key: string]: unknown;
};

export type HouseholdMeasure = { name: string; weight_grams: number };

export type ProcessedFood = {
  id: string | number | undefined;
  name: string;
  category: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  portion_grams: 100;
  household_measures: HouseholdMeasure[];
  [key: string]: unknown;
};

// Etiquetas usadas solo como fallback para datos legados donde varias filas
// comparten el mismo nombre de alimento y carecen de `notes`.
const LEGACY_MEASURE_LABELS = [
  "1 unidad pequeña",
  "1 unidad mediana",
  "1 unidad grande",
  "1 taza",
  "1 plato",
  "1 cucharada",
  "1 porción",
  "½ taza",
];

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Agrupa la lista de alimentos por `name`, normaliza macros a base por 100 g
 * y preserva las medidas caseras reales del registro. Para filas legadas
 * (mismo nombre repetido) convierte cada `portion_grams` en una medida casera
 * adicional usando `notes` o una etiqueta genérica de respaldo.
 */
export function processFoodsForSearch(foods: FoodLike[]): ProcessedFood[] {
  const map = new Map<string, ProcessedFood>();
  const legacyCounters = new Map<string, number>();

  for (const f of foods || []) {
    const name = (f.name || "").trim();
    if (!name) continue;

    const pg = Number(f.portion_grams) || 100;
    const factor100 = 100 / pg;

    if (!map.has(name)) {
      const existingMeasures: HouseholdMeasure[] = Array.isArray(f.household_measures)
        ? f.household_measures
            .filter((m) => m && m.name && Number(m.weight_grams) > 0)
            .map((m) => ({
              name: String(m!.name).trim(),
              weight_grams: Number(m!.weight_grams),
            }))
        : [];

      map.set(name, {
        id: f.id,
        name,
        category: f.category || "",
        calories: round1((getFoodMacroValue(f, "calories") ?? 0) * factor100),
        protein: round1((getFoodMacroValue(f, "protein") ?? 0) * factor100),
        fat: round1((getFoodMacroValue(f, "fat") ?? 0) * factor100),
        carbs: round1((getFoodMacroValue(f, "carbs") ?? 0) * factor100),
        ...(scaleFoodNutrientsForPlan(f as any, factor100) as Record<string, unknown>),
        portion_grams: 100,
        household_measures: existingMeasures,
      });
      legacyCounters.set(name, 0);
      continue;
    }

    // Fallback legado: múltiples filas con el mismo nombre → cada
    // portion_grams se convierte en una medida casera extra.
    const entry = map.get(name)!;
    const idx = legacyCounters.get(name) || 0;
    const label =
      (f.notes && String(f.notes).trim()) ||
      LEGACY_MEASURE_LABELS[idx] ||
      `Medida ${idx + 1}`;
    const already = entry.household_measures.some(
      (m) =>
        m.name.toLowerCase() === label.toLowerCase() &&
        Math.abs(m.weight_grams - pg) < 0.5,
    );
    if (!already) {
      entry.household_measures.push({ name: label, weight_grams: pg });
    }
    legacyCounters.set(name, idx + 1);
  }

  return Array.from(map.values());
}

/**
 * Construye la lista de unidades seleccionables para un alimento procesado:
 * siempre incluye "gramos" y añade cada medida casera real del registro,
 * limpiando prefijos numéricos ("3 cucharadas" → "cucharadas").
 */
export function getFoodUnits(food: { household_measures?: HouseholdMeasure[] | null }) {
  const base = [{ label: "gramos", grams: 1, isHousehold: false }];
  const measures = Array.isArray(food.household_measures) ? food.household_measures : [];
  for (const m of measures) {
    const cleanName = (m?.name || "").replace(/^\d+\.?\d*\s+/, "").trim();
    const grams = Number(m?.weight_grams);
    if (cleanName && grams > 0) {
      base.push({ label: cleanName, grams, isHousehold: true });
    }
  }
  return base;
}
