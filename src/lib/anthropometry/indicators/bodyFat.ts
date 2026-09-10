// % de grasa corporal: Durnin-Womersley + Siri, Gallagher, Faulkner.
import type { IndicatorResult, Sex } from '../types';
import { isNum, round } from './shared';

/**
 * Densidad corporal por Durnin & Womersley 1974 (4 pliegues: bíceps, tríceps,
 * subescapular, suprailíaco). Constantes dependen del sexo y rango de edad.
 *   D = c − m × log10(Σ4 pliegues mm).
 */
const DURNIN_WOMERSLEY: Record<Sex, ReadonlyArray<{ ageMin: number; c: number; m: number }>> = {
  M: [
    { ageMin: 17, c: 1.1620, m: 0.0630 },
    { ageMin: 20, c: 1.1631, m: 0.0632 },
    { ageMin: 30, c: 1.1422, m: 0.0544 },
    { ageMin: 40, c: 1.1620, m: 0.0700 },
    { ageMin: 50, c: 1.1715, m: 0.0779 },
  ],
  F: [
    { ageMin: 16, c: 1.1549, m: 0.0678 },
    { ageMin: 20, c: 1.1599, m: 0.0717 },
    { ageMin: 30, c: 1.1423, m: 0.0632 },
    { ageMin: 40, c: 1.1333, m: 0.0612 },
    { ageMin: 50, c: 1.1339, m: 0.0645 },
  ],
};

/**
 * % grasa corporal por Durnin-Womersley (4 pliegues) → densidad → Siri.
 * Siri 1956:  %grasa = (495 / D) − 450.
 * Brozek 1963 (alternativa):  %grasa = (4.57 / D − 4.142) × 100.
 */
export const bodyFatDurninSiri = (
  bicepsMm?: number | null,
  tricepsMm?: number | null,
  subscapularMm?: number | null,
  suprailiacMm?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
): IndicatorResult<number> & { density?: number } => {
  const missing: string[] = [];
  if (!isNum(bicepsMm)) missing.push('Bíceps');
  if (!isNum(tricepsMm)) missing.push('Tríceps');
  if (!isNum(subscapularMm)) missing.push('Subescapular');
  if (!isNum(suprailiacMm)) missing.push('Suprailíaco');
  if (!isNum(ageYears)) missing.push('Edad');
  if (!sex) missing.push('Sexo');
  if (
    missing.length ||
    !isNum(bicepsMm) || !isNum(tricepsMm) || !isNum(subscapularMm) || !isNum(suprailiacMm) ||
    !isNum(ageYears) || !sex
  ) {
    return { value: null, missing };
  }
  const sum = bicepsMm + tricepsMm + subscapularMm + suprailiacMm;
  const table = DURNIN_WOMERSLEY[sex];
  // Selección por edad: el rango más alto cuyo ageMin sea ≤ edad.
  let entry = table[0];
  for (const e of table) if (ageYears >= e.ageMin) entry = e;
  const density = entry.c - entry.m * Math.log10(sum);
  const fatPct = (495 / density - 450);
  return {
    value: round(fatPct, 2),
    density: round(density, 4),
    detail: 'Durnin-Womersley + Siri',
  };
};

/**
 * Diagnóstico del % grasa corporal según Gallagher et al. 2000
 * (Manual de Instrucción Medidor de Grasa, Am J Clin Nutr Vol.72, Sep 2000).
 * Categorías: Bajo · Recomendado · Alto · Muy Alto, segmentado por sexo y
 * tres rangos etáreos (20-39, 40-59, 60-79 años). Para edades fuera del
 * rango se devuelve "Tablas no disponibles" conservando el valor.
 */
type GallagherRange = {
  ageMin: number; ageMax: number;
  bajoMax: number;        // valor ≤ bajoMax → "Bajo"
  recomendadoMax: number; // valor ≤ recomendadoMax (y > bajoMax) → "Recomendado"
  altoMax: number;        // valor ≤ altoMax → "Alto"; > altoMax → "Muy Alto"
};
const GALLAGHER_BODYFAT: Record<Sex, ReadonlyArray<GallagherRange>> = {
  M: [
    { ageMin: 20, ageMax: 39.9, bajoMax: 7,  recomendadoMax: 20, altoMax: 25 },
    { ageMin: 40, ageMax: 59.9, bajoMax: 10, recomendadoMax: 21, altoMax: 27 },
    { ageMin: 60, ageMax: 79.9, bajoMax: 12, recomendadoMax: 25, altoMax: 30 },
  ],
  F: [
    { ageMin: 20, ageMax: 39.9, bajoMax: 20, recomendadoMax: 33, altoMax: 38 },
    { ageMin: 40, ageMax: 59.9, bajoMax: 22, recomendadoMax: 34, altoMax: 40 },
    { ageMin: 60, ageMax: 79.9, bajoMax: 23, recomendadoMax: 36, altoMax: 41 },
  ],
};

