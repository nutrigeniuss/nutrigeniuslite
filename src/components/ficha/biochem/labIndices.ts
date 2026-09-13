// Índices bioquímicos derivados (sin React).
//
// Regla del módulo: estos valores NUNCA se persisten. Se recalculan a partir de
// `values` (lo que el nutri digitó del laboratorio) más el contexto del paciente
// cada vez que se pintan — igual que el modelo de 5 componentes de Evolución.
// Si mañana se corrige un HDL mal tipeado, todos los índices se corrigen solos;
// un valor guardado quedaría mintiendo.
//
// Segunda regla: cuando falta un insumo NO se estima ni se asume. El índice se
// devuelve con `missing` lleno y la tarjeta pide el dato. Un HOMA-IR calculado
// con una insulina inventada es peor que no tener HOMA-IR.

import type { LabEntry, Sex } from './biochemConfig';
import { parseLocalDate, patientAgeDecimalYears } from '@/lib/patients/age';

export type IndexTone = 'critical' | 'warning' | 'caution' | 'normal';

export type IndexBand = {
  /** Límite superior de la banda; la última banda no lo lleva (hasta ∞). */
  max?: number;
  label: string;
  tone: IndexTone;
};

export type MissingInput = {
  key: string;
  label: string;
  /** Dónde se completa: panel de la captura, o dato del paciente. */
  where: 'quimica' | 'clinica' | 'mediciones' | 'peso_habitual' | 'datos_generales';
};

export type IndexResult = {
  key: string;
  label: string;
  group: string;
  value: number | null;
  decimals: number;
  /** Fórmula con los valores ya reemplazados, para que el cálculo sea auditable. */
  formula: string | null;
  band: IndexBand | null;
  bands: IndexBand[];
  /** Dominio del gráfico de posición [min, max]. */
  domain: [number, number];
  /** true cuando valores más altos son peores (afecta cómo se dibuja la barra). */
  higherIsWorse: boolean;
  missing: MissingInput[];
  /** Procedencia de los insumos que no vienen del laboratorio. */
  sources: string[];
  /** Advertencias (p. ej. medición antropométrica lejana en el tiempo). */
  warnings: string[];
  reference: string;
  /** Clave del umbral editable, si el índice lo admite. */
  thresholdKey?: string;
  defaultThreshold?: number;
  /**
   * El índice usa el peso habitual del paciente. La tarjeta lo muestra y deja
   * corregirlo aunque ya esté cargado: es un dato de anamnesis que se tipea una
   * sola vez, así que un error se arrastraría sin que nadie lo note.
   */
  usesHabitualWeight?: boolean;
};

export type MeasurementLike = {
  date?: string | null;
  weight?: number | null;
  height?: number | null;
  skinfolds?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type IndexContext = {
  sex: Sex;
  birthDate?: string | null;
  measurements: MeasurementLike[];
  habitualWeightKg?: number | null;
  /** Umbrales personalizados por el nutricionista: { 'index:homa_ir': 2.8 }. */
  thresholds?: Record<string, number> | null;
  /**
   * Gestación activa. El NRI y el GNRI comparan el peso actual contra el
   * habitual o el ideal, y en embarazo el aumento es esperado: el cociente pasa
   * de 1 y el índice sale "sin riesgo" por el embarazo, no por el estado
   * nutricional. Se suprimen, igual que el % de cambio de peso en Resultados.
   */
  isPregnant?: boolean;
};

// Una medición antropométrica más lejana que esto se sigue usando, pero avisando.
export const ANTHRO_STALE_DAYS = 30;

const GROUP_NUTRITIONAL = 'Riesgo nutricional';
const GROUP_INSULIN = 'Resistencia a la insulina';
const GROUP_CARDIO = 'Riesgo cardiovascular';

const round = (value: number, decimals: number): number => {
  const d = Math.min(Math.max(0, decimals), 2);
  const factor = 10 ** d;
  return Math.round(value * factor) / factor;
};

const num = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const daysBetween = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null;
  const left = new Date(`${a}T12:00:00`).getTime();
  const right = new Date(`${b}T12:00:00`).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) return null;
  return Math.round(Math.abs(left - right) / 86_400_000);
};

/** Edad del paciente el día de la toma. Sale del cálculo común de la app
 *  (lib/patients/age), no de una copia propia de `ms / 365.25 días`. */
export const ageAt = (birthDate?: string | null, onDate?: string | null): number | null =>
  patientAgeDecimalYears(birthDate, (onDate ? parseLocalDate(onDate) : null) ?? new Date());

