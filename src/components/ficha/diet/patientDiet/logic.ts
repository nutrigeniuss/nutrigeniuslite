// Constantes y helpers puros de la dieta del paciente: clonado de comidas,
// búsqueda en el historial, resolución de mediciones y cálculo de macros de
// los planes por intercambios.
import { EXCHANGE_GROUPS, calcTotals } from '@/components/exchanges/exchangeData';
import type {
  DietMeal,
  ExchangePlan,
  ExchangeScenario,
  PatientDietRecord,
  PatientMeasurementRecord,
} from '../patientDietTypes';
import type { ExchangeMacroBreakdown } from './types';

// Antes había aquí un `export const TODAY = new Date().toISOString()...` con
// dos fallos: se calculaba en UTC (un domingo por la noche en Perú ya daba
// lunes) y se resolvía al importar el módulo, así que con la pestaña abierta
// desde el día anterior se seguía trabajando con la fecha de ayer. Ahora la
// fecha de hoy la da `todayLocalDateStr()` de lib/weekRange, que es local y se
// evalúa en el momento de pedirla.
export const DEFAULT_EXCHANGE_PLAN_TITLE = 'Plan por Intercambios';

export const genId = (): string => Math.random().toString(36).slice(2, 10);

export const normalizeSearchValue = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

// Algunos planes viejos o incompletos pueden traer meals con una forma inválida.
// La UI debe degradar con seguridad en vez de romper toda la pestaña.
export const asMealArray = (meals: unknown): DietMeal[] => {
  return Array.isArray(meals) ? (meals as DietMeal[]) : [];
};

// Clona la dieta base y regenera IDs locales para evitar colisiones entre comidas e ítems copiados.
export const cloneMeals = (meals: DietMeal[] | undefined): DietMeal[] => {
  return asMealArray(meals).map((meal) => ({
    ...meal,
    id: genId(),
    time: meal.time || '',
    items: Array.isArray(meal.items) ? meal.items.map((item) => ({ ...item, id: genId() })) : [],
  }));
};

export const buildPatientName = (patient: PatientDietRecord): string => {
  return patient.full_name || `${patient.name || patient.first_name || ''} ${patient.last_name || ''}`.trim();
};

export const buildPatientParam = (patient: PatientDietRecord, patientName: string): string => {
  // En calc la ficha es de sesión: no hay fila en `patients` de Supabase.
  const isSession = !patient.id || patient.id === 'session-ficha';
  const target = patient.target_calories || 2000;
  if (isSession) {
    return `patientName=${encodeURIComponent(patientName)}&targetCal=${target}`;
  }
  return `patientId=${patient.id}&patientName=${encodeURIComponent(patientName)}&targetCal=${target}`;
};

export const hasMacroConfiguration = (patient: PatientDietRecord): boolean => {
  return Boolean(
    patient.target_calories &&
    patient.macro_pct_protein != null &&
    patient.macro_pct_carbs != null &&
    patient.macro_pct_fat != null,
  );
};

export const formatDateLabel = (value?: string | null): string => {
  if (!value) return 'Sin fecha de referencia';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const buildExchangeDateSearchTokens = (value?: string | null): string[] => {
  if (!value) return [];

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return [value];
  }

  return [
    value,
    date.toLocaleDateString('es-ES'),
    date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }),
    date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    formatDateLabel(value),
  ];
};

// El historial debe responder tanto a nombres creados por el nutricionista
// como a búsquedas por fecha escrita en distintos formatos comunes.
export const matchesExchangeSearch = (plan: ExchangePlan, rawQuery: string): boolean => {
  const normalizedQuery = normalizeSearchValue(rawQuery);
  if (!normalizedQuery) return true;

  return [plan.title || DEFAULT_EXCHANGE_PLAN_TITLE, ...buildExchangeDateSearchTokens(plan.date)]
    .some((token) => normalizeSearchValue(token).includes(normalizedQuery));
};

export const asMeasurementArray = (measurements: unknown): PatientMeasurementRecord[] => {
  return Array.isArray(measurements) ? (measurements as PatientMeasurementRecord[]) : [];
};

export const resolveMeasurementForPlanDate = (measurements: PatientMeasurementRecord[] | undefined, targetDate?: string | null): PatientMeasurementRecord | null => {
  const datedMeasurements = asMeasurementArray(measurements)
    .filter((measurement) => measurement?.date)
    .sort((left, right) => new Date(`${right.date}T12:00:00`).getTime() - new Date(`${left.date}T12:00:00`).getTime());

  if (datedMeasurements.length === 0) {
    return null;
  }

  if (!targetDate) {
    return datedMeasurements[0] || null;
  }

  const exactMatch = datedMeasurements.find((measurement) => measurement.date === targetDate);
  if (exactMatch) {
    return exactMatch;
  }

  const targetTime = new Date(`${targetDate}T12:00:00`).getTime();
  const latestPrevious = datedMeasurements.find((measurement) => new Date(`${measurement.date}T12:00:00`).getTime() <= targetTime);

  // Si el plan se crea antes de cualquier medición registrada, degradamos a la última
  // medición disponible para no dejar el flujo sin referencia clínica.
  return latestPrevious || datedMeasurements[0] || null;
};

export const getPrimaryExchangeScenario = (plan: ExchangePlan): ExchangeScenario | null => {
  if (!Array.isArray(plan.scenarios) || plan.scenarios.length === 0) {
    return null;
  }

  if (plan.active_scenario_key) {
    const activeScenario = plan.scenarios.find((scenario) => scenario.key === plan.active_scenario_key);
    if (activeScenario) {
      return activeScenario;
    }
  }

  return plan.scenarios[0] || null;
};

export const getExchangeMeals = (plan: ExchangePlan): DietMeal[] => {
  const scenario = getPrimaryExchangeScenario(plan);
  return asMealArray(scenario?.meals).length > 0 ? asMealArray(scenario?.meals) : asMealArray(plan.meals);
};

export const getExchangePlanGroups = (plan: ExchangePlan) => {
  const scenario = getPrimaryExchangeScenario(plan);
  const activeGroupKeys = Array.isArray(scenario?.active_group_keys) && scenario.active_group_keys.length > 0
    ? scenario.active_group_keys
    : Array.isArray(plan.active_group_keys) && plan.active_group_keys.length > 0
      ? plan.active_group_keys
      : EXCHANGE_GROUPS.map((group) => group.key);

  return EXCHANGE_GROUPS.filter((group) => activeGroupKeys.includes(group.key));
};

export const getExchangePlanTotals = (plan: ExchangePlan) => calcTotals(getExchangeMeals(plan), getExchangePlanGroups(plan));

export const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

// Las tarjetas del historial usan macros calculadas desde los intercambios guardados.
// Si un plan no tiene datos suficientes, degradamos a la distribución configurada del paciente.
export const buildExchangeMacroBreakdown = (plan: ExchangePlan, fallback: ExchangeMacroBreakdown): ExchangeMacroBreakdown => {
  const totals = getExchangePlanTotals(plan);
  const carbsKcal = (totals.carbs || 0) * 4;
  const proteinKcal = (totals.protein || 0) * 4;
  const fatKcal = (totals.fat || 0) * 9;
  const totalMacroKcal = carbsKcal + proteinKcal + fatKcal;

  if (totalMacroKcal <= 0) {
    return fallback;
  }

  return {
    carbs: Math.round(clampPercentage((carbsKcal / totalMacroKcal) * 100)),
    protein: Math.round(clampPercentage((proteinKcal / totalMacroKcal) * 100)),
    fat: Math.round(clampPercentage((fatKcal / totalMacroKcal) * 100)),
  };
};
