// Complexión corporal (talla / muñeca) y peso ideal por complexión.
import { COMPLEXION_TABLE } from '../tables.generated';
import { SEX_LABEL, type ComplexionFrame, type ComplexionRow, type IndicatorResult, type Sex } from '../types';
import { isNum, round } from './shared';

/**
 * Complexión corporal a partir de Talla(cm) / Perímetro de muñeca(cm).
 * Cortes Excel R28-R30:
 *   ♀: >11 chica · 10.1-11 mediana · <10.1 grande.
 *   ♂: >10.4 chica · 9.6-10.4 mediana · <9.6 grande.
 */
export const calcComplexionFrame = (
  heightCm?: number | null,
  wristCm?: number | null,
  sex?: Sex | null
): IndicatorResult<ComplexionFrame> => {
  if (!isNum(heightCm) || !isNum(wristCm) || !sex) {
    const missing: string[] = [];
    if (!isNum(heightCm)) missing.push('Talla');
    if (!isNum(wristCm)) missing.push('Muñeca');
    if (!sex) missing.push('Sexo');
    return { value: null, missing };
  }
  const ratio = heightCm / wristCm;
  const cuts = sex === 'F' ? { small: 11, medium: 10.1 } : { small: 10.4, medium: 9.6 };
  let frame: ComplexionFrame;
  if (ratio > cuts.small) frame = 'small';
  else if (ratio >= cuts.medium) frame = 'medium';
  else frame = 'large';
  const labelMap: Record<ComplexionFrame, string> = {
    small: 'Pequeña',
    medium: 'Mediana',
    large: 'Grande',
  };
  return {
    value: frame,
    classification: labelMap[frame],
    detail: `Talla/Muñeca = ${round(ratio, 2)}`,
  };
};

/** Busca el peso ideal por complexión en la tabla del Excel.
 *  Cobertura oficial: ♂ 158-193 cm · ♀ 148-183 cm.
 *  - Si la talla está fuera de la cobertura para el sexo dado, se devuelve
 *    `value: null` con `classification: 'Tablas no disponibles'` para que la
 *    UI lo muestre explícitamente al nutricionista.
 *  - Si está dentro de la cobertura, `value` es el punto medio del rango y
 *    `range` expone min/max para mostrar "X.X – Y.Y kg" en la UI.
 */
export const idealWeightByComplexion = (
  heightCm?: number | null,
  sex?: Sex | null,
  frame?: ComplexionFrame | null
): IndicatorResult & { range?: { min: number; max: number } } => {
  if (!isNum(heightCm) || !sex || !frame) {
    const missing: string[] = [];
    if (!isNum(heightCm)) missing.push('Talla');
    if (!sex) missing.push('Sexo');
    if (!frame) missing.push('Complexión');
    return { value: null, missing };
  }

  // Cobertura oficial de la tabla por sexo (límites del manual del usuario).
  const COVERAGE: Record<Sex, { min: number; max: number }> = {
    M: { min: 158, max: 193 },
    F: { min: 148, max: 183 },
  };
  const cov = COVERAGE[sex];

  // Si la talla queda fuera de la cobertura, no extrapolamos: devolvemos
  // explícitamente "Tablas no disponibles" (decisión de producto).
  if (heightCm < cov.min || heightCm > cov.max) {
    return {
      value: null,
      classification: 'Tablas no disponibles',
      severity: 'info',
      detail: `Cobertura: ${SEX_LABEL[sex]} ${sex === 'M' ? '158-193 cm' : '148-183 cm'}`,
    };
  }

  // Match con la fila más cercana en cm enteros, restringido al sexo.
  const target = Math.round(heightCm);
  let best: ComplexionRow | null = null;
  let bestDelta = Infinity;
  for (const row of COMPLEXION_TABLE) {
    if (row.sex !== sex) continue;
    const d = Math.abs(row.heightCm - target);
    if (d < bestDelta) {
      bestDelta = d;
      best = row;
    }
  }
  if (!best) {
    // Defensa: no debería ocurrir tras la validación de cobertura, pero queda
    // como red de seguridad si la tabla pierde alguna fila.
    return {
      value: null,
      classification: 'Tablas no disponibles',
      severity: 'info',
      detail: 'Talla sin fila correspondiente',
    };
  }
  const range = best[frame];
  // Punto medio del rango: lo usamos como `value` para mantener compatibilidad
  // con consumidores que solo leen un número (p. ej. comparación con peso real).
  const mid = (range.min + range.max) / 2;
  const frameLabel = frame === 'small' ? 'chica' : frame === 'medium' ? 'mediana' : 'grande';
  return {
    value: round(mid, 2),
    range: { min: round(range.min, 2), max: round(range.max, 2) },
    detail: `Complexión ${frameLabel}: ${round(range.min, 1)}–${round(range.max, 1)} kg`,
  };
};