type AnthroPick = { value: number; date: string | null; daysApart: number | null };

/**
 * Busca el dato antropométrico más cercano EN FECHA a la toma de laboratorio.
 * Devuelve también a qué distancia quedó, para poder mostrarlo y advertir: usar
 * en silencio un peso de hace ocho meses es el tipo de error que nadie detecta.
 */
export const nearestAnthro = (
  measurements: MeasurementLike[],
  labDate: string | null | undefined,
  pick: (measurement: MeasurementLike) => unknown,
): AnthroPick | null => {
  const candidates = measurements
    .map((measurement) => ({ measurement, value: num(pick(measurement)) }))
    .filter((candidate): candidate is { measurement: MeasurementLike; value: number } => candidate.value !== null);

  if (candidates.length === 0) return null;

  const scored = candidates.map((candidate) => ({
    ...candidate,
    distance: daysBetween(candidate.measurement.date, labDate) ?? Number.MAX_SAFE_INTEGER,
  }));

  scored.sort((left, right) => left.distance - right.distance);
  const best = scored[0];

  return {
    value: best.value,
    date: best.measurement.date ?? null,
    daysApart: best.distance === Number.MAX_SAFE_INTEGER ? null : best.distance,
  };
};

const classify = (value: number | null, bands: IndexBand[]): IndexBand | null => {
  if (value === null) return null;
  for (const band of bands) {
    if (band.max === undefined || value < band.max) return band;
  }
  return bands[bands.length - 1] ?? null;
};

const formatSource = (label: string, pick: AnthroPick, unit: string): string => {
  const when = pick.date ? `Mediciones del ${pick.date}` : 'Mediciones';
  if (pick.daysApart === null || pick.daysApart === 0) return `${label} ${pick.value} ${unit} — ${when}`;
  return `${label} ${pick.value} ${unit} — ${when}, ${pick.daysApart} ${pick.daysApart === 1 ? 'día' : 'días'} de diferencia`;
};

const staleWarning = (pick: AnthroPick, label: string): string[] =>
  pick.daysApart !== null && pick.daysApart > ANTHRO_STALE_DAYS
    ? [`El ${label} más cercano es de hace ${pick.daysApart} días. Considera registrar una medición cercana a este examen.`]
    : [];

/** Peso ideal por Lorentz, el usado en la publicación original del GNRI. */
export const lorentzIdealWeight = (heightCm: number, sex: Sex): number | null => {
  if (!sex) return null;
  const divisor = sex === 'male' ? 4 : 2.5;
  return heightCm - 100 - (heightCm - 150) / divisor;
};

const threshold = (context: IndexContext, key: string, fallback: number): number =>
  num(context.thresholds?.[key]) ?? fallback;

// ── Índices ─────────────────────────────────────────────────────────────────

type Builder = (values: Record<string, unknown>, entry: LabEntry, context: IndexContext) => IndexResult;

// Índice de Riesgo Nutricional (Buzby). Ojo: la fórmula pide albúmina en g/L y
// el laboratorio la reporta en g/dL; la conversión ×10 va acá adentro.
const buildNRI: Builder = (values, entry, context) => {
  const albumin = num(values.albumin);
  const weight = nearestAnthro(context.measurements, entry.date, (m) => m.weight);
  const habitual = num(context.habitualWeightKg);

  const missing: MissingInput[] = [];
  if (albumin === null) missing.push({ key: 'albumin', label: 'Albúmina', where: 'quimica' });
  if (!weight) missing.push({ key: 'weight', label: 'Peso actual', where: 'mediciones' });
  if (habitual === null) missing.push({ key: 'habitual_weight', label: 'Peso habitual', where: 'peso_habitual' });

  const bands: IndexBand[] = [
    { max: 83.5, label: 'Riesgo severo', tone: 'critical' },
    { max: 97.5, label: 'Riesgo moderado', tone: 'warning' },
    { max: 100, label: 'Riesgo leve', tone: 'caution' },
    { label: 'Sin riesgo', tone: 'normal' },
  ];

  let value: number | null = null;
  let formula: string | null = null;

  if (albumin !== null && weight && habitual !== null && habitual > 0) {
    const albuminGL = albumin * 10;
    const raw = 1.519 * albuminGL + 41.7 * (weight.value / habitual);
    value = round(raw, 1);
    formula = `1.519 × ${round(albuminGL, 1)} g/L + 41.7 × (${weight.value} / ${habitual}) = ${value}`;
  }

  return {
    key: 'nri',
    label: 'Índice de Riesgo Nutricional (NRI)',
    group: GROUP_NUTRITIONAL,
    value,
    decimals: 2,
    formula,
    band: classify(value, bands),
    bands,
    domain: [75, 110],
    higherIsWorse: false,
    missing,
    sources: weight ? [formatSource('Peso', weight, 'kg')] : [],
    warnings: weight ? staleWarning(weight, 'peso') : [],
    reference: 'Buzby et al., 1988. Albúmina convertida a g/L (×10).',
    usesHabitualWeight: true,
  };
};

