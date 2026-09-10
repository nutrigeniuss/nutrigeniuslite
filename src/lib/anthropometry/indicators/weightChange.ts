// Cambio de peso (Blackburn).
import type { IndicatorResult } from '../types';
import { isNum, round } from './shared';

export type LossWindowKey = '1w' | '1m' | '3m' | '6m';

export type LossWindow = {
  key: LossWindowKey;
  label: string;
  /** Días que representa la ventana. */
  days: number;
  /** Rango de % considerado pérdida SIGNIFICATIVA; por encima es severa. */
  significant: { min: number; max: number };
};

/**
 * Valores de referencia del % de cambio de peso.
 * Fuente: Luna D. "Prescripción Dietoterapéutica en Medicina", 1ª ed., Tabla 6.
 *
 *   Tiempo     Significativa   Severa
 *   1 semana      1-2 %         > 2 %
 *   1 mes           5 %         > 5 %
 *   3 meses       7-8 %         > 8 %
 *   6 meses        10 %         > 10 %
 *
 * Por debajo del corte de "significativa" la pérdida es NO significativa; los
 * valores que caen justo en el corte cuentan como significativa.
 */
export const LOSS_WINDOWS: readonly LossWindow[] = [
  { key: '1w', label: '1 semana', days: 7, significant: { min: 1, max: 2 } },
  { key: '1m', label: '1 mes', days: 30, significant: { min: 5, max: 5 } },
  { key: '3m', label: '3 meses', days: 90, significant: { min: 7, max: 8 } },
  { key: '6m', label: '6 meses', days: 180, significant: { min: 10, max: 10 } },
];

/** Más allá de este intervalo la tabla deja de aplicar y no se clasifica. */
export const MAX_LOSS_WINDOW_DAYS = 270;

export const findLossWindow = (key?: LossWindowKey | null): LossWindow | null =>
  LOSS_WINDOWS.find((window) => window.key === key) ?? null;

/**
 * Ventana propuesta para un intervalo real: la de ancla MÁS CERCANA en días
 * (los cortes quedan en 18, 60 y 135 días). Se prefiere la ventana más corta
 * ante un empate, que es la más exigente.
 *
 * No se interpola entre anclas a propósito: daría umbrales que no figuran en la
 * tabla y el nutricionista no podría contrastarlos con su fuente.
 */
export const nearestLossWindow = (daysElapsed?: number | null): LossWindowKey | null => {
  if (!isNum(daysElapsed) || daysElapsed < 0 || daysElapsed > MAX_LOSS_WINDOW_DAYS) return null;

  return LOSS_WINDOWS.reduce((best, window) =>
    Math.abs(daysElapsed - window.days) < Math.abs(daysElapsed - best.days) ? window : best,
  ).key;
};

export type WeightChangeResult = IndicatorResult<number> & {
  /** Ventana con la que se clasificó (nula si no se pudo determinar). */
  window?: LossWindow | null;
  /** true cuando la ventana la impuso el nutricionista y no el intervalo real. */
  windowIsManual?: boolean;
};

/**
 * % de cambio de peso = (Peso usual − Peso actual) / Peso usual × 100.
 *
 * `windowOverride` permite al nutricionista fijar la ventana cuando conoce el
 * curso real de la pérdida (p. ej. el peso usual es de hace seis meses pero la
 * caída ocurrió en las últimas tres semanas). Sin ventana no se clasifica: se
 * informa el porcentaje y nada más.
 */
export const weightChangePercent = (
  usualWeightKg?: number | null,
  currentWeightKg?: number | null,
  daysElapsed?: number | null,
  windowOverride?: LossWindowKey | null,
): WeightChangeResult => {
  if (!isNum(usualWeightKg) || !isNum(currentWeightKg) || usualWeightKg === 0) {
    const missing: string[] = [];
    if (!isNum(usualWeightKg) || usualWeightKg === 0) missing.push('Peso habitual');
    if (!isNum(currentWeightKg)) missing.push('Peso actual');
    return { value: null, missing };
  }

  const pct = round(((usualWeightKg - currentWeightKg) / usualWeightKg) * 100, 2);
  const window = findLossWindow(windowOverride) ?? findLossWindow(nearestLossWindow(daysElapsed));

  // Solo se clasifica una PÉRDIDA: una ganancia de peso no tiene cortes en esta
  // tabla y etiquetarla como "no significativa" induciría a error.
  if (pct <= 0 || !window) {
    return {
      value: pct,
      window,
      windowIsManual: Boolean(windowOverride),
      severity: 'info',
      detail: 'Blackburn',
    };
  }

  const { min, max } = window.significant;
  const classification = pct < min ? 'No significativa' : pct <= max ? 'Pérdida significativa' : 'Pérdida severa';
  const severity: IndicatorResult['severity'] = pct < min ? 'good' : pct <= max ? 'warn' : 'bad';

  return {
    value: pct,
    classification,
    severity,
    window,
    windowIsManual: Boolean(windowOverride),
    detail: `Blackburn · ${window.label}`,
  };
};
