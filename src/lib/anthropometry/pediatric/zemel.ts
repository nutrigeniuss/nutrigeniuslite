// =============================================================================
// Motor de evaluación del crecimiento en SÍNDROME DE DOWN (Zemel et al., 2015).
// -----------------------------------------------------------------------------
// Para pacientes con Down de 0 a 20 años se usan las cartas específicas de Down
// (no la OMS): cada medición se convierte a PERCENTIL respecto a la población con
// Down (método LMS) y se clasifica con los cortes clínicos por percentil.
//
// A partir de los 20 años (>240 meses) NO hay carta de Down disponible: el
// paciente se evalúa con los indicadores de adulto (esto lo decide el orquestador
// en index.ts; aquí solo cubrimos 0–20 años).
//
// Tramos (tablas SEPARADAS, sin interpolar entre estándares):
//   • Lactante ≤ 36 meses: wfa_inf, hfa_inf (longitud), wfl (peso/longitud), hcfa_inf
//   • 2–20 años (> 36 meses): wfa_ch, hfa_ch (talla), bmi, hcfa_ch
// =============================================================================

import tables from './zemelLms.generated.json';
import { DOMAIN_AGE_TOLERANCE_MONTHS, type PediatricSex } from './zscore';
import type { PediatricClassification, PediatricEvaluation, PediatricTone } from './classification';
import type { GrowthCurve, GrowthCurvePoint } from './growthCurves';

// Indicador "público" para gráficos (sin el sufijo de tramo _inf/_ch).
export type ZemelPublicIndicator = 'wfa' | 'hfa' | 'hcfa' | 'wfl' | 'bmi';

type LmsRow = [number, number, number, number]; // [x, L, M, S]
type ZemelKey = 'wfa_inf' | 'wfa_ch' | 'hfa_inf' | 'hfa_ch' | 'hcfa_inf' | 'hcfa_ch' | 'wfl' | 'bmi';
type ZemelTable = { unit: 'month' | 'cm'; boys: LmsRow[]; girls: LmsRow[] };

const TABLES = tables as unknown as Record<string, ZemelTable>;

// Edad (meses) a partir de la cual se dejan las cartas de lactante (0–3 años) y
// se pasa a las de 2–20 años.
export const ZEMEL_INFANT_MAX_MONTHS = 36;
export const ZEMEL_MAX_MONTHS = 240; // 20 años exactos

// ── LMS → z → percentil ──────────────────────────────────────────────────────
const lookupLMS = (rows: LmsRow[], x: number): { L: number; M: number; S: number } | null => {
  if (!rows || rows.length === 0) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (x <= first[0]) return { L: first[1], M: first[2], S: first[3] };
  if (x >= last[0]) return { L: last[1], M: last[2], S: last[3] };
  let lo = 0;
  let hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= x) lo = mid; else hi = mid;
  }
  const a = rows[lo];
  const b = rows[hi];
  const t = (x - a[0]) / (b[0] - a[0]);
  return { L: a[1] + t * (b[1] - a[1]), M: a[2] + t * (b[2] - a[2]), S: a[3] + t * (b[3] - a[3]) };
};

// z-score LMS "plano" (sin el ajuste de colas de la OMS): para percentiles es lo
// correcto, la clasificación por percentil usa la normal estándar directamente.
const zFromLMS = (value: number, L: number, M: number, S: number): number =>
  L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);

// Función error (Abramowitz-Stegun 7.1.26), error < 1.5e-7 → suficiente para el
// percentil clínico.
const erf = (x: number): number => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};

// z-score → percentil (0–100) por la CDF normal estándar.
const zToPercentile = (z: number): number => 50 * (1 + erf(z / Math.SQRT2));

// ── Clasificación por percentil (cortes clínicos, por indicador y tramo) ──────
const B = (label: string, tone: PediatricTone): PediatricClassification => ({ label, tone });