// GNRI: variante geriátrica que cambia el peso habitual —poco fiable en el
// adulto mayor— por el peso ideal calculado desde la talla.
const buildGNRI: Builder = (values, entry, context) => {
  const albumin = num(values.albumin);
  const weight = nearestAnthro(context.measurements, entry.date, (m) => m.weight);
  const height = nearestAnthro(context.measurements, entry.date, (m) => m.height);

  const missing: MissingInput[] = [];
  if (albumin === null) missing.push({ key: 'albumin', label: 'Albúmina', where: 'quimica' });
  if (!weight) missing.push({ key: 'weight', label: 'Peso actual', where: 'mediciones' });
  if (!height) missing.push({ key: 'height', label: 'Talla', where: 'mediciones' });
  if (!context.sex) missing.push({ key: 'sex', label: 'Sexo del paciente', where: 'datos_generales' });

  const bands: IndexBand[] = [
    { max: 82, label: 'Riesgo severo', tone: 'critical' },
    { max: 92, label: 'Riesgo moderado', tone: 'warning' },
    { max: 98, label: 'Riesgo bajo', tone: 'caution' },
    { label: 'Sin riesgo', tone: 'normal' },
  ];

  let value: number | null = null;
  let formula: string | null = null;

  if (albumin !== null && weight && height && context.sex) {
    const ideal = lorentzIdealWeight(height.value, context.sex);
    if (ideal !== null && ideal > 0) {
      const albuminGL = albumin * 10;
      // El cociente se trunca a 1: sin esto, el sobrepeso inflaría el índice.
      const ratio = Math.min(weight.value / ideal, 1);
      const raw = 1.489 * albuminGL + 41.7 * ratio;
      value = round(raw, 1);
      formula = `1.489 × ${round(albuminGL, 2)} g/L + 41.7 × ${round(ratio, 2)} = ${value} · peso ideal (Lorentz) ${round(ideal, 2)} kg`;
    }
  }

  return {
    key: 'gnri',
    label: 'Índice de Riesgo Nutricional Geriátrico (GNRI)',
    group: GROUP_NUTRITIONAL,
    value,
    decimals: 2,
    formula,
    band: classify(value, bands),
    bands,
    domain: [75, 110],
    higherIsWorse: false,
    missing,
    sources: [
      ...(weight ? [formatSource('Peso', weight, 'kg')] : []),
      ...(height ? [formatSource('Talla', height, 'cm')] : []),
    ],
    warnings: weight ? staleWarning(weight, 'peso') : [],
    reference: 'Bouillanne et al., 2005. Validado en ≥65 años; peso ideal por Lorentz.',
  };
};

