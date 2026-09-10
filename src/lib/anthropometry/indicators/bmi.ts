// IMC (Índice de Masa Corporal).
import type { BmiCategory, IndicatorResult } from '../types';
import { isNum, round } from './shared';

/**
 * IMC = peso(kg) / talla(m)^2.
 * Clasificación según Excel:
 *   Adulto 18-59: <16 / 16-<17 / 17-<18.5 / 18.5-<25 / 25-<30 / 30-<35 / 35-<40 / ≥40.
 *   Adulto mayor ≥60: ≤23 / 23-<28 / 28-<32 / ≥32.
 */
export const calcBMI = (
  weightKg?: number | null,
  heightCm?: number | null,
  ageYears?: number | null
): IndicatorResult<number> & { category?: BmiCategory } => {
  const missing: string[] = [];
  if (!isNum(weightKg)) missing.push('Peso');
  if (!isNum(heightCm)) missing.push('Talla');
  if (missing.length || !isNum(weightKg) || !isNum(heightCm)) {
    return { value: null, missing };
  }
  const value = round(weightKg / (heightCm / 100) ** 2, 2);

  // Adulto mayor: criterios distintos.
  const isOlder = isNum(ageYears) && ageYears >= 60;
  let category: BmiCategory;
  let label: string;
  let severity: IndicatorResult['severity'];

  if (isOlder) {
    if (value <= 23) {
      category = 'delgadez_am';
      label = 'Delgadez';
      severity = 'bad';
    } else if (value < 28) {
      category = 'normal';
      label = 'Normal';
      severity = 'good';
    } else if (value < 32) {
      category = 'sobrepeso';
      label = 'Sobrepeso';
      severity = 'warn';
    } else {
      category = 'obesidad_am';
      label = 'Obesidad';
      severity = 'bad';
    }
  } else {
    if (value < 16) {
      category = 'delgadez_g3';
      label = 'Delgadez Grado 3';
      severity = 'bad';
    } else if (value < 17) {
      category = 'delgadez_g2';
      label = 'Delgadez Grado 2';
      severity = 'bad';
    } else if (value < 18.5) {
      category = 'delgadez_g1';
      label = 'Delgadez Grado 1';
      severity = 'warn';
    } else if (value < 25) {
      category = 'normal';
      label = 'Normal';
      severity = 'good';
    } else if (value < 30) {
      category = 'sobrepeso';
      label = 'Sobrepeso';
      severity = 'warn';
    } else if (value < 35) {
      category = 'obesidad_g1';
      label = 'Obesidad Grado 1';
      severity = 'bad';
    } else if (value < 40) {
      category = 'obesidad_g2';
      label = 'Obesidad Grado 2';
      severity = 'bad';
    } else {
      category = 'obesidad_g3';
      label = 'Obesidad Grado 3';
      severity = 'bad';
    }
  }

  return { value, classification: label, severity, category };
};
