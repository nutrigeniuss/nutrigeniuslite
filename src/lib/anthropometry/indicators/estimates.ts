// Talla y peso estimados (Chumlea / Rabito) para adultos mayores o encamados.
import type { IndicatorResult, Sex } from '../types';
import { isNum, round } from './shared';

/**
 * Talla estimada por altura de rodilla (Chumlea 1985), cm.
 *   ♂: 64.19 − (0.04 × edad) + (2.02 × AR).
 *   ♀: 84.88 − (0.24 × edad) + (1.83 × AR).
 * Útil en adultos mayores o pacientes encamados.
 */
export const estimateHeightChumlea = (
  kneeHeightCm?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(kneeHeightCm)) missing.push('Altura de rodilla');
  if (!isNum(ageYears)) missing.push('Edad');
  if (!sex) missing.push('Sexo');
  if (missing.length || !isNum(kneeHeightCm) || !isNum(ageYears) || !sex) return { value: null, missing };
  const value = sex === 'M'
    ? 64.19 - 0.04 * ageYears + 2.02 * kneeHeightCm
    : 84.88 - 0.24 * ageYears + 1.83 * kneeHeightCm;
  return { value: round(value, 2), detail: 'Chumlea (rodilla-talón)' };
};

/**
 * Peso estimado por Chumlea 1988 a partir de circunferencia de pantorrilla,
 * altura de rodilla y AMB.
 *   ♂: (0.98 × CP) + (1.16 × AR) + (1.73 × AMB) + (0.37 × PSE) − 81.69.
 *   ♀: (1.27 × CP) + (0.87 × AR) + (0.98 × AMB) + (0.4  × PSE) − 62.35.
 * (CP = pantorrilla cm, AR = altura rodilla cm, AMB = perímetro brazo cm, PSE = pliegue subescapular mm)
 */
export const estimateWeightChumlea = (
  calfCm?: number | null,
  kneeHeightCm?: number | null,
  armCircumferenceCm?: number | null,
  subscapularMm?: number | null,
  sex?: Sex | null
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(calfCm)) missing.push('Pantorrilla');
  if (!isNum(kneeHeightCm)) missing.push('Altura rodilla');
  if (!isNum(armCircumferenceCm)) missing.push('Perímetro brazo');
  if (!isNum(subscapularMm)) missing.push('Subescapular');
  if (!sex) missing.push('Sexo');
  if (missing.length || !isNum(calfCm) || !isNum(kneeHeightCm) || !isNum(armCircumferenceCm) || !isNum(subscapularMm) || !sex) {
    return { value: null, missing };
  }
  const v = sex === 'M'
    ? 0.98 * calfCm + 1.16 * kneeHeightCm + 1.73 * armCircumferenceCm + 0.37 * subscapularMm - 81.69
    : 1.27 * calfCm + 0.87 * kneeHeightCm + 0.98 * armCircumferenceCm + 0.40 * subscapularMm - 62.35;
  return { value: round(v, 2), detail: 'Chumlea 1988' };
};