// PNI de Buzby/Mullen. Escala INVERTIDA: más alto = peor pronóstico.
const buildPNI: Builder = (values, entry, context) => {
  const albumin = num(values.albumin);
  const transferrin = num(values.transferrin);
  const dth = num(values.delayed_hypersensitivity);
  const triceps = nearestAnthro(context.measurements, entry.date, (m) => m.skinfolds?.triceps);

  const missing: MissingInput[] = [];
  if (albumin === null) missing.push({ key: 'albumin', label: 'Albúmina', where: 'quimica' });
  if (!triceps) missing.push({ key: 'triceps', label: 'Pliegue tricipital', where: 'mediciones' });
  if (transferrin === null) missing.push({ key: 'transferrin', label: 'Transferrina', where: 'quimica' });
  if (dth === null) missing.push({ key: 'delayed_hypersensitivity', label: 'Hipersensibilidad retardada', where: 'clinica' });

  const bands: IndexBand[] = [
    { max: 40, label: 'Bajo riesgo', tone: 'normal' },
    { max: 50, label: 'Riesgo intermedio', tone: 'caution' },
    { label: 'Alto riesgo', tone: 'critical' },
  ];

  let value: number | null = null;
  let formula: string | null = null;

  if (albumin !== null && triceps && transferrin !== null && dth !== null) {
    const raw = 158 - 16.6 * albumin - 0.78 * triceps.value - 0.2 * transferrin - 5.8 * dth;
    value = round(raw, 1);
    formula = `158 − 16.6 × ${albumin} − 0.78 × ${triceps.value} − 0.20 × ${transferrin} − 5.8 × ${dth} = ${value}`;
  }

  return {
    key: 'pni',
    label: 'Índice de Pronóstico Nutricional (PNI)',
    group: GROUP_NUTRITIONAL,
    value,
    decimals: 2,
    formula,
    band: classify(value, bands),
    bands,
    domain: [20, 70],
    higherIsWorse: true,
    missing,
    sources: triceps ? [formatSource('Pliegue tricipital', triceps, 'mm')] : [],
    warnings: triceps ? staleWarning(triceps, 'pliegue tricipital') : [],
    reference: 'Buzby/Mullen, 1980. Hipersensibilidad retardada en escala 0-1-2 (Mullen).',
  };
};

const buildHomaIR: Builder = (values, _entry, context) => {
  const glucose = num(values.glucose_fasting);
  const insulin = num(values.insulin_fasting);
  const cut = threshold(context, 'index:homa_ir', 2.5);

  const missing: MissingInput[] = [];
  if (glucose === null) missing.push({ key: 'glucose_fasting', label: 'Glucosa en ayuno', where: 'quimica' });
  if (insulin === null) missing.push({ key: 'insulin_fasting', label: 'Insulina en ayunas', where: 'quimica' });

  const bands: IndexBand[] = [
    { max: cut, label: 'Sin resistencia', tone: 'normal' },
    { label: 'Resistencia a la insulina', tone: 'warning' },
  ];

  const value = glucose !== null && insulin !== null ? round((glucose * insulin) / 405, 2) : null;

  return {
    key: 'homa_ir',
    label: 'HOMA-IR',
    group: GROUP_INSULIN,
    value,
    decimals: 2,
    formula: value !== null ? `${glucose} × ${insulin} / 405 = ${value}` : null,
    band: classify(value, bands),
    bands,
    domain: [0, 8],
    higherIsWorse: true,
    missing,
    sources: [],
    warnings: [],
    reference: 'Matthews et al., 1985. El punto de corte varía por población y por ensayo de insulina.',
    thresholdKey: 'index:homa_ir',
    defaultThreshold: 2.5,
  };
};

const buildHomaBeta: Builder = (values, _entry, context) => {
  const glucose = num(values.glucose_fasting);
  const insulin = num(values.insulin_fasting);
  const cut = threshold(context, 'index:homa_beta', 100);

  const missing: MissingInput[] = [];
  if (glucose === null) missing.push({ key: 'glucose_fasting', label: 'Glucosa en ayuno', where: 'quimica' });
  if (insulin === null) missing.push({ key: 'insulin_fasting', label: 'Insulina en ayunas', where: 'quimica' });

  const bands: IndexBand[] = [
    { max: cut, label: 'Función β reducida', tone: 'warning' },
    { label: 'Función β conservada', tone: 'normal' },
  ];

  let value: number | null = null;
  let formula: string | null = null;
  const warnings: string[] = [];

  if (glucose !== null && insulin !== null) {
    const glucoseMmol = glucose / 18;
    const denominator = glucoseMmol - 3.5;
    if (denominator <= 0) {
      // Con glucemia ≤63 mg/dL la fórmula se indefine (denominador ≤ 0).
      warnings.push('Con una glucosa en ayuno de ' + glucose + ' mg/dL la fórmula del HOMA-β no es aplicable.');
    } else {
      value = round((20 * insulin) / denominator, 1);
      formula = `20 × ${insulin} / (${round(glucoseMmol, 2)} − 3.5) = ${value}`;
    }
  }

  return {
    key: 'homa_beta',
    label: 'HOMA-β',
    group: GROUP_INSULIN,
    value,
    decimals: 2,
    formula,
    band: classify(value, bands),
    bands,
    domain: [0, 250],
    higherIsWorse: false,
    missing,
    sources: [],
    warnings,
    reference: 'Matthews et al., 1985. 100 % ≈ función secretora normal de referencia.',
    thresholdKey: 'index:homa_beta',
    defaultThreshold: 100,
  };
};

