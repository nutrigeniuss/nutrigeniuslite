// Peso ideal, rango saludable y peso corregido/ajustado.
import type { BmiCategory, IndicatorResult, Sex } from '../types';
import { isNum, round } from './shared';

/** West (18-60). Excel R21: ♀ Talla(m)²×20.9 · ♂ Talla(m)²×22.4. */
export const idealWeightWest = (heightCm?: number | null, sex?: Sex | null): IndicatorResult => {
  // Validación de entradas: si falta talla o sexo, devolvemos los campos faltantes
  // para que la UI pueda indicarle al usuario qué dato registrar.
  if (!isNum(heightCm) || !sex) {
    const missing: string[] = [];
    if (!isNum(heightCm)) missing.push('Talla');
    if (!sex) missing.push('Sexo');
    return { value: null, missing };
  }
  // Constante k según sexo (Excel R21).
  const k = sex === 'F' ? 20.9 : 22.4;
  const heightM = heightCm / 100;            // talla en metros
  const weightKg = k * heightM ** 2;         // peso ideal = k · talla(m)²
  return { value: round(weightKg, 2), detail: `Talla(m)² × ${k}` };
};

/**
 * Hamwi (18-65). Excel R22:
 *   ♀ 45.36 + 2.27 kg por cada 2.54 cm sobre 152.4 cm.
 *   ♂ 48.08 + 2.72 kg por cada 2.54 cm sobre 152.4 cm.
 */
export const idealWeightHamwi = (heightCm?: number | null, sex?: Sex | null): IndicatorResult => {
  // Se dice CUÁL falta, no los dos siempre: antes, a quien solo le faltaba el
  // sexo se le pedía además la talla que ya tenía puesta. Mismo criterio que
  // idealWeightWest, aquí arriba.
  if (!isNum(heightCm) || !sex) {
    const missing: string[] = [];
    if (!isNum(heightCm)) missing.push('Talla');
    if (!sex) missing.push('Sexo');
    return { value: null, missing };
  }
  const base = sex === 'F' ? 45.36 : 48.08;
  const perInch = sex === 'F' ? 2.27 : 2.72;
  const value = base + ((heightCm - 152.4) / 2.54) * perInch;
  return { value: round(value, 2), detail: 'Hamwi' };
};

// ── Los cortes clínicos, en UN solo sitio ─────────────────────────────
// Se exportan porque la pantalla y el informe impreso NECESITAN escribirlos en
// el rótulo: "IMC objetivo (21.7)". Los tenían copiados a mano, cada uno el
// suyo, y el día que se cambiara el criterio aquí —que es donde toca— el papel
// habría seguido diciendo el número viejo AL LADO del kilo nuevo.
//
// Es el mismo patrón que borró el ICT en silencio: un texto de pantalla
// haciendo de constante. Quien rotula, que lea de aquí.

/** Desde esta edad se usan los cortes de adulto mayor. */
export const EDAD_ADULTO_MAYOR = 60;

export const esAdultoMayor = (ageYears?: number | null): boolean =>
  isNum(ageYears) && ageYears >= EDAD_ADULTO_MAYOR;

/** IMC con el que se calcula el peso ideal. */
export const IMC_OBJETIVO = { adulto: 21.7, mayor: 25.5 } as const;

/** Rango de IMC considerado saludable. */
export const IMC_SALUDABLE = {
  adulto: { min: 18.5, max: 24.9 },
  mayor: { min: 23.1, max: 27.9 },
} as const;

/** El IMC objetivo que toca por edad. Lo usan la fórmula Y quien la rotula. */
export const imcObjetivoPara = (ageYears?: number | null): number =>
  (esAdultoMayor(ageYears) ? IMC_OBJETIVO.mayor : IMC_OBJETIVO.adulto);

/** El rango saludable que toca por edad, para el mismo fin. */
export const imcSaludablePara = (ageYears?: number | null): { min: number; max: number } =>
  (esAdultoMayor(ageYears) ? IMC_SALUDABLE.mayor : IMC_SALUDABLE.adulto);

/** Peso ideal por IMC objetivo (Excel R75-R76): 18-59 → 21.7×T²; ≥60 → 25.5×T². */
export const idealWeightByBmi = (
  heightCm?: number | null,
  ageYears?: number | null
): IndicatorResult => {
  if (!isNum(heightCm)) return { value: null, missing: ['Talla'] };
  const target = imcObjetivoPara(ageYears);
  return {
    value: round(target * (heightCm / 100) ** 2, 2),
    detail: `IMC objetivo ${target}`,
  };
};

/**
 * Rango de peso saludable (Excel R79-R82).
 *   18-59: mín 18.5×T², máx 24.9×T².
 *   ≥60:   mín 23.1×T², máx 27.9×T².
 */
