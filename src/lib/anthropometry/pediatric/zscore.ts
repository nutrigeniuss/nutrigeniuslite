// =============================================================================
// Motor de z-score antropométrico pediátrico (método LMS de la OMS).
// -----------------------------------------------------------------------------
// A diferencia del adulto (IMC con cortes fijos), en niños cada medición se
// evalúa contra las curvas de crecimiento de la OMS según edad y sexo, y el
// resultado es un z-score (desviaciones estándar) que luego se clasifica.
//
// Tablas: whoLms.generated.json (generado por scripts/build-who-lms.mjs a partir
// de los .xlsx oficiales de la OMS). Formato de fila: [x, L, M, S].
//   x = edad en meses (indicadores por edad) o talla/longitud en cm (wfl/wfh)
//
// Fórmula LMS:  z = ((valor/M)^L − 1) / (L·S)   (o ln(valor/M)/S si L = 0)
// Con el ajuste de la OMS para colas extremas (|z| > 3).
// =============================================================================

import tables from './whoLms.generated.json';

export type PediatricIndicator = 'wfa' | 'lhfa' | 'hcfa' | 'bmi' | 'hfa' | 'wfl' | 'wfh' | 'acfa' | 'tsfa' | 'ssfa';
export type PediatricSex = 'boys' | 'girls';

// Tolerancia (en meses) al chequear el dominio de indicadores POR EDAD. La OMS
// parte sus tablas mensuales en dos estándares ADYACENTES y NO solapados (0–5a
// hasta 60 m; 5–19a desde 61 m), lo que deja un hueco en [60, 61) meses donde
// ningún indicador aplicaría (un niño de 5 años exactos se quedaba sin evaluar).
// Con esta tolerancia el borde se cubre: lookupLMS hace clamp a la fila extrema
// de la tabla y el error para <1.5 meses es clínicamente despreciable. SOLO
// aplica a ejes en meses; los ejes en cm (wfl/wfh) mantienen el chequeo estricto.
export const DOMAIN_AGE_TOLERANCE_MONTHS = 1.5;

type LmsRow = [number, number, number, number]; // [x, L, M, S]
type IndicatorTable = { unit: 'month' | 'cm'; boys: LmsRow[]; girls: LmsRow[] };

const TABLES = tables as unknown as Record<string, IndicatorTable>;

// Valor de la medición que corresponde a un z-score dado (inversa del LMS).
export const valueAtZ = (L: number, M: number, S: number, z: number): number =>
  L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);

// Interpola L, M, S linealmente en x (edad/talla) entre las filas de la tabla.
// Fuera de rango, usa el extremo (clamp) — la clasificación decide si es válido.
const lookupLMS = (rows: LmsRow[], x: number): { L: number; M: number; S: number } | null => {
  if (!rows || rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (x <= first[0]) return { L: first[1], M: first[2], S: first[3] };
  if (x >= last[0]) return { L: last[1], M: last[2], S: last[3] };

  // Búsqueda binaria del tramo [a, b] con a[0] <= x <= b[0].
  let lo = 0;
  let hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= x) lo = mid; else hi = mid;
  }
  const a = rows[lo];
  const b = rows[hi];
  const t = (x - a[0]) / (b[0] - a[0]);
  return {
    L: a[1] + t * (b[1] - a[1]),
    M: a[2] + t * (b[2] - a[2]),
    S: a[3] + t * (b[3] - a[3]),
  };
};

// z-score a partir de los parámetros LMS y el valor medido.
export const zFromLMS = (value: number, L: number, M: number, S: number): number => {
  let z = L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);

  // Ajuste OMS para |z| > 3: reexpresa la distancia en unidades de (SD3 − SD2),
  // para no sobreestimar valores muy extremos (curvas se aplanan en las colas).
  if (z > 3) {
    const sd3 = valueAtZ(L, M, S, 3);
    const sd2 = valueAtZ(L, M, S, 2);
    z = 3 + (value - sd3) / (sd3 - sd2);
  } else if (z < -3) {
    const sd3 = valueAtZ(L, M, S, -3);
    const sd2 = valueAtZ(L, M, S, -2);
    z = -3 + (value - sd3) / (sd2 - sd3);
  }
  return z;
};

export type ZScoreInput = {
  indicator: PediatricIndicator;
  sex: PediatricSex;
  x: number;      // edad en meses (por edad) o talla/longitud en cm (wfl/wfh)
  value: number;  // peso (kg), talla (cm), IMC o perímetro cefálico (cm)
};

// z-score de una medición. Devuelve null si faltan datos o el indicador no existe.
export const computeZScore = ({ indicator, sex, x, value }: ZScoreInput): number | null => {
  const table = TABLES[indicator];
  if (!table || !Number.isFinite(x) || !Number.isFinite(value) || value <= 0) return null;
  const lms = lookupLMS(table[sex], x);
  if (!lms) return null;
  return zFromLMS(value, lms.L, lms.M, lms.S);
};

// Valor de la medición que corresponde a un z-score dado, según edad/talla y sexo.
// (Inversa del LMS interpolando la tabla en x.) Devuelve null si no hay tabla.
export const valueForZScore = ({ indicator, sex, x, z }: {
  indicator: PediatricIndicator;
  sex: PediatricSex;
  x: number;
  z: number;
}): number | null => {
  const table = TABLES[indicator];
  if (!table || !Number.isFinite(x)) return null;
  const lms = lookupLMS(table[sex], x);
  if (!lms) return null;
  const v = valueAtZ(lms.L, lms.M, lms.S, z);
  return Number.isFinite(v) ? v : null;
};

// Rango de x cubierto por la tabla (para saber si la edad/talla está soportada).
export const getIndicatorDomain = (
  indicator: PediatricIndicator,
  sex: PediatricSex,
): { unit: 'month' | 'cm'; min: number; max: number } | null => {
  const table = TABLES[indicator];
  if (!table) return null;
  const rows = table[sex];
  return { unit: table.unit, min: rows[0][0], max: rows[rows.length - 1][0] };
};