const classifyByPercentile = (key: ZemelKey, p: number): PediatricClassification => {
  switch (key) {
    case 'wfa_inf': // Peso/edad ≤36 m — desnutrición global / exceso
      if (p < 5) return B('Desnutrición global', 'warning');
      if (p < 10) return B('Normal (evaluar riesgo)', 'caution');
      if (p <= 90) return B('Normal', 'normal');
      return B('Exceso de peso', 'high');

    case 'wfa_ch': // Peso/edad 2–20 años
      if (p < 5) return B('Peso debajo de lo normal', 'warning');
      if (p <= 90) return B('Normal', 'normal');
      return B('Peso encima de lo normal', 'caution');

    case 'hfa_inf': // Longitud/edad ≤36 m — desnutrición crónica
      if (p < 5) return B('Talla baja (desnutrición crónica)', 'warning');
      if (p < 95) return B('Normal', 'normal');
      return B('Talla alta', 'caution');

    case 'hfa_ch': // Talla/edad 2–20 años
      if (p < 5) return B('Talla baja', 'warning');
      if (p < 95) return B('Normal', 'normal');
      return B('Talla alta', 'caution');

    case 'wfl': // Peso/longitud ≤36 m — desnutrición aguda / obesidad
      if (p < 5) return B('Desnutrición aguda', 'warning');
      if (p < 10) return B('Normal (evaluar riesgo)', 'caution');
      if (p <= 85) return B('Normal', 'normal');
      if (p <= 90) return B('Normal (evaluar riesgo)', 'caution');
      if (p <= 95) return B('Sobrepeso', 'high');
      return B('Obesidad', 'critical');

    case 'hcfa_inf': // Perímetro cefálico/edad ≤36 m
    case 'hcfa_ch':  // (mismos cortes micro/normal/macro en 2–20 años)
      if (p < 5) return B('Microcefalia', 'warning');
      if (p <= 95) return B('Normal', 'normal');
      return B('Macrocefalia', 'caution');

    case 'bmi': // IMC/edad 2–20 años
      if (p < 5) return B('Desnutrición aguda', 'warning');
      if (p <= 95) return B('Normal', 'normal');
      return B('Exceso de peso', 'high');

    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
};

// Etiqueta del indicador (el paciente ve "Peso para la edad (Down)", etc.).
const ZEMEL_LABEL: Record<ZemelKey, string> = {
  wfa_inf: 'Peso para la edad',
  wfa_ch: 'Peso para la edad',
  hfa_inf: 'Longitud para la edad',
  hfa_ch: 'Talla para la edad',
  hcfa_inf: 'Perímetro cefálico para la edad',
  hcfa_ch: 'Perímetro cefálico para la edad',
  wfl: 'Peso para la longitud',
  bmi: 'IMC para la edad',
};

// Percentil formateado: "P15", "< P1", "> P99".
const formatPercentile = (p: number): string => {
  if (p < 1) return '< P1';
  if (p > 99) return '> P99';
  return `P${Math.round(p)}`;
};

export const getZemelDomain = (key: ZemelKey, sex: PediatricSex): { unit: 'month' | 'cm'; min: number; max: number } | null => {
  const table = TABLES[key];
  if (!table) return null;
  const rows = table[sex];
  return { unit: table.unit, min: rows[0][0], max: rows[rows.length - 1][0] };
};

// Evalúa un indicador Zemel de punta a punta (percentil + clasificación). `x` =
// edad en meses (o longitud en cm para wfl); `value` = la medición. La clave
// pública (indicator) se normaliza para el gráfico/curvas ('wfa','hfa','hcfa',
// 'wfl','bmi'), pero la clasificación usa la clave de tramo.
const PUBLIC_INDICATOR: Record<ZemelKey, string> = {
  wfa_inf: 'wfa', wfa_ch: 'wfa', hfa_inf: 'hfa', hfa_ch: 'hfa',
  hcfa_inf: 'hcfa', hcfa_ch: 'hcfa', wfl: 'wfl', bmi: 'bmi',
};

const evaluateZemelKey = (
  key: ZemelKey,
  sex: PediatricSex,
  x: number,
  value: number,
): PediatricEvaluation | null => {
  const table = TABLES[key];
  if (!table || !Number.isFinite(x) || !Number.isFinite(value) || value <= 0) return null;
  const domain = getZemelDomain(key, sex)!;
  // Tolerancia SOLO en el borde inferior de ejes por edad: p. ej. talla/PC de
  // lactante empiezan en 1 mes, así un recién nacido (0 m) igual recibe evaluación
  // (clamp a la 1.ª fila). El borde superior se mantiene estricto: coincide con el
  // corte clínico de 20 años (a partir de ahí se usa el panel de adulto).
  const tolMin = table.unit === 'month' ? DOMAIN_AGE_TOLERANCE_MONTHS : 0;
  if (x < domain.min - tolMin || x > domain.max) return null; // fuera de la carta → no se evalúa
  const lms = lookupLMS(table[sex], x);
  if (!lms) return null;
  const z = zFromLMS(value, lms.L, lms.M, lms.S);
  if (!Number.isFinite(z)) return null;
  const percentile = Math.max(0, Math.min(100, zToPercentile(z)));
  return {
    indicator: PUBLIC_INDICATOR[key],
    indicatorLabel: ZEMEL_LABEL[key],
    valueLabel: formatPercentile(percentile),
    percentile,
    classification: classifyByPercentile(key, percentile),
    chartX: x,
    chartValue: value,
  };
};

export type ZemelInput = {
  sex: PediatricSex;
  ageMonths: number;
  weightKg?: number | null;
  heightCm?: number | null; // longitud (<2a) o talla
  headCircCm?: number | null;
};

export type ZemelAssessment = {
  ageMonths: number;
  results: PediatricEvaluation[];
};

// Evalúa TODOS los indicadores Zemel aplicables a la edad. Null si la edad está
// fuera de 0–20 años (el orquestador entonces usa indicadores de adulto).
export const evaluateZemel = (input: ZemelInput): ZemelAssessment | null => {
  const { sex, ageMonths, weightKg, heightCm, headCircCm } = input;
  if (!(ageMonths >= 0) || ageMonths > ZEMEL_MAX_MONTHS + 0.5) return null;

  const bmi = weightKg && heightCm ? weightKg / (heightCm / 100) ** 2 : null;
  const infant = ageMonths <= ZEMEL_INFANT_MAX_MONTHS;
  const results: PediatricEvaluation[] = [];
  const push = (e: PediatricEvaluation | null): void => { if (e) results.push(e); };

  if (infant) {
    if (weightKg != null) push(evaluateZemelKey('wfa_inf', sex, ageMonths, weightKg));
    if (heightCm != null) push(evaluateZemelKey('hfa_inf', sex, ageMonths, heightCm));
    if (weightKg != null && heightCm != null) push(evaluateZemelKey('wfl', sex, heightCm, weightKg)); // x = longitud
    if (headCircCm != null) push(evaluateZemelKey('hcfa_inf', sex, ageMonths, headCircCm));
  } else {
    if (weightKg != null) push(evaluateZemelKey('wfa_ch', sex, ageMonths, weightKg));
    if (heightCm != null) push(evaluateZemelKey('hfa_ch', sex, ageMonths, heightCm));
    if (bmi != null) push(evaluateZemelKey('bmi', sex, ageMonths, bmi));
    if (headCircCm != null) push(evaluateZemelKey('hcfa_ch', sex, ageMonths, headCircCm));
  }

  return { ageMonths, results };
};

// ── Curva de percentiles para graficar (P5/P10/P50/P90/P95) ──────────────────
const valueAtZ = (L: number, M: number, S: number, z: number): number =>
  L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);