const buildTyG: Builder = (values, _entry, context) => {
  const glucose = num(values.glucose_fasting);
  const triglycerides = num(values.triglycerides);
  const cut = threshold(context, 'index:tyg', 8.5);

  const missing: MissingInput[] = [];
  if (glucose === null) missing.push({ key: 'glucose_fasting', label: 'Glucosa en ayuno', where: 'quimica' });
  if (triglycerides === null) missing.push({ key: 'triglycerides', label: 'Triglicéridos', where: 'quimica' });

  const bands: IndexBand[] = [
    { max: cut, label: 'Normal', tone: 'normal' },
    { label: 'Resistencia a la insulina', tone: 'warning' },
  ];

  const value =
    glucose !== null && triglycerides !== null && glucose > 0 && triglycerides > 0
      ? round(Math.log((triglycerides * glucose) / 2), 2)
      : null;

  return {
    key: 'tyg',
    label: 'Índice TyG',
    group: GROUP_INSULIN,
    value,
    decimals: 2,
    formula: value !== null ? `Ln(${triglycerides} × ${glucose} / 2) = ${value}` : null,
    band: classify(value, bands),
    bands,
    domain: [7, 11],
    higherIsWorse: true,
    missing,
    sources: [],
    warnings: [],
    reference: 'Simental-Mendía et al., 2008. Corte poblacional habitual entre 8.5 y 8.8.',
    thresholdKey: 'index:tyg',
    defaultThreshold: 8.5,
  };
};

const buildTgHdl: Builder = (values, _entry, context) => {
  const triglycerides = num(values.triglycerides);
  const hdl = num(values.hdl);
  const cut = threshold(context, 'index:tg_hdl', 3);

  const missing: MissingInput[] = [];
  if (triglycerides === null) missing.push({ key: 'triglycerides', label: 'Triglicéridos', where: 'quimica' });
  if (hdl === null) missing.push({ key: 'hdl', label: 'Colesterol HDL', where: 'quimica' });

  const bands: IndexBand[] = [
    { max: cut, label: 'Normal', tone: 'normal' },
    { label: 'Riesgo aumentado', tone: 'warning' },
  ];

  const value = triglycerides !== null && hdl !== null && hdl > 0 ? round(triglycerides / hdl, 2) : null;

  return {
    key: 'tg_hdl',
    label: 'Cociente TG / HDL',
    group: GROUP_INSULIN,
    value,
    decimals: 2,
    formula: value !== null ? `${triglycerides} / ${hdl} = ${value}` : null,
    band: classify(value, bands),
    bands,
    domain: [0, 8],
    higherIsWorse: true,
    missing,
    sources: [],
    warnings: [],
    reference: 'Marcador indirecto de resistencia a la insulina y de LDL pequeñas y densas.',
    thresholdKey: 'index:tg_hdl',
    defaultThreshold: 3,
  };
};

const buildCastelliI: Builder = (values) => {
  const total = num(values.cholesterol_total);
  const hdl = num(values.hdl);

  const missing: MissingInput[] = [];
  if (total === null) missing.push({ key: 'cholesterol_total', label: 'Colesterol total', where: 'quimica' });
  if (hdl === null) missing.push({ key: 'hdl', label: 'Colesterol HDL', where: 'quimica' });

  const bands: IndexBand[] = [
    { max: 4.5, label: 'Deseable', tone: 'normal' },
    { label: 'Riesgo aumentado', tone: 'warning' },
  ];

  const value = total !== null && hdl !== null && hdl > 0 ? round(total / hdl, 2) : null;

  return {
    key: 'castelli_1',
    label: 'Índice de Castelli I (CT / HDL)',
    group: GROUP_CARDIO,
    value,
    decimals: 2,
    formula: value !== null ? `${total} / ${hdl} = ${value}` : null,
    band: classify(value, bands),
    bands,
    domain: [1, 9],
    higherIsWorse: true,
    missing,
    sources: [],
    warnings: [],
    reference: 'Castelli et al. Índice aterogénico clásico.',
  };
};