export const bodyFatGallagherAssessment = (
  fatPct?: number | null,
  ageYears?: number | null,
  sex?: Sex | null
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(fatPct)) missing.push('% Grasa');
  if (!isNum(ageYears)) missing.push('Edad');
  if (!sex) missing.push('Sexo');
  if (missing.length || !isNum(fatPct) || !isNum(ageYears) || !sex) return { value: null, missing };

  // Selección de rango etáreo. Fuera de 20-79 años no hay tabla aplicable.
  const row = GALLAGHER_BODYFAT[sex].find(r => ageYears >= r.ageMin && ageYears <= r.ageMax);
  if (!row) {
    return {
      value: fatPct,
      classification: 'Tablas no disponibles',
      severity: 'info',
      detail: 'Gallagher 2000 cubre 20-79 años',
    };
  }
  // Clasificación: Bajo / Recomendado / Alto / Muy Alto.
  let label: string;
  let severity: IndicatorResult['severity'];
  if (fatPct <= row.bajoMax) {
    label = 'Bajo'; severity = 'warn';
  } else if (fatPct <= row.recomendadoMax) {
    label = 'Recomendado'; severity = 'good';
  } else if (fatPct <= row.altoMax) {
    label = 'Alto'; severity = 'warn';
  } else {
    label = 'Muy Alto'; severity = 'bad';
  }
  return { value: fatPct, classification: label, severity, detail: 'Gallagher 2000' };
};

/**
 * % grasa Faulkner (3-4 pliegues): %G = ΣP × 0.153 + 5.783.
 * Σ = tríceps + subescapular + supraespinal + abdominal (mm).
 */
export const bodyFatFaulkner = (
  tricepsMm?: number | null,
  subscapularMm?: number | null,
  supraspinalMm?: number | null,
  abdominalMm?: number | null
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(tricepsMm)) missing.push('Tríceps');
  if (!isNum(subscapularMm)) missing.push('Subescapular');
  if (!isNum(supraspinalMm)) missing.push('Supraespinal');
  if (!isNum(abdominalMm)) missing.push('Abdominal');
  if (
    missing.length ||
    !isNum(tricepsMm) || !isNum(subscapularMm) || !isNum(supraspinalMm) || !isNum(abdominalMm)
  ) {
    return { value: null, missing };
  }
  const sum = tricepsMm + subscapularMm + supraspinalMm + abdominalMm;
  return { value: round(sum * 0.153 + 5.783, 2), detail: 'Faulkner' };
};

/**
 * % grasa Yuhasz (1974), 6 pliegues.
 *   Σ = tríceps + subescapular + supraespinal + abdominal + muslo frontal +
 *       pantorrilla medial (mm)
 *   ♂ %G = Σ × 0.1051 + 2.585
 *   ♀ %G = Σ × 0.1548 + 3.580
 *
 * Pensada para población deportiva, donde Durnin-Womersley tiende a
 * sobreestimar. Pide dos pliegues de pierna que no todos los gabinetes toman.
 */
export const bodyFatYuhasz = (
  tricepsMm?: number | null,
  subscapularMm?: number | null,
  supraspinalMm?: number | null,
  abdominalMm?: number | null,
  frontThighMm?: number | null,
  medialCalfMm?: number | null,
  sex?: Sex | null,
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(tricepsMm)) missing.push('Tríceps');
  if (!isNum(subscapularMm)) missing.push('Subescapular');
  if (!isNum(supraspinalMm)) missing.push('Supraespinal');
  if (!isNum(abdominalMm)) missing.push('Abdominal');
  if (!isNum(frontThighMm)) missing.push('Muslo frontal');
  if (!isNum(medialCalfMm)) missing.push('Pantorrilla media');
  if (!sex) missing.push('Sexo');
  if (
    missing.length || !isNum(tricepsMm) || !isNum(subscapularMm) || !isNum(supraspinalMm)
    || !isNum(abdominalMm) || !isNum(frontThighMm) || !isNum(medialCalfMm) || !sex
  ) {
    return { value: null, missing };
  }

  const sum = tricepsMm + subscapularMm + supraspinalMm + abdominalMm + frontThighMm + medialCalfMm;
  const value = sex === 'M' ? sum * 0.1051 + 2.585 : sum * 0.1548 + 3.580;
  return { value: round(value, 2), detail: `Yuhasz · Σ6 = ${round(sum, 1)} mm` };
};

/**
 * RFM — Relative Fat Mass (Woolcott & Bergman, 2018).
 *
 *   RFM = 64 − (20 × talla / cintura) + (12 × sexo)     sexo: ♂ 0 · ♀ 12
 *
 * No usa ningún pliegue: solo talla y cintura. Es la única de las cuatro que
 * se puede calcular sin plicómetro, así que sirve cuando no hay equipo o
 * cuando los pliegues no son fiables (obesidad marcada, edema).
 */
export const bodyFatRFM = (
  heightCm?: number | null,
  waistCm?: number | null,
  sex?: Sex | null,
): IndicatorResult<number> => {
  const missing: string[] = [];
  if (!isNum(heightCm)) missing.push('Talla');
  if (!isNum(waistCm)) missing.push('Cintura');
  if (!sex) missing.push('Sexo');
  if (missing.length || !isNum(heightCm) || !isNum(waistCm) || !sex || waistCm <= 0) {
    return { value: null, missing: missing.length ? missing : ['Cintura'] };
  }

  const value = 64 - (20 * (heightCm / waistCm)) + (sex === 'F' ? 12 : 0);
  return { value: round(value, 2), detail: 'RFM · Woolcott & Bergman 2018' };
};
