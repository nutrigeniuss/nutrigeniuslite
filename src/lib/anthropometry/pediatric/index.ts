// =============================================================================
// API pública del módulo antropométrico pediátrico + orquestador.
// -----------------------------------------------------------------------------
// Dado sexo, fecha de nacimiento y una medición (peso, talla/longitud, perímetro
// cefálico), decide qué indicadores de la OMS aplican según la edad y devuelve
// todos evaluados (z-score + clasificación). El adulto (≥19 años) queda fuera.
// =============================================================================

import { getIndicatorDomain, valueForZScore, DOMAIN_AGE_TOLERANCE_MONTHS, type PediatricIndicator, type PediatricSex } from './zscore';
import { evaluatePediatricIndicator, type PediatricEvaluation, type PediatricTone } from './classification';
import { calcWHtR, WHTR_LABELS } from '../indicators/circumferences';
import { normalizeSex } from '../indicators/shared';
import {
  abdominalFieldRange,
  evaluateAbdominalPercentile,
  evaluateAmbPercentile,
  evaluateArmCircPercentile,
} from './percentile';

export * from './zscore';
export * from './classification';
export * from './percentile';
export * from './growthCurves';
export * from './zemel';

import { evaluateZemel, getZemelDomain, hasDownSyndrome, ZEMEL_INFANT_MAX_MONTHS, ZEMEL_MAX_MONTHS, type ZemelPublicIndicator } from './zemel';

// Límite superior pediátrico: las tablas de la OMS llegan a 19 años (228 meses).
export const MAX_PEDIATRIC_MONTHS = 228;

// Normaliza el valor de "gender" del paciente al de las tablas OMS.
//
// Delega en `normalizeSex`, que es el único intérprete de ese campo en la app.
// Antes tenía su propia heurística y no coincidía con la del adulto: la letra
// suelta "M" era VARÓN aquí y MUJER allá, así que un mismo paciente podía
// evaluarse como niño en una pestaña y como mujer en la siguiente.
export const parseSex = (value?: string | null): PediatricSex | null => {
  const sex = normalizeSex(value);
  return sex === 'M' ? 'boys' : sex === 'F' ? 'girls' : null;
};

// Parseo local de fechas 'YYYY-MM-DD' (evita el corrimiento de un día que produce
// new Date('2022-01-01') en zonas UTC-negativas como Perú, donde queda 2021-12-31).
const parseLocalDate = (value: string): Date => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
};

// Edad en meses (fraccionaria, para interpolar el z-score con precisión). Cuenta
// meses calendario completos + la fracción del mes en curso, así "2 años exactos"
// da 24.0 (no 23.98). `atDate` = fecha de la medición (por defecto, hoy).
export const ageInMonths = (birthDate?: string | null, atDate?: string | null): number | null => {
  if (!birthDate) return null;
  const b = parseLocalDate(birthDate);
  const a = atDate ? parseLocalDate(atDate) : new Date();
  if (Number.isNaN(b.getTime()) || Number.isNaN(a.getTime()) || a.getTime() < b.getTime()) return null;

  let months = (a.getFullYear() - b.getFullYear()) * 12 + (a.getMonth() - b.getMonth());
  if (new Date(b.getFullYear(), b.getMonth() + months, b.getDate()).getTime() > a.getTime()) {
    months -= 1;
  }
  const anchor = new Date(b.getFullYear(), b.getMonth() + months, b.getDate());
  const next = new Date(b.getFullYear(), b.getMonth() + months + 1, b.getDate());
  const frac = (a.getTime() - anchor.getTime()) / (next.getTime() - anchor.getTime());
  return months + frac;
};

// Edad descompuesta en años, meses y días completos entre nacimiento y medición.
// Sirve para MOSTRAR la edad con la misma precisión con la que se calcula el
// z-score (que ya usa la edad fraccionaria, es decir, incluye los días).
export type AgeBreakdown = { years: number; months: number; days: number };