const buildCastelliII: Builder = (values) => {
  const ldl = num(values.ldl);
  const hdl = num(values.hdl);

  const missing: MissingInput[] = [];
  if (ldl === null) missing.push({ key: 'ldl', label: 'Colesterol LDL', where: 'quimica' });
  if (hdl === null) missing.push({ key: 'hdl', label: 'Colesterol HDL', where: 'quimica' });

  const bands: IndexBand[] = [
    { max: 3, label: 'Deseable', tone: 'normal' },
    { label: 'Riesgo aumentado', tone: 'warning' },
  ];

  const value = ldl !== null && hdl !== null && hdl > 0 ? round(ldl / hdl, 2) : null;

  return {
    key: 'castelli_2',
    label: 'Índice de Castelli II (LDL / HDL)',
    group: GROUP_CARDIO,
    value,
    decimals: 2,
    formula: value !== null ? `${ldl} / ${hdl} = ${value}` : null,
    band: classify(value, bands),
    bands,
    domain: [0, 7],
    higherIsWorse: true,
    missing,
    sources: [],
    warnings: [],
    reference: 'Castelli et al. Cociente LDL/HDL.',
  };
};

// AIP: definido con TG y HDL en mmol/L. Aplicarlo directo sobre mg/dL da otro
// número y rompe la interpretación, así que la conversión es parte del cálculo.
const MMOL_TG = 88.57;
const MMOL_CHOL = 38.67;

const buildAIP: Builder = (values) => {
  const triglycerides = num(values.triglycerides);
  const hdl = num(values.hdl);

  const missing: MissingInput[] = [];
  if (triglycerides === null) missing.push({ key: 'triglycerides', label: 'Triglicéridos', where: 'quimica' });
  if (hdl === null) missing.push({ key: 'hdl', label: 'Colesterol HDL', where: 'quimica' });

  const bands: IndexBand[] = [
    { max: 0.11, label: 'Riesgo bajo', tone: 'normal' },
    { max: 0.21, label: 'Riesgo medio', tone: 'caution' },
    { label: 'Riesgo alto', tone: 'critical' },
  ];

  let value: number | null = null;
  let formula: string | null = null;

  if (triglycerides !== null && hdl !== null && triglycerides > 0 && hdl > 0) {
    const tgMmol = triglycerides / MMOL_TG;
    const hdlMmol = hdl / MMOL_CHOL;
    value = round(Math.log10(tgMmol / hdlMmol), 2);
    formula = `log₁₀(${round(tgMmol, 2)} / ${round(hdlMmol, 2)} mmol/L) = ${value}`;
  }

  return {
    key: 'aip',
    label: 'Índice Aterogénico del Plasma (AIP)',
    group: GROUP_CARDIO,
    value,
    decimals: 2,
    formula,
    band: classify(value, bands),
    bands,
    domain: [-0.3, 0.6],
    higherIsWorse: true,
    missing,
    sources: [],
    warnings: [],
    reference: 'Dobiášová & Frohlich, 2001. Requiere TG y HDL en mmol/L (conversión automática).',
  };
};

const BUILDERS: Builder[] = [
  buildNRI,
  buildGNRI,
  buildPNI,
  buildHomaIR,
  buildHomaBeta,
  buildTyG,
  buildTgHdl,
  buildCastelliI,
  buildCastelliII,
  buildAIP,
];

/**
 * Calcula todos los índices de una toma.
 *
 * El GNRI solo se muestra en ≥65 años (población donde está validado) o cuando
 * falta el peso habitual y por tanto el NRI no puede calcularse: ahí sirve de
 * alternativa, siempre etiquetada, nunca reemplazando al NRI en silencio.
 */
export const computeIndices = (entry: LabEntry, context: IndexContext): IndexResult[] => {
  const values = entry.values || {};
  const age = ageAt(context.birthDate, entry.date);
  const hasHabitualWeight = num(context.habitualWeightKg) !== null;
  const showGNRI = (age !== null && age >= 65) || !hasHabitualWeight;

  const results = BUILDERS.map((build) => build(values, entry, context)).filter(
    (result) => result.key !== 'gnri' || showGNRI,
  );

  // En gestación los índices de riesgo ponderal quedan sin valor y con la nota,
  // en lugar de mostrar un número que induce a error.
  if (context.isPregnant) {
    return results.map((result) => (
      result.key === 'nri' || result.key === 'gnri'
        ? {
            ...result,
            value: null,
            formula: null,
            band: null,
            missing: [],
            sources: [],
            warnings: ['No aplica en gestación: el aumento de peso es esperado. Usa la ganancia por semana en Mediciones → Resultados.'],
            usesHabitualWeight: false,
          }
        : result
    ));
  }

  return results;
};

export const INDEX_GROUPS = [GROUP_NUTRITIONAL, GROUP_INSULIN, GROUP_CARDIO];
