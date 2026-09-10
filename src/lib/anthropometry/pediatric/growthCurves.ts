// =============================================================================
// Generación de curvas de crecimiento OMS para graficar. A partir de las tablas
// LMS, calcula las líneas de referencia (z = −3, −2, 0, +2, +3) a lo largo del
// dominio del indicador (edad en meses o talla en cm), sobre las que se marca el
// punto del niño. Reutiliza valueAtZ (el mismo motor verificado).
//
// IMPORTANTE: estas funciones son SOLO para dibujar. El z-score/clasificación se
// calculan aparte (zscore.ts/classification.ts) y NO dependen de aquí.
// =============================================================================

import tables from './whoLms.generated.json';
import { valueAtZ, type PediatricIndicator, type PediatricSex } from './zscore';

type LmsRow = [number, number, number, number]; // [x, L, M, S]

const TABLES = tables as unknown as Record<
  string,
  { unit: 'month' | 'cm'; boys: LmsRow[]; girls: LmsRow[] }
>;

export type GrowthCurvePoint = {
  x: number;
  sd3neg: number;
  sd2neg: number;
  sd0: number;
  sd2: number;
  sd3: number;
  // Rango [−2 DE, +2 DE] para sombrear la zona normal en el gráfico.
  normalBand: [number, number];
};

export type GrowthCurve = {
  unit: 'month' | 'cm';
  points: GrowthCurvePoint[];
  // Etiquetas de las 5 líneas (sd3neg..sd3). Ausente = z-scores OMS (−3/−2/0/2/3);
  // presente = percentiles (P5/P10/P50/P90/P95), usado por las curvas de Zemel.
  lineLabels?: [string, string, string, string, string];
};

// Familia "Talla para la edad": la OMS la parte en dos estándares —longitud/talla
// 0–5 años (lhfa, 0–60 m) y talla 5–19 años (hfa, 61–228 m)— que son rangos de
// edad ADYACENTES y NO solapados. Para graficar la trayectoria de un niño cuyo
// historial cruza los 5 años, las unimos en una sola curva continua. La regla es
// estricta: cada mes usa SU tabla (≤60 → lhfa, >60 → hfa); nunca se interpola
// cruzando el borde, así el z-score de cada punto es idéntico al oficial.
const HFA_FAMILY = new Set<PediatricIndicator>(['lhfa', 'hfa']);
const HFA_SPLIT_MONTHS = 60; // último mes cubierto por lhfa

// Convierte filas LMS en puntos de curva (5 líneas SD + banda normal).
const rowsToCurve = (rows: LmsRow[]): GrowthCurvePoint[] =>
  rows.map(([x, L, M, S]) => {
    const sd2neg = valueAtZ(L, M, S, -2);
    const sd2 = valueAtZ(L, M, S, 2);
    return {
      x,
      sd3neg: valueAtZ(L, M, S, -3),
      sd2neg,
      sd0: M,
      sd2,
      sd3: valueAtZ(L, M, S, 3),
      normalBand: [sd2neg, sd2] as [number, number],
    };
  });

// Devuelve las 5 líneas SD del indicador/sexo, en la resolución nativa de la
// tabla (mensual o cada 0.5 cm). Null si el indicador no es LMS/no existe.
export const buildGrowthCurve = (
  indicator: PediatricIndicator,
  sex: PediatricSex,
): GrowthCurve | null => {
  const table = TABLES[indicator];
  if (!table) return null;
  return { unit: table.unit, points: rowsToCurve(table[sex]) };
};

// Filas de Talla/Edad unidas 0–228 meses (lhfa 0–60 ++ hfa 61–228). Cada fila
// conserva su LMS oficial; no se mezcla nada en el borde.
const mergedHfaRows = (sex: PediatricSex): LmsRow[] | null => {
  const lo = TABLES['lhfa']?.[sex];
  const hi = TABLES['hfa']?.[sex];
  if (!lo || !hi) return null;
  return [...lo, ...hi];
};

// Curva de referencia adecuada para una TRAYECTORIA de puntos (en meses para los
// indicadores por edad). Para Talla/Edad:
//   • Si los puntos cruzan los 5 años (hay ≤60 m y >60 m) → curva unida, acotada
//     a la ventana de los puntos (con un pequeño margen).
//   • Si no cruzan → se muestra el tramo estándar del grupo (0–5 ó 5–19), igual
//     que antes.
// Para el resto de indicadores devuelve la curva simple (sin cambios).
export const buildTrajectoryCurve = (
  indicator: PediatricIndicator,
  sex: PediatricSex,
  pointsX: number[],
): GrowthCurve | null => {
  if (!HFA_FAMILY.has(indicator)) return buildGrowthCurve(indicator, sex);

  const rows = mergedHfaRows(sex);
  if (!rows) return buildGrowthCurve(indicator, sex);

  const xs = pointsX.filter((x) => Number.isFinite(x));
  const hasYoung = xs.some((x) => x <= HFA_SPLIT_MONTHS);
  const hasOld = xs.some((x) => x > HFA_SPLIT_MONTHS);

  let windowed: LmsRow[];
  if (hasYoung && hasOld) {
    // Cruza el borde: ventana = rango de los puntos ± 6 meses (dentro de 0–228).
    const pad = 6;
    const lo = Math.max(0, Math.min(...xs) - pad);
    const hi = Math.min(228, Math.max(...xs) + pad);
    windowed = rows.filter((r) => r[0] >= lo && r[0] <= hi);
  } else if (hasOld) {
    windowed = rows.filter((r) => r[0] > HFA_SPLIT_MONTHS); // tramo 5–19
  } else {
    windowed = rows.filter((r) => r[0] <= HFA_SPLIT_MONTHS); // tramo 0–5 (por defecto)
  }
  return { unit: 'month', points: rowsToCurve(windowed) };
};