export const healthyWeightRange = (
  heightCm?: number | null,
  ageYears?: number | null
): { min: IndicatorResult; max: IndicatorResult } => {
  if (!isNum(heightCm)) return { min: { value: null, missing: ['Talla'] }, max: { value: null, missing: ['Talla'] } };
  const { min: minBmi, max: maxBmi } = imcSaludablePara(ageYears);
  return {
    min: { value: round(minBmi * (heightCm / 100) ** 2, 2), detail: `IMC ${minBmi}` },
    max: { value: round(maxBmi * (heightCm / 100) ** 2, 2), detail: `IMC ${maxBmi}` },
  };
};

/**
 * Porcentaje de peso ideal (%PI) y su interpretación.
 *
 *     %PI = (peso actual ÷ peso ideal) × 100
 *
 * Sustituye al criterio anterior, que marcaba "Adecuado" cuando el peso actual
 * estaba a menos de 3 kg del ideal. Ese ±3 no salía de ninguna guía: era un
 * número elegido a ojo, y hacía que un mismo paciente saliera "Adecuado" por
 * dos fórmulas y "Por encima" por una tercera solo porque una se pasaba por
 * setecientos gramos. Tres etiquetas contradictorias para un IMC normal.
 *
 * El %PI sí es criterio clínico establecido, y además es proporcional: 3 kg no
 * significan lo mismo en alguien de 45 kg que en alguien de 110.
 *
 * Cortes en valoración nutricional del adulto:
 *   ≥120 obesidad · >110 sobrepeso · 90-110 normal
 *   80-90 desnutrición leve · 70-80 moderada · <70 severa
 *
 * El 110 cuenta como NORMAL, no como sobrepeso: el tramo normal es 90-110
 * ambos incluidos. Es la misma escala que usa %PCT, para que dos indicadores
 * del mismo paciente no discrepen en el borde.
 */
export type PercentIdealWeightCategory =
  | 'obesidad'
  | 'sobrepeso'
  | 'normal'
  | 'desnutricion_leve'
  | 'desnutricion_moderada'
  | 'desnutricion_severa';

export const percentIdealWeight = (
  currentWeightKg?: number | null,
  idealWeightKg?: number | null,
): IndicatorResult<number> & { category?: PercentIdealWeightCategory; label?: string } => {
  if (!isNum(currentWeightKg) || !isNum(idealWeightKg) || idealWeightKg <= 0) {
    const missing: string[] = [];
    if (!isNum(currentWeightKg)) missing.push('Peso');
    if (!isNum(idealWeightKg)) missing.push('Talla');
    return { value: null, missing };
  }

  const percent = round((currentWeightKg / idealWeightKg) * 100, 1);

  // Los tramos se escriben de menor a mayor y sin huecos: cada valor cae en uno
  // y solo uno. Con "≥120 obesidad" y "110-120 sobrepeso" escritos tal cual,
  // un 120 exacto quedaría en tierra de nadie.
  const [category, label]: [PercentIdealWeightCategory, string] =
    percent < 70 ? ['desnutricion_severa', 'Desnutrición severa']
    : percent < 80 ? ['desnutricion_moderada', 'Desnutrición moderada']
    : percent < 90 ? ['desnutricion_leve', 'Desnutrición leve']
    : percent <= 110 ? ['normal', 'Normal']
    : percent < 120 ? ['sobrepeso', 'Sobrepeso']
    : ['obesidad', 'Obesidad'];

  return { value: percent, category, label, detail: `${percent} % del peso ideal` };
};

/**
 * Peso corregido (obesidad). El Excel define +70, pero se usa la fórmula clínica
 * estándar (validada con el usuario): ((Peso actual − Peso ideal) × 0.25) + Peso ideal.
 * Solo se aplica cuando el IMC clasifica como obesidad.
 */
export const correctedWeight = (
  weightKg?: number | null,
  idealWeightKg?: number | null,
  bmiCategory?: BmiCategory
): IndicatorResult => {
  if (!isNum(weightKg) || !isNum(idealWeightKg)) {
    return { value: null, missing: ['Peso actual', 'Peso ideal'] };
  }
  const isObese = bmiCategory?.startsWith('obesidad');
  if (!isObese) return { value: null, detail: 'Solo aplica en obesidad' };
  return {
    value: round((weightKg - idealWeightKg) * 0.25 + idealWeightKg, 2),
    detail: '((Peso − Ideal) × 0.25) + Ideal',
  };
};

/** Peso ajustado (obesidad, para cálculos de requerimiento): PI + (PA − PI) × 0.25. */
export const adjustedWeight = (
  currentWeightKg?: number | null,
  idealWeightKg?: number | null
): IndicatorResult<number> => correctedWeight(currentWeightKg, idealWeightKg, 'obesidad_g1');