// z de los percentiles que se dibujan como líneas de referencia.
const CHART_ZS = [-1.64485, -1.28155, 0, 1.28155, 1.64485];
// Etiquetas de las 5 líneas (de menor a mayor): sd3neg..sd3 en GrowthCurvePoint.
export const ZEMEL_LINE_LABELS: [string, string, string, string, string] = ['P5', 'P10', 'P50', 'P90', 'P95'];

// Filas (x + tabla) que componen la curva de un indicador público. Age-based:
// lactante ≤36 m + tramo 2–20 años (>36 m). wfl/bmi: una sola tabla.
const zemelCurveRows = (indicator: ZemelPublicIndicator, sex: PediatricSex): Array<{ x: number; key: ZemelKey }> => {
  const of = (key: ZemelKey): Array<{ x: number; key: ZemelKey }> => (TABLES[key]?.[sex] ?? []).map((r) => ({ x: r[0], key }));
  switch (indicator) {
    case 'wfa': return [...of('wfa_inf').filter((r) => r.x <= ZEMEL_INFANT_MAX_MONTHS), ...of('wfa_ch').filter((r) => r.x > ZEMEL_INFANT_MAX_MONTHS)];
    case 'hfa': return [...of('hfa_inf').filter((r) => r.x <= ZEMEL_INFANT_MAX_MONTHS), ...of('hfa_ch').filter((r) => r.x > ZEMEL_INFANT_MAX_MONTHS)];
    case 'hcfa': return [...of('hcfa_inf').filter((r) => r.x <= ZEMEL_INFANT_MAX_MONTHS), ...of('hcfa_ch').filter((r) => r.x > ZEMEL_INFANT_MAX_MONTHS)];
    case 'wfl': return of('wfl');
    case 'bmi': return of('bmi');
    default: return [];
  }
};

