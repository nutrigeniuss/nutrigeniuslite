// =============================================================================
// Evaluación pediátrica por PERCENTILES (5–18 años) — lo que la OMS no publica:
//   * Perímetro braquial y área muscular del brazo (Frisancho 1990).
//   * Perímetro abdominal / riesgo cardiometabólico (Fernández 2004).
// -----------------------------------------------------------------------------
// Complementa (no reemplaza) los z-scores OMS de 0–5. El tramo adulto (18+) vive
// en tables.generated.ts; aquí SOLO está 5–17.9 → sin duplicación ni cruce.
// El AMB se calcula con la MISMA fórmula que el módulo de adulto (calcAMB).
// =============================================================================

import percentileData from './pediatricPercentiles.generated.json';
import { calcAMB } from '../indicators/circumferences';
import type { PediatricSex } from './zscore';
import type { PediatricClassification, PediatricEvaluation } from './classification';

const DATA = percentileData as unknown as {
  percentiles: number[];
  armCirc: { boys: number[][]; girls: number[][] };
  amb: { boys: number[][]; girls: number[][] };
  abdominal: { boys: number[][]; girls: number[][] };
};

// Banda de edad [ageMin, ageMax] que contiene la edad (años).
const rowForAgeBand = (rows: number[][], ageYears: number): number[] | null => {
  for (const row of rows) if (ageYears >= row[0] && ageYears <= row[1]) return row;
  return null;
};

// Percentil interpolado de una medición dados los cortes [P5..P95].
const interpPercentile = (pctList: number[], values: number[], m: number): number => {
  if (m <= values[0]) return pctList[0];
  if (m >= values[values.length - 1]) return pctList[pctList.length - 1];
  for (let i = 1; i < values.length; i++) {
    if (m <= values[i]) {
      const t = (m - values[i - 1]) / (values[i] - values[i - 1]);
      return pctList[i - 1] + t * (pctList[i] - pctList[i - 1]);
    }
  }
  return pctList[pctList.length - 1];
};

// Clasificación por percentiles (brazo, AMB). Cortes: <P5, P5-P15, P15-P85,
// P85-P95, >P95. values = [P5,P10,P15,P25,P50,P75,P85,P90,P95].
const evalByPercentile = (
  rows: number[][] | undefined,
  ageYears: number,
  m: number | null | undefined,
  indicator: string,
  label: string,
): PediatricEvaluation | null => {
  if (!rows) return null;
  const row = rowForAgeBand(rows, ageYears);
  if (!row || m === null || m === undefined || !Number.isFinite(m) || m <= 0) return null;
  const values = row.slice(2);

  let classification: PediatricClassification;
  let valueLabel: string;
  let percentile: number | undefined;
  if (m < values[0]) {
    classification = { label: 'Muy bajo', tone: 'warning' };
    valueLabel = '< P5';
  } else if (m > values[values.length - 1]) {
    classification = { label: 'Muy alto', tone: 'caution' };
    valueLabel = '> P95';
  } else {
    percentile = interpPercentile(DATA.percentiles, values, m);
    valueLabel = `P${Math.round(percentile)}`;
    if (m < values[2]) classification = { label: 'Bajo', tone: 'caution' };        // < P15
    else if (m <= values[6]) classification = { label: 'Normal', tone: 'normal' }; // P15–P85
    else classification = { label: 'Alto', tone: 'caution' };                      // P85–P95
  }
  return { indicator, indicatorLabel: label, valueLabel, percentile, classification };
};

export const evaluateArmCircPercentile = (
  sex: PediatricSex, ageYears: number, armCircCm?: number | null,
): PediatricEvaluation | null =>
  evalByPercentile(DATA.armCirc[sex], ageYears, armCircCm, 'armCircP', 'Perímetro braquial (percentil)');

export const evaluateAmbPercentile = (
  sex: PediatricSex, ageYears: number, armCircCm?: number | null, tricepsMm?: number | null,
): PediatricEvaluation | null => {
  const amb = calcAMB(armCircCm, tricepsMm, sex === 'boys' ? 'M' : 'F').value;
  if (amb === null || amb === undefined) return null;
  return evalByPercentile(DATA.amb[sex], ageYears, amb, 'ambP', 'Área muscular del brazo');
};

// Perímetro abdominal → riesgo cardiometabólico (Fernández 2004): < P75 bajo,
// P75–P90 alto, ≥ P90 muy alto. La tabla cubre de 2 a 17 años; a partir de 18
// manda el criterio de adulto en centímetros absolutos, que vive aparte.
export const evaluateAbdominalPercentile = (
  sex: PediatricSex, ageYears: number, abdominalCm?: number | null,
): PediatricEvaluation | null => {
  if (abdominalCm === null || abdominalCm === undefined || !Number.isFinite(abdominalCm) || abdominalCm <= 0) return null;
  const age = Math.floor(ageYears);
  const row = DATA.abdominal[sex].find((r) => r[0] === age);
  if (!row) return null;
  const [, , p75, p90] = row;

  let classification: PediatricClassification;
  let valueLabel: string;
  if (abdominalCm >= p90) {
    classification = { label: 'Riesgo muy alto', tone: 'critical' };
    valueLabel = '≥ P90';
  } else if (abdominalCm >= p75) {
    classification = { label: 'Riesgo alto', tone: 'high' };
    valueLabel = 'P75–P90';
  } else {
    classification = { label: 'Riesgo bajo', tone: 'normal' };
    valueLabel = '< P75';
  }
  return { indicator: 'abdominalP', indicatorLabel: 'Perímetro abdominal (riesgo)', valueLabel, classification };
};

/**
 * Rango esperado de perímetro abdominal para un niño, en centímetros.
 *
 * POR QUÉ HACE FALTA: el resto de campos del formulario saca su rango de las
 * tablas z de la OMS, que no publica perímetro abdominal. Al no haber rango
 * pediátrico, el formulario caía al de ADULTO (plausible 60–140 cm) y marcaba
 * en rojo "verifica la medición" en toda cintura infantil real: un niño de 5
 * años mide unos 53 cm, y uno de 2, unos 47.
 *
 * Es decir, avisaba de un error de medición precisamente cuando la medición
 * estaba bien. Un aviso que salta siempre se aprende a ignorar, y ahí deja de
 * servir también para los casos en que sí hay un dedo de más en la cinta.
 *
 * Cómo se construye: la fuente solo da P10, P75 y P90, sin los extremos. Se usa
 * la anchura entre P10 y P90 como unidad y se ensancha desde ahí, generoso a
 * propósito. Marcar de menos es preferible a marcar de más: la desnutrición y
 * la obesidad reales caen fuera de los percentiles centrales y no deben salir
 * en rojo como si fueran un error de la cinta métrica.
 */
export const abdominalFieldRange = (
  sex: PediatricSex, ageYears: number,
): { min: number; max: number; plausibleMin: number; plausibleMax: number } | null => {
  const age = Math.floor(ageYears);
  const row = DATA.abdominal[sex].find((r) => r[0] === age);
  if (!row) return null;
  const [, p10, , p90] = row;
  const span = p90 - p10;
  const r = (n: number) => Number(n.toFixed(0));
  return {
    plausibleMin: r(p10 - span * 0.6),
    plausibleMax: r(p90 + span * 0.6),
    // Suelo de 25 cm: por debajo no es un niño delgado, es un número mal
    // tecleado. Sin él, la anchura de los percentiles de un adolescente daría
    // un mínimo absurdo de veinte y pocos centímetros.
    min: Math.max(25, r(p10 - span * 1.5)),
    max: r(p90 + span * 1.5),
  };
};