export const ageBreakdown = (birthDate?: string | null, atDate?: string | null): AgeBreakdown | null => {
  if (!birthDate) return null;
  const b = parseLocalDate(birthDate);
  const a = atDate ? parseLocalDate(atDate) : new Date();
  if (Number.isNaN(b.getTime()) || Number.isNaN(a.getTime()) || a.getTime() < b.getTime()) return null;

  let years = a.getFullYear() - b.getFullYear();
  let months = a.getMonth() - b.getMonth();
  let days = a.getDate() - b.getDate();
  if (days < 0) {
    months -= 1;
    // Días del mes calendario anterior a la fecha de medición (para "pedir prestado").
    days += new Date(a.getFullYear(), a.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
};

// Etiqueta legible: ≥1 año → "años, meses y días"; <1 año → "meses y días".
// Omite las partes en cero (p. ej. "1 año 5 meses" si días = 0).
export const formatAgeParts = (b: AgeBreakdown): string => {
  const y = b.years > 0 ? `${b.years} ${b.years === 1 ? 'año' : 'años'}` : '';
  const m = b.months > 0 ? `${b.months} ${b.months === 1 ? 'mes' : 'meses'}` : '';
  const d = b.days > 0 ? `${b.days} ${b.days === 1 ? 'día' : 'días'}` : '';
  const parts = b.years >= 1 ? [y, m, d] : [m, d];
  return parts.filter(Boolean).join(' ') || '0 días';
};

// Atajo: edad ya formateada directamente desde las fechas.
export const formatAgeFromDates = (birthDate?: string | null, atDate?: string | null): string | null => {
  const bd = ageBreakdown(birthDate, atDate);
  return bd ? formatAgeParts(bd) : null;
};

export type PediatricAgeGroup = 'under2' | '2to5' | '5to19';

export const resolveAgeGroup = (months: number): PediatricAgeGroup | null => {
  if (months < 0) return null;
  if (months < 24) return 'under2';
  if (months < 60) return '2to5';
  if (months < MAX_PEDIATRIC_MONTHS + 0.5) return '5to19';
  return null; // adulto
};

export const isPediatric = (months: number | null): boolean =>
  months !== null && resolveAgeGroup(months) !== null;

// ¿Se evalúa con carta pediátrica? Normalmente hasta 19 años (OMS); en síndrome
// de Down se extiende hasta 20 años (cartas de Zemel). Por encima → adulto.
export const isPediatricPatient = (months: number | null, pathologies?: string | string[] | null): boolean => {
  if (months === null) return false;
  if (hasDownSyndrome(pathologies)) return months >= 0 && months <= ZEMEL_MAX_MONTHS + 0.5;
  return isPediatric(months);
};

export type PediatricMeasurementInput = {
  sex: PediatricSex;
  ageMonths: number;
  weightKg?: number | null;
  heightCm?: number | null;          // longitud (acostado <2a) o talla (de pie)
  headCircCm?: number | null;        // perímetro cefálico (cm)
  armCircCm?: number | null;              // perímetro braquial / MUAC (cm)
  tricepsSkinfoldMm?: number | null;      // pliegue tricipital (mm)
  subscapularSkinfoldMm?: number | null;  // pliegue subescapular (mm)
  abdominalCm?: number | null;            // perímetro abdominal (cm)
  waistCm?: number | null;                // cintura (cm) — para el ICT desde los 5 años
};

export type PediatricAssessment = {
  ageMonths: number;
  ageGroup: PediatricAgeGroup;
  results: PediatricEvaluation[];
  // Referencia usada: 'oms' (patrones OMS/MINSA) o 'zemel' (cartas de Down 2015).
  standard?: 'oms' | 'zemel';
};

// Indicadores aplicables por tramo. wfl/wfh usan la TALLA como eje (x = cm) y el
// peso como valor; el resto usa la EDAD como eje (x = meses).
const INDICATORS_BY_GROUP: Record<PediatricAgeGroup, PediatricIndicator[]> = {
  under2: ['wfa', 'lhfa', 'wfl', 'hcfa', 'acfa', 'tsfa', 'ssfa'],
  '2to5': ['wfa', 'lhfa', 'wfh', 'hcfa', 'acfa', 'tsfa', 'ssfa'],
  '5to19': ['bmi', 'hfa'],
};

// Edad mínima (meses) para INTERPRETAR ciertos indicadores, aunque la tabla LMS
// exista antes. El perímetro braquial se interpreta desde los 6 meses (OMS 1997).
const INDICATOR_MIN_AGE_MONTHS: Partial<Record<PediatricIndicator, number>> = {
  acfa: 6,
};

// ICT (cintura/talla) de 5 a 19 años. No es un z-score ni un percentil: son los
// mismos cuatro cortes fijos del adulto (Ashwell 2012), y esa es justamente la
// gracia del indicador — el mismo número vale para el niño de cinco y para el
// adulto de setenta. Por eso se llama a `calcWHtR` en vez de copiar los cortes
// aquí: si mañana cambian, cambian en un solo sitio para toda la app.
// Las claves salen de WHTR_LABELS, no escritas a mano: si se renombra una
// clasificación, esta tabla la sigue sola. Antes eran literales y al cambiar
// las etiquetas la búsqueda falló, el tono quedó indefinido y el ICT
// DESAPARECIÓ de la ficha del niño y del informe, sin ningún aviso.
const WHTR_TONES: Record<string, PediatricTone> = {
  [WHTR_LABELS.bajoPeso]: 'caution',
  [WHTR_LABELS.saludable]: 'normal',
  [WHTR_LABELS.riesgoAumentado]: 'high',
  [WHTR_LABELS.riesgoAlto]: 'critical',
};

const evaluateWaistHeightRatio = (
  ageYears: number,
  waistCm?: number | null,
  heightCm?: number | null,
): PediatricEvaluation | null => {
  const ict = calcWHtR(waistCm, heightCm, ageYears);
  if (ict.value === null || !ict.classification) return null;
  const tone = WHTR_TONES[ict.classification];
  // Sin tono → es el "No aplica" de los menores de 5 años: no se muestra fila.
  if (!tone) return null;
  return {
    indicator: 'whtr',
    indicatorLabel: 'Índice Cintura-Talla (ICT)',
    valueLabel: ict.value.toFixed(2),
    classification: { label: ict.classification, tone },
  };
};

export const evaluatePediatric = (input: PediatricMeasurementInput): PediatricAssessment | null => {
  const group = resolveAgeGroup(input.ageMonths);
  if (!group) return null;

  const { sex, ageMonths, weightKg, heightCm, headCircCm, armCircCm, tricepsSkinfoldMm, subscapularSkinfoldMm, abdominalCm, waistCm } = input;
  const bmi = weightKg && heightCm ? weightKg / (heightCm / 100) ** 2 : null;

  const results: PediatricEvaluation[] = [];
  for (const indicator of INDICATORS_BY_GROUP[group]) {
    // Elegir el eje (x) y el valor según el indicador.
    let x: number | null = ageMonths;
    let value: number | null | undefined = null;
    switch (indicator) {
      case 'wfa': value = weightKg; break;                       // peso/edad
      case 'lhfa':
      case 'hfa': value = heightCm; break;                        // talla/edad
      case 'wfl':
      case 'wfh': x = heightCm ?? null; value = weightKg; break;  // peso/talla (x = talla)
      case 'bmi': value = bmi; break;                             // IMC/edad
      case 'hcfa': value = headCircCm; break;                     // perímetro cefálico
      case 'acfa': value = armCircCm; break;                      // perímetro braquial
      case 'tsfa': value = tricepsSkinfoldMm; break;              // pliegue tricipital
      case 'ssfa': value = subscapularSkinfoldMm; break;          // pliegue subescapular
    }
    if (x === null || value === null || value === undefined) continue;

    // Edad mínima de interpretación (ej. perímetro braquial desde los 6 meses).
    if (ageMonths < (INDICATOR_MIN_AGE_MONTHS[indicator] ?? 0)) continue;

    // Fuera del dominio de la tabla (ej. acfa/tsfa < 3 meses) → no se evalúa,
    // para no reportar un z-score extrapolado. En los ejes por edad se admite una
    // pequeña tolerancia para cubrir el borde 0–5a/5–19a (hueco en [60, 61) meses).
    const domain = getIndicatorDomain(indicator, sex);
    if (domain) {
      const tol = domain.unit === 'month' ? DOMAIN_AGE_TOLERANCE_MONTHS : 0;
      if (x < domain.min - tol || x > domain.max + tol) continue;
    }

    const evaluation = evaluatePediatricIndicator(indicator, sex, x, value);
    if (evaluation) results.push(evaluation);
  }

  // Indicadores por percentiles que la OMS no cubre. CADA FUENTE MANDA EN SU
  // TRAMO; antes iban los tres juntos bajo '5to19' y eso recortaba el abdominal
  // sin motivo:
  //
  //   · brazo y área muscular del brazo (Frisancho 1990) → desde los 5 años,
  //     que es donde empieza la publicación.
  //   · perímetro abdominal (Fernández 2004) → DESDE LOS 2 AÑOS. Se mide desde
  //     esa edad y la tabla trae las filas. Un niño de 3 con obesidad abdominal
  //     no daba ningún aviso de riesgo cardiovascular; simplemente no se
  //     calculaba.
  const ageYears = ageMonths / 12;

  if (group === '5to19') {
    const porBrazo = [
      evaluateArmCircPercentile(sex, ageYears, armCircCm),
      evaluateAmbPercentile(sex, ageYears, armCircCm, tricepsSkinfoldMm),
      // El ICT entra en el mismo tramo: se aplica desde los 5 años.
      evaluateWaistHeightRatio(ageYears, waistCm, heightCm),
    ];
    for (const r of porBrazo) if (r) results.push(r);
  }

  if (group === '2to5' || group === '5to19') {
    const abdominal = evaluateAbdominalPercentile(sex, ageYears, abdominalCm);
    if (abdominal) results.push(abdominal);
  }

  return { ageMonths, ageGroup: group, results };
};

// ── Trayectoria (progresión en el tiempo) ───────────────────────────────────
export type PediatricMeasurementRecord = {
  date?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  headCircCm?: number | null;
  armCircCm?: number | null;
  tricepsMm?: number | null;
  subscapularMm?: number | null;
};

export type TrajectoryPoint = { x: number; value: number; date?: string | null; isCurrent: boolean; ageLabel?: string };

// Para un indicador LMS de la OMS, mapea cada medición del historial a un punto
// (x, valor) dentro de su dominio → la línea de progresión del niño en la curva.
export const buildIndicatorTrajectory = (
  indicator: PediatricIndicator,
  sex: PediatricSex,
  birthDate: string | null | undefined,
  measurements: PediatricMeasurementRecord[],
  currentDate?: string | null,
): TrajectoryPoint[] => {
  const domain = getIndicatorDomain(indicator, sex);
  if (!domain) return [];

  // Talla/Edad: la OMS la parte en dos tablas adyacentes (lhfa 0–60 m, hfa
  // 61–228 m). Para NO botar los puntos del otro tramo cuando el historial cruza
  // los 5 años, filtramos por el dominio UNIDO (0–228 m). El z-score de cada
  // punto no cambia (se calcula aparte con su tabla). La curva de fondo la une
  // buildTrajectoryCurve con la misma regla "cada edad, su tabla".
  let domMin = domain.min;
  let domMax = domain.max;
  if (indicator === 'lhfa' || indicator === 'hfa') {
    const lo = getIndicatorDomain('lhfa', sex);
    const hi = getIndicatorDomain('hfa', sex);
    if (lo && hi) { domMin = lo.min; domMax = hi.max; }
  }

  const points: TrajectoryPoint[] = [];
  for (const m of measurements) {
    // Sin fecha no se puede ubicar la medición en el tiempo: `ageInMonths` caería
    // a "hoy" y el punto quedaría mal situado. Se omite.
    if (!m.date) continue;
    const months = ageInMonths(birthDate, m.date);
    if (months === null) continue;
    const bmi = m.weightKg && m.heightCm ? m.weightKg / (m.heightCm / 100) ** 2 : null;

    let x: number | null = months;
    let value: number | null | undefined = null;
    switch (indicator) {
      case 'wfa': value = m.weightKg; break;
      case 'lhfa':
      case 'hfa': value = m.heightCm; break;
      case 'wfl':
      case 'wfh': x = m.heightCm ?? null; value = m.weightKg; break;
      case 'bmi': value = bmi; break;
      case 'hcfa': value = m.headCircCm; break;
      case 'acfa': value = m.armCircCm; break;
      case 'tsfa': value = m.tricepsMm; break;
      case 'ssfa': value = m.subscapularMm; break;
      default: return [];
    }
    if (x === null || value === null || value === undefined || !Number.isFinite(x) || !Number.isFinite(value)) continue;
    if (x < domMin || x > domMax) continue;
    const bd = ageBreakdown(birthDate, m.date);
    const dateKey = (d?: string | null) => (d ? String(d).slice(0, 10) : null);
    points.push({
      x,
      value,
      date: m.date ?? null,
      isCurrent: !!currentDate && dateKey(m.date) === dateKey(currentDate),
      ageLabel: bd ? formatAgeParts(bd) : undefined,
    });
  }
  return points.sort((a, b) => a.x - b.x);
};

// Trayectoria para las cartas de Zemel (síndrome de Down). Igual idea que la OMS
// pero con los dominios de Zemel (0–20 años; peso/longitud solo ≤36 m).
export const buildZemelTrajectory = (
  indicator: ZemelPublicIndicator,
  sex: PediatricSex,
  birthDate: string | null | undefined,
  measurements: PediatricMeasurementRecord[],
  currentDate?: string | null,
): TrajectoryPoint[] => {
  const wflDomain = indicator === 'wfl' ? getZemelDomain('wfl', sex) : null;
  const points: TrajectoryPoint[] = [];
  for (const m of measurements) {
    if (!m.date) continue;
    const months = ageInMonths(birthDate, m.date);
    if (months === null || months < 0 || months > ZEMEL_MAX_MONTHS + 0.5) continue;
    const bmi = m.weightKg && m.heightCm ? m.weightKg / (m.heightCm / 100) ** 2 : null;

    let x: number | null = months;
    let value: number | null | undefined = null;
    switch (indicator) {
      case 'wfa': value = m.weightKg; break;
      case 'hfa': value = m.heightCm; break;
      case 'hcfa': value = m.headCircCm; break;
      case 'bmi': if (months < 24) continue; value = bmi; break; // IMC/edad desde 2 años
      case 'wfl':
        if (months > ZEMEL_INFANT_MAX_MONTHS) continue; // peso/longitud solo ≤36 m
        x = m.heightCm ?? null; value = m.weightKg;
        if (wflDomain && x !== null && (x < wflDomain.min || x > wflDomain.max)) continue;
        break;
      default: return [];
    }
    if (x === null || value === null || value === undefined || !Number.isFinite(x) || !Number.isFinite(value)) continue;
    const bd = ageBreakdown(birthDate, m.date);
    const dateKey = (d?: string | null) => (d ? String(d).slice(0, 10) : null);
    points.push({
      x,
      value,
      date: m.date ?? null,
      isCurrent: !!currentDate && dateKey(m.date) === dateKey(currentDate),
      ageLabel: bd ? formatAgeParts(bd) : undefined,
    });
  }
  return points.sort((a, b) => a.x - b.x);
};

// ── Rangos recomendados por campo, adaptados a la edad del niño ──────────────
// Las claves de campo del formulario de mediciones → indicador OMS por edad.
// La talla usa longitud/talla (lhfa) <5a y talla (hfa) 5–19a según el dominio.
const FIELD_TO_INDICATOR: Record<string, PediatricIndicator[]> = {
  weight: ['wfa'],
  height: ['lhfa', 'hfa'],
  cephalic: ['hcfa'],
  arm_relaxed: ['acfa'],
  triceps: ['tsfa'],
  subscapular: ['ssfa'],
};

export type FieldRange = { min: number; max: number; plausibleMin: number; plausibleMax: number };

// Devuelve el rango esperado (±3 DE ≈ plausible) y los límites duros para un campo
// del formulario, según sexo y edad del niño. Null si el campo no tiene tabla OMS
// o la edad está fuera del dominio (entonces se usa el rango de adulto por defecto).
export const pediatricFieldRange = (
  fieldKey: string,
  sex: PediatricSex | null,
  ageMonths: number | null,
): FieldRange | null => {
  if (!sex || ageMonths === null || !Number.isFinite(ageMonths)) return null;

  // El perímetro abdominal no sale de una tabla z de la OMS -no la publica-
  // sino de los percentiles de Fernández, así que se resuelve aparte. Si no
  // estuviera aquí, caería al rango de adulto y marcaría en rojo la cintura de
  // cualquier niño por ser normal para su edad.
  if (fieldKey === 'abdominal_per') return abdominalFieldRange(sex, ageMonths / 12);

  const candidates = FIELD_TO_INDICATOR[fieldKey];
  if (!candidates) return null;

  // Elegir el indicador cuya tabla (por edad, en meses) cubra la edad del niño.
  // Misma tolerancia de borde que evaluatePediatric, para no dejar sin rango el
  // hueco 0–5a/5–19a ([60, 61) meses) y caer al rango de adulto ese mes.
  let indicator: PediatricIndicator | null = null;
  for (const ind of candidates) {
    const dom = getIndicatorDomain(ind, sex);
    if (dom && dom.unit === 'month' && ageMonths >= dom.min - DOMAIN_AGE_TOLERANCE_MONTHS && ageMonths <= dom.max + DOMAIN_AGE_TOLERANCE_MONTHS) {
      indicator = ind;
      break;
    }
  }
  if (!indicator) return null;

  const lo = valueForZScore({ indicator, sex, x: ageMonths, z: -3 });
  const hi = valueForZScore({ indicator, sex, x: ageMonths, z: 3 });
  if (lo === null || hi === null || hi <= lo) return null;

  // Banda esperada = ±3 DE (redondeada). Límites duros = banda ensanchada, para
  // no marcar en rojo a un niño con desnutrición/obesidad real pero sí un dato absurdo.
  const span = hi - lo;
  const dec = fieldKey === 'weight' ? 1 : 0; // el peso admite un decimal
  const r = (n: number) => Number(n.toFixed(dec));
  return {
    plausibleMin: r(lo),
    plausibleMax: r(hi),
    min: Math.max(0, r(lo - span * 0.6)),
    max: r(hi + span * 0.6),
  };
};

// ── Rango "normal" por indicador, en unidades reales ─────────────────────────
// Banda de z-score considerada NORMAL/adecuada por la OMS para cada indicador
// (coincide con classifyZScore). No siempre es ±2: talla llega a +3, peso/talla
// e IMC a +1, y el perímetro braquial no tiene tope superior.
const NORMAL_Z: Record<PediatricIndicator, [number, number | null]> = {
  wfa: [-2, 2],
  lhfa: [-2, 3], hfa: [-2, 3],
  wfl: [-2, 2], wfh: [-2, 2],
  bmi: [-2, 1],
  hcfa: [-2, 2],
  acfa: [-2, null],
  tsfa: [-2, 2], ssfa: [-2, 2],
};

const INDICATOR_UNIT: Record<PediatricIndicator, string> = {
  wfa: 'kg', wfl: 'kg', wfh: 'kg',
  lhfa: 'cm', hfa: 'cm', hcfa: 'cm', acfa: 'cm',
  bmi: '', tsfa: 'mm', ssfa: 'mm',
};

export type NormalRange = { min: number; max: number | null; unit: string };

// Cuántos decimales hacen falta como máximo antes de rendirse. Con 3 la
// diferencia entre el límite exacto y el mostrado es de gramos: si a esa altura
// sigue habiendo empate es que la medición cae JUSTO sobre el límite.
const MAX_RANGE_DECIMALS = 3;

// Rango de la medición (kg/cm/mm) considerado normal para la edad/talla y sexo.
// `max` es null cuando la banda no tiene tope superior (p. ej. braquial).
//
// `measured` (la medición del paciente) es opcional pero conviene pasarla: los
// límites se redondean a 1 decimal para leerlos cómodos, y ese redondeo puede
// CONTRADECIR al diagnóstico. Caso real: niño de 91 cm y 15.5 kg → el límite de
// +2 DE es 15.478 kg, o sea que se pasa (z +2.02, "Sobrepeso"), pero redondeado
// se mostraba "Normal: 11.2 – 15.5 kg" y parecía estar dentro. Cuando el
// redondeo cruza así la medición, se muestran los decimales que hagan falta
// ("11.2 – 15.48 kg"); en el resto de los casos —casi siempre— se queda en uno.
export const pediatricNormalRange = (
  indicator: PediatricIndicator,
  sex: PediatricSex,
  x: number,
  measured?: number | null,
): NormalRange | null => {
  const band = NORMAL_Z[indicator];
  if (!band) return null;
  const [zMin, zMax] = band;
  const lo = valueForZScore({ indicator, sex, x, z: zMin });
  const hi = zMax === null ? null : valueForZScore({ indicator, sex, x, z: zMax });
  if (lo === null || (zMax !== null && hi === null)) return null;

  const r = (n: number, d: number) => Number(n.toFixed(d));
  // El veredicto con los límites EXACTOS es el que manda (es el mismo que da el
  // z-score); se buscan los decimales mínimos que lo respeten al mostrarlo.
  const v = typeof measured === 'number' && Number.isFinite(measured) ? measured : null;
  let decimals = 1;
  if (v !== null) {
    const inExact = v >= lo && (hi === null || v <= hi);
    while (decimals < MAX_RANGE_DECIMALS) {
      const loR = r(lo, decimals);
      const hiR = hi === null ? null : r(hi, decimals);
      if ((v >= loR && (hiR === null || v <= hiR)) === inExact) break;
      decimals += 1;
    }
  }
  return {
    min: r(lo, decimals),
    max: hi === null ? null : r(hi, decimals),
    unit: INDICATOR_UNIT[indicator],
  };
};

// "9.4 – 12.1 kg" · "≥ 11 cm" · "13.5 – 17.8" (IMC, sin unidad).
export const formatNormalRange = (nr: NormalRange): string => {
  const u = nr.unit ? ` ${nr.unit}` : '';
  return nr.max === null ? `≥ ${nr.min}${u}` : `${nr.min} – ${nr.max}${u}`;
};

// Banda normal expresada en z-score (constante por indicador), para reportes
// donde la fila ya está en desviaciones estándar (matriz de evolución).
export const pediatricNormalZLabel = (indicator: PediatricIndicator): string => {
  const band = NORMAL_Z[indicator];
  if (!band) return '';
  const [zMin, zMax] = band;
  return zMax === null ? `≥ ${zMin} DE` : `${zMin} a +${zMax} DE`;
};

// Banda normal en z (para posicionar la zona verde del medidor). El tope abierto
// (braquial) se representa como +3 = extremo superior de la escala del medidor.
export const pediatricNormalZBand = (indicator: PediatricIndicator): [number, number] | null => {
  const band = NORMAL_Z[indicator];
  if (!band) return null;
  const [zMin, zMax] = band;
  return [zMin, zMax === null ? 3 : zMax];
};

// Atajo desde los datos crudos del paciente (gender + birth_date) y una medición.
export const assessPatientMeasurement = (params: {
  gender?: string | null;
  birthDate?: string | null;
  measurementDate?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  headCircCm?: number | null;
  armCircCm?: number | null;
  tricepsSkinfoldMm?: number | null;
  subscapularSkinfoldMm?: number | null;
  abdominalCm?: number | null;
  waistCm?: number | null;
  // Diagnósticos del paciente (string CSV o lista). Si incluyen síndrome de Down
  // y la edad es 0–20 años, se usan las cartas de Zemel en vez de la OMS.
  pathologies?: string | string[] | null;
}): PediatricAssessment | null => {
  const sex = parseSex(params.gender);
  const months = ageInMonths(params.birthDate, params.measurementDate);
  if (!sex || months === null) return null;

  // Síndrome de Down 0–20 años → cartas de Zemel. Por encima de 20 años no hay
  // carta de Down: se devuelve null para que la pantalla use el panel de adulto.
  if (hasDownSyndrome(params.pathologies)) {
    if (months > ZEMEL_MAX_MONTHS + 0.5) return null;
    const zem = evaluateZemel({ sex, ageMonths: months, weightKg: params.weightKg, heightCm: params.heightCm, headCircCm: params.headCircCm });
    if (!zem || zem.results.length === 0) return null;
    return { ageMonths: months, ageGroup: resolveAgeGroup(months) ?? '5to19', results: zem.results, standard: 'zemel' };
  }

  return evaluatePediatric({
    sex,
    ageMonths: months,
    weightKg: params.weightKg,
    heightCm: params.heightCm,
    headCircCm: params.headCircCm,
    armCircCm: params.armCircCm,
    tricepsSkinfoldMm: params.tricepsSkinfoldMm,
    subscapularSkinfoldMm: params.subscapularSkinfoldMm,
    abdominalCm: params.abdominalCm,
    waistCm: params.waistCm,
  });
};