// Curva de referencia (líneas P5..P95) acotada a la ventana de los puntos, como
// en las curvas OMS. El z-score/percentil de cada punto no depende de esto.
export const buildZemelCurve = (
  indicator: ZemelPublicIndicator,
  sex: PediatricSex,
  pointsX: number[],
): GrowthCurve | null => {
  let rows = zemelCurveRows(indicator, sex);
  if (rows.length === 0) return null;
  const unit: 'month' | 'cm' = indicator === 'wfl' ? 'cm' : 'month';

  // Ventana para indicadores por edad que pueden cruzar el borde de 36 m.
  if (unit === 'month' && (indicator === 'wfa' || indicator === 'hfa' || indicator === 'hcfa')) {
    const xs = pointsX.filter((x) => Number.isFinite(x));
    const hasYoung = xs.some((x) => x <= ZEMEL_INFANT_MAX_MONTHS);
    const hasOld = xs.some((x) => x > ZEMEL_INFANT_MAX_MONTHS);
    if (hasYoung && hasOld && xs.length > 0) {
      const pad = 6;
      const lo = Math.max(0, Math.min(...xs) - pad);
      const hi = Math.min(ZEMEL_MAX_MONTHS, Math.max(...xs) + pad);
      rows = rows.filter((r) => r.x >= lo && r.x <= hi);
    } else if (hasOld) {
      rows = rows.filter((r) => r.x > ZEMEL_INFANT_MAX_MONTHS);
    } else {
      rows = rows.filter((r) => r.x <= ZEMEL_INFANT_MAX_MONTHS);
    }
  }

  const points: GrowthCurvePoint[] = rows.map(({ x, key }) => {
    const lms = lookupLMS(TABLES[key][sex], x)!;
    const v = CHART_ZS.map((z) => valueAtZ(lms.L, lms.M, lms.S, z));
    return { x, sd3neg: v[0], sd2neg: v[1], sd0: v[2], sd2: v[3], sd3: v[4], normalBand: [v[1], v[3]] as [number, number] };
  });
  return { unit, points, lineLabels: ZEMEL_LINE_LABELS };
};

// ¿Los diagnósticos del paciente incluyen síndrome de Down?
export const CANONICAL_DOWN_TAG = 'Síndrome de Down';
export const hasDownSyndrome = (pathologies?: string | string[] | null): boolean => {
  if (!pathologies) return false;
  const text = (Array.isArray(pathologies) ? pathologies.join(' ') : String(pathologies)).toLowerCase();
  // Formas explícitas del diagnóstico → siempre positivo.
  if (/s[ií]ndrome de down|down\s+syndrome|trisom[ií]a\s*21|trisomy\s*21/.test(text)) return true;
  // "down" como palabra suelta (un tag de diagnóstico), pero descartando el uso
  // coloquial de ánimo ("se siente down", "ánimo down", "medio/algo down") para no
  // enrutar por error a las cartas de Zemel a un paciente sin el síndrome.
  if (/(?:[aá]nimo|humor|siente|sentirse|estar|estoy|anda|andaba|medio|algo|muy|bastante|un poco|se ve|luce)\s+down/.test(text)) return false;
  return /(^|[^a-z])down([^a-z]|$)/.test(text);
};
