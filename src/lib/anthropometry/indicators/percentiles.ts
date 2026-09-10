// Lookups en tablas de percentiles (perímetro brazo, AMB, pliegues).
import {
  AMB_PERCENTILES,
  ARM_CIRC_PERCENTILES,
  SUBSCAPULAR_PERCENTILES,
  TRI_SUB_SUM_PERCENTILES,
  TRICEPS_PERCENTILES,
} from '../tables.generated';
import type { IndicatorResult, PercentileRow, Sex } from '../types';
import { findPercentileRow, isNum, round, valueToPercentile } from './shared';

/** Resultado de un indicador por percentil. `outOfTable` avisa de que la edad
 *  del paciente quedó fuera de la tabla y se usó la fila más cercana. */
export type PercentileAssessment = IndicatorResult<number> & { outOfTable?: boolean };

/** Interpreta un percentil del perímetro de brazo (interpretación Excel M3-M5). */
const interpretArmPercentile = (pct: number): { label: string; severity: IndicatorResult['severity'] } => {
  if (pct < 5) return { label: 'Riesgo de desnutrición', severity: 'bad' };
  if (pct <= 95) return { label: 'Normal', severity: 'good' };
  return { label: 'Riesgo de obesidad/hipertrofia', severity: 'warn' };
};

/** Interpreta un percentil de AMB (Excel M28-M32). */
const interpretAmbPercentile = (pct: number): { label: string; severity: IndicatorResult['severity'] } => {
  if (pct <= 5) return { label: 'Musculatura reducida', severity: 'bad' };
  if (pct <= 15) return { label: 'Musculatura debajo del promedio', severity: 'warn' };
  if (pct <= 85) return { label: 'Musculatura promedio', severity: 'good' };
  if (pct <= 95) return { label: 'Musculatura arriba del promedio', severity: 'good' };
  return { label: 'Musculatura alta: buena nutrición', severity: 'good' };
};

/** Lookup genérico: dado valor, edad y sexo, devuelve percentil + interpretación.
 *  Si no existe fila para la edad, se devuelve el valor con la marca
 *  "Tablas no disponibles" (en lugar de ocultar el valor) para que la UI lo
 *  muestre y el usuario sepa que el indicador no aplica a ese rango etáreo. */
const percentileLookup = (
  table: { readonly M: readonly PercentileRow[]; readonly F: readonly PercentileRow[] },
  value: number | null | undefined,
  ageYears: number | null | undefined,
  sex: Sex | null | undefined,
  interpret: (pct: number) => { label: string; severity: IndicatorResult['severity'] }
): PercentileAssessment => {
  const missing: string[] = [];
  if (!isNum(value)) missing.push('Medición');
  if (!isNum(ageYears)) missing.push('Edad');
  if (!sex) missing.push('Sexo');
  if (missing.length || !isNum(value) || !isNum(ageYears) || !sex) return { value: null, missing };
  const row = findPercentileRow(table[sex], ageYears);
  if (!row) {
    return {
      value,
      classification: 'Tablas no disponibles',
      severity: 'info',
      detail: 'Edad fuera del rango cubierto por la tabla',
    };
  }
  const pct = round(valueToPercentile(row, value), 1);
  const { label, severity } = interpret(pct);
  // 0 y 100 no son percentiles de la tabla: marcan que el valor se salió por
  // abajo o por arriba. Se rotulan como tales para no escribir "Percentil 100",
  // que en una tabla que llega al p95 no significa nada.
  const pctLabel = pct === 0 ? 'Por debajo del percentil 5'
    : pct === 100 ? 'Por encima del percentil 95'
    : `Percentil ${pct}`;
  // Si la edad quedó fuera de la tabla, `findPercentileRow` la acerca a la fila
  // extrema. Se dice de qué fila salió el juicio: las tablas de pliegues y AMB
  // terminan a los 74.9 años y la del brazo a los 79.9, así que a un paciente
  // de 78 se le está aplicando el patrón de uno de 70-74. Sigue siendo la mejor
  // referencia disponible, pero el nutricionista tiene que poder verlo para
  // decidir cuánto peso le da.
  const outOfTable = ageYears < row.ageMin || ageYears > row.ageMax;
  const bandNote = `tabla de ${Math.floor(row.ageMin)}-${Math.floor(row.ageMax)} años`;
  return {
    value,
    classification: label,
    severity,
    detail: outOfTable ? `${pctLabel} · ${bandNote}` : pctLabel,
    outOfTable,
  };
};

export const armCircumferenceAssessment = (
  armCircumferenceCm?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
) => percentileLookup(ARM_CIRC_PERCENTILES, armCircumferenceCm, ageYears, sex, interpretArmPercentile);

export const ambAssessment = (
  ambCm2?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
) => percentileLookup(AMB_PERCENTILES, ambCm2, ageYears, sex, interpretAmbPercentile);

/** Pliegue tricipital / subescapular / suma tri+sub.
 *  Interpretación clínica según tabla estándar de percentiles (Frisancho):
 *    p ≤ 5  → Magro o deplección de masa grasa            (severo)
 *    p ≤ 15 → Masa grasa abajo del promedio o riesgo        (warn)
 *    p ≤ 75 → Masa grasa promedio                            (good)
 *    p ≤ 85 → Masa grasa arriba del promedio o riesgo        (warn)
 *    p > 85 → Exceso de masa grasa u obesidad                 (bad) */
const interpretSkinfoldPercentile = (pct: number): { label: string; severity: IndicatorResult['severity'] } => {
  if (pct <= 5)  return { label: 'Magro o deplección de masa grasa', severity: 'bad' };
  if (pct <= 15) return { label: 'Masa grasa abajo del promedio o riesgo', severity: 'warn' };
  if (pct <= 75) return { label: 'Masa grasa promedio', severity: 'good' };
  if (pct <= 85) return { label: 'Masa grasa arriba del promedio o riesgo', severity: 'warn' };
  return { label: 'Exceso de masa grasa u obesidad', severity: 'bad' };
};

export const tricepsAssessment = (
  tricepsMm?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
) => percentileLookup(TRICEPS_PERCENTILES, tricepsMm, ageYears, sex, interpretSkinfoldPercentile);

export const subscapularAssessment = (
  subscapularMm?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
) => percentileLookup(SUBSCAPULAR_PERCENTILES, subscapularMm, ageYears, sex, interpretSkinfoldPercentile);

export const triSubSumAssessment = (
  tricepsMm?: number | null,
  subscapularMm?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
) => {
  if (!isNum(tricepsMm) || !isNum(subscapularMm)) {
    const missing: string[] = [];
    if (!isNum(tricepsMm)) missing.push('Tríceps');
    if (!isNum(subscapularMm)) missing.push('Subescapular');
    return { value: null, missing } as PercentileAssessment;
  }
  return percentileLookup(
    TRI_SUB_SUM_PERCENTILES,
    tricepsMm + subscapularMm,
    ageYears,
    sex,
    interpretSkinfoldPercentile
  );
};
