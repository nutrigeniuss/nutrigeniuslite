// Resumen de una semana de dietas: totales, promedio y reparto de macros.
//
// Función pura: sin React ni base de datos, para poder fijar en pruebas la
// regla del promedio, que es la decisión clínica de todo esto.

import type { DietMeal, DietPlan } from '@/components/patient/patientDietTypes';

export type PlanTotals = {
  cal: number;
  prot: number;
  carbs: number;
  fat: number;
};

export type MacroSplit = {
  /** Porcentaje de las kcal que aportan los carbohidratos. */
  carbPct: number;
  protPct: number;
  fatPct: number;
};

export type WeekSummary = {
  /** Cuántos de los siete días tienen al menos una dieta. */
  daysWithPlan: number;
  /** Suma de toda la semana. */
  total: PlanTotals;
  /** Promedio POR DÍA CON DIETA (ver nota abajo). */
  average: PlanTotals;
  split: MacroSplit;
};

const ZERO: PlanTotals = { cal: 0, prot: 0, carbs: 0, fat: 0 };

/** Suma las kcal y macros de un plan, multiplicando por la cantidad de cada ítem. */
export const calcPlanTotals = (plan: DietPlan | null | undefined): PlanTotals => {
  if (!plan) return { ...ZERO };

  let cal = 0;
  let prot = 0;
  let carbs = 0;
  let fat = 0;

  for (const meal of plan.meals || []) {
    for (const item of meal.items || []) {
      const quantity = item.quantity || 1;
      cal += (item.calories || 0) * quantity;
      prot += (item.protein || 0) * quantity;
      carbs += (item.carbs || 0) * quantity;
      fat += (item.fat || 0) * quantity;
    }
  }

  return { cal: Math.round(cal), prot: Math.round(prot), carbs: Math.round(carbs), fat: Math.round(fat) };
};

/**
 * Reparto porcentual de las kcal por macronutriente.
 * Se calcula sobre las kcal que aportan los macros (4/4/9), no sobre el total
 * declarado del plan: si un alimento trae kcal pero no macros, el reparto
 * seguiría sumando 100 % en vez de quedarse corto sin explicación.
 */
export const macroSplit = (totals: PlanTotals): MacroSplit => {
  const macroKcal = totals.carbs * 4 + totals.prot * 4 + totals.fat * 9;
  if (macroKcal <= 0) return { carbPct: 0, protPct: 0, fatPct: 0 };

  return {
    carbPct: Math.round(((totals.carbs * 4) / macroKcal) * 100),
    protPct: Math.round(((totals.prot * 4) / macroKcal) * 100),
    fatPct: Math.round(((totals.fat * 9) / macroKcal) * 100),
  };
};

/**
 * Resume una semana.
 *
 * DEVUELVE null SI NO HAY NINGUNA DIETA. No devuelve ceros a propósito: cero
 * kilocalorías es un dato, y un dato falso. «No hay dietas esta semana» y
 * «esta semana el paciente comió 0 kcal» son cosas distintas, y en una pantalla
 * clínica no pueden verse igual.
 *
 * EL PROMEDIO SE DIVIDE ENTRE LOS DÍAS CON DIETA, NO ENTRE SIETE. Con 2 días
 * planificados, dividir entre siete daría ~480 kcal/día: un número que parece
 * inanición y que en realidad solo significa «faltan cinco días por planificar».
 * Dividido entre los días reales sí se puede comparar con el objetivo del
 * paciente. La pantalla debe enseñar `daysWithPlan` junto al promedio para que
 * no haya duda de qué se está mirando.
 */
export const summarizeWeek = (
  plansByDate: Record<string, DietPlan[]>,
  weekDays: readonly string[],
): WeekSummary | null => {
  const total: PlanTotals = { ...ZERO };
  let daysWithPlan = 0;

  for (const day of weekDays) {
    const plans = plansByDate[day] || [];
    if (plans.length === 0) continue;

    daysWithPlan += 1;
    for (const plan of plans) {
      const planTotals = calcPlanTotals(plan);
      total.cal += planTotals.cal;
      total.prot += planTotals.prot;
      total.carbs += planTotals.carbs;
      total.fat += planTotals.fat;
    }
  }

  if (daysWithPlan === 0) return null;

  const average: PlanTotals = {
    cal: Math.round(total.cal / daysWithPlan),
    prot: Math.round(total.prot / daysWithPlan),
    carbs: Math.round(total.carbs / daysWithPlan),
    fat: Math.round(total.fat / daysWithPlan),
  };

  return { daysWithPlan, total, average, split: macroSplit(average) };
};

/** Nombres de las comidas de un plan, ya limpios de vacíos. */
export const mealNames = (plan: DietPlan | null | undefined): string[] =>
  (plan?.meals || [])
    .map((meal: DietMeal) => (meal?.name || '').trim())
    .filter((name) => name.length > 0);

/**
 * Resumen corto de las comidas para la tarjeta del día: «Desayuno · Almuerzo · Cena».
 * Con más de `max` nombres corta y añade «+N», porque la tarjeta del día mide
 * poco más de cien píxeles de ancho.
 */
export const describeMeals = (plan: DietPlan | null | undefined, max = 4): string => {
  const names = mealNames(plan);
  if (names.length === 0) return '';
  if (names.length <= max) return names.join(' · ');
  return `${names.slice(0, max).join(' · ')} +${names.length - max}`;
};

/** «4 comidas» / «1 comida», para la lista de dietas que se pueden copiar. */
export const mealCountLabel = (plan: DietPlan | null | undefined): string => {
  const count = mealNames(plan).length;
  return `${count} ${count === 1 ? 'comida' : 'comidas'}`;
};
