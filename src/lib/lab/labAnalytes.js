// Catálogo de analitos de laboratorio y resolución de rangos — DATOS Y LÓGICA
// PURA, en JavaScript a propósito.
//
// Por qué JS y no TS: este módulo lo consumen dos mundos.
//   • El cliente, vía components/patient/biochem/biochemConfig.ts, que le pone
//     tipos y agrega los helpers de UI.
//   • El servidor, vía lib/ai/patientContext.js, que corre como función de
//     Vercel en JS puro y no puede importar TypeScript.
//
// Vive aquí para que el rango de referencia con el que la app pinta un valor en
// rojo sea EXACTAMENTE el mismo con el que el asistente de IA lo interpreta. Si
// el nutricionista ajusta el rango porque su laboratorio usa otro insumo, ambos
// lados quedan sincronizados sin que nadie tenga que acordarse de copiarlo.
//
// Los rangos del catálogo son solo valores por defecto: se sobrescriben a nivel
// de cuenta ("mi laboratorio") o puntualmente en una toma — ver resolveRange.

import { normalizeSexRaw } from '../patients/sex.js';

const POSITIVITY = [
  { value: 'Negativo', label: 'Negativo' },
  { value: 'Trazas', label: 'Trazas' },
  { value: '+', label: '+' },
  { value: '++', label: '++' },
  { value: '+++', label: '+++' },
];

// Los rangos por defecto replican los del formulario de referencia del cliente,
// salvo en los analitos donde diferenciar por sexo es el estándar clínico
// (eritrocitos, hemoglobina, hematocrito, ácido úrico, creatinina y HDL), que
// usan refBySex. Todos son editables por el nutricionista.
export const PANELS = [
  {
    key: 'quimica',
    label: 'Química sanguínea',
    analytes: [
      { key: 'sodium', label: 'Na+', unit: 'mEq/L', kind: 'number', step: 1, ref: { min: 136, max: 145 } },
      { key: 'potassium', label: 'K+', unit: 'mEq/L', kind: 'number', step: 0.1, ref: { min: 3.5, max: 5.5 } },
      { key: 'chloride', label: 'Cl-', unit: 'mEq/L', kind: 'number', step: 1, ref: { min: 95, max: 105 } },
      { key: 'bicarbonate', label: 'HCO3 (o CO2 total)', unit: 'mEq/L', kind: 'number', step: 1, ref: { min: 22, max: 28 } },
      {
        key: 'uric_acid',
        label: 'Ácido úrico',
        unit: 'mg/dL',
        kind: 'number',
        step: 0.1,
        refBySex: { male: { min: 3.4, max: 7 }, female: { min: 2.4, max: 6 } },
      },
      { key: 'glucose_fasting', label: 'Glucosa en ayuno', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 70, max: 100 } },
      { key: 'glucose_1h', label: 'Glucosa 1 hora después de la ingesta', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 110, max: 135 } },
      { key: 'glucose_2h', label: 'Glucosa 2 horas después de la ingesta', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 70, max: 120 } },
      { key: 'hba1c', label: 'Hemoglobina glucosilada (HbA1c)', unit: '%', kind: 'number', step: 0.1, ref: { min: 4, max: 5.6 } },
      {
        key: 'creatinine',
        label: 'Creatinina',
        unit: 'mg/dL',
        kind: 'number',
        step: 0.01,
        refBySex: { male: { min: 0.7, max: 1.3 }, female: { min: 0.6, max: 1.1 } },
      },
      { key: 'urea', label: 'Urea', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 10, max: 40 } },
      {
        key: 'albumin',
        label: 'Albúmina',
        unit: 'g/dL',
        kind: 'number',
        step: 0.1,
        ref: { min: 3.5, max: 5 },
        hint: 'Insumo del Índice de Riesgo Nutricional (NRI/GNRI) y del Índice de Pronóstico Nutricional (PNI).',
      },
      { key: 'calcium_total', label: 'Calcio total', unit: 'mg/dL', kind: 'number', step: 0.1, ref: { min: 9, max: 11 } },
      { key: 'phosphorus', label: 'Fósforo', unit: 'mg/dL', kind: 'number', step: 0.1, ref: { min: 2.3, max: 4.7 } },
      {
        key: 'insulin_fasting',
        label: 'Insulina en ayunas',
        unit: 'µU/mL',
        kind: 'number',
        step: 0.1,
        ref: { min: 2, max: 15 },
        hint: 'Insumo del HOMA-IR y HOMA-β. Debe tomarse en ayunas, junto con la glucosa basal.',
      },
      {
        key: 'transferrin',
        label: 'Transferrina',
        unit: 'mg/dL',
        kind: 'number',
        step: 1,
        ref: { min: 200, max: 360 },
        hint: 'Insumo del Índice de Pronóstico Nutricional (PNI). Si tu laboratorio reporta CTFH/TIBC, regístralo abajo.',
      },
      {
        key: 'tibc',
        label: 'CTFH / TIBC',
        unit: 'µg/dL',
        kind: 'number',
        step: 1,
        ref: { min: 250, max: 450 },
        hint: 'Capacidad total de fijación de hierro. Solo si el laboratorio no reporta transferrina directa.',
      },
    ],
  },
  {
    key: 'lipidos',
    label: 'Lípidos',
    analytes: [
      { key: 'cholesterol_total', label: 'Colesterol total', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 120, max: 199 } },
      {
        key: 'hdl',
        label: 'Colesterol HDL',
        unit: 'mg/dL',
        kind: 'number',
        step: 1,
        refBySex: { male: { min: 40, max: 60 }, female: { min: 50, max: 70 } },
      },
      { key: 'ldl', label: 'Colesterol LDL', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 65, max: 150 } },
      { key: 'vldl', label: 'Colesterol VLDL', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 5, max: 40 } },
      { key: 'triglycerides', label: 'Triglicéridos', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 40, max: 160 } },
      { key: 'lipids_total', label: 'Lípidos totales', unit: 'mg/dL', kind: 'number', step: 1, ref: { min: 450, max: 1000 } },
    ],
  },
  {
    key: 'biometria',
    label: 'Biometría hemática',
    analytes: [
      {
        key: 'erythrocytes',
        label: 'Eritrocitos',
        unit: 'M/µL',
        kind: 'number',
        step: 0.1,
        refBySex: { male: { min: 4.5, max: 5.9 }, female: { min: 4.1, max: 5.1 } },
      },
      {
        key: 'hemoglobin',
        label: 'Concentración de hemoglobina',
        unit: 'g/dL',
        kind: 'number',
        step: 0.1,
        refBySex: { male: { min: 13.5, max: 17.5 }, female: { min: 12, max: 15.5 } },
      },
      {
        key: 'hematocrit',
        label: 'Hematocrito',
        unit: '%',
        kind: 'number',
        step: 0.1,
        refBySex: { male: { min: 41, max: 53 }, female: { min: 36, max: 46 } },
      },
      { key: 'mcv', label: 'Volumen corpuscular medio', unit: 'fL', kind: 'number', step: 0.1, ref: { min: 87, max: 94 } },
      { key: 'mch', label: 'Hemoglobina corpuscular media', unit: 'pg', kind: 'number', step: 0.1, ref: { min: 26, max: 32 } },
      { key: 'mchc', label: 'Concentración de hemoglobina corpuscular media', unit: 'g/dL', kind: 'number', step: 0.1, ref: { min: 32, max: 36 } },
      {
        key: 'leukocytes',
        label: 'Leucocitos',
        unit: 'K/µL',
        kind: 'number',
        step: 0.1,
        ref: { min: 4.8, max: 11.8 },
        hint: 'Junto con el % de linfocitos permite calcular los linfocitos totales.',
      },
      { key: 'lymphocytes', label: 'Linfocitos', unit: '%L', kind: 'number', step: 0.1, ref: { min: 25, max: 45 } },
      { key: 'monocytes', label: 'Monocitos', unit: '%M', kind: 'number', step: 0.1, ref: { min: 4, max: 8 } },
      { key: 'eosinophils', label: 'Eosinófilos', unit: '%E', kind: 'number', step: 0.1, ref: { min: 0.5, max: 4 } },
      { key: 'basophils', label: 'Basófilos', unit: '%B', kind: 'number', step: 0.1, ref: { min: 0, max: 1.5 } },
      { key: 'neutrophils_seg', label: 'Neutrófilos segmentados', unit: '%N.S.', kind: 'number', step: 0.1, ref: { min: 60, max: 65 } },
      { key: 'neutrophils_band', label: 'Neutrófilos en banda', unit: '%N.B.', kind: 'number', step: 0.1, ref: { min: 0, max: 5 } },
      { key: 'platelets', label: 'Plaquetas', unit: 'K/µL', kind: 'number', step: 1, ref: { min: 150, max: 450 } },
    ],
  },
  {
    key: 'orina',
    label: 'Orina',
    analytes: [
      { key: 'ph_urine', label: 'pH', kind: 'number', step: 0.1, ref: { min: 5, max: 7 } },
      { key: 'protein_urine', label: 'Proteínas', kind: 'select', options: POSITIVITY, normal: 'Negativo' },
      { key: 'glucose_urine', label: 'Glucosa', kind: 'select', options: POSITIVITY, normal: 'Negativo' },
      { key: 'ketone_urine', label: 'Cetona', kind: 'select', options: POSITIVITY, normal: 'Negativo' },
      { key: 'blood_urine', label: 'Sangre', kind: 'select', options: POSITIVITY, normal: 'Negativo' },
      { key: 'bilirubin_urine', label: 'Bilirrubina', kind: 'select', options: POSITIVITY, normal: 'Negativo' },
      {
        key: 'nitrites_urine',
        label: 'Nitritos',
        kind: 'select',
        options: [
          { value: 'Negativo', label: 'Negativo' },
          { value: 'Positivo', label: 'Positivo' },
        ],
        normal: 'Negativo',
      },
    ],
  },
  {
    key: 'clinica',
    label: 'Valoración clínica',
    analytes: [
      {
        key: 'delayed_hypersensitivity',
        label: 'Hipersensibilidad retardada',
        kind: 'select',
        // Escala de Mullen usada por el PNI. Ojo: "no realizada" NO es un valor
        // de la escala — es el campo vacío. Un 0 significa que la prueba se hizo
        // y salió anérgica, lo que en la fórmula suma riesgo; asumir 0 por
        // omisión inflaría el PNI ~11.6 puntos hacia "bajo riesgo".
        options: [
          { value: '0', label: '0 · No reactiva (anergia)' },
          { value: '1', label: '1 · Induración <5 mm (reactividad débil)' },
          { value: '2', label: '2 · Induración ≥5 mm (reactividad normal)' },
        ],
        hint: 'Insumo del Índice de Pronóstico Nutricional (PNI). Si la prueba no se realizó, deja el campo vacío: el PNI no se calculará.',
      },
    ],
  },
];

export const ANALYTES = PANELS.flatMap((panel) => panel.analytes);

export const ANALYTE_BY_KEY = Object.fromEntries(ANALYTES.map((analyte) => [analyte.key, analyte]));

/**
 * Normaliza el sexo del paciente ('Masculino'/'M'/'male'…) a 'male' | 'female'.
 *
 * Misma lógica que parseSex() de lib/anthropometry/pediatric, replicada a
 * propósito: aquel módulo arrastra ~85 KB de tablas LMS de la OMS y la pestaña
 * de Bioquímica se carga de forma diferida, así que importarlo por un parser de
 * cuatro líneas engordaría su chunk sin motivo.
 *
 * Femenino se evalúa PRIMERO porque 'femeNINO' contiene 'nino' y matchearía el
 * patrón de "niño".
 */
export const parseSexKey = (raw) => {
  // Delega en el parser común de la app. Antes tenía su propia copia y no
  // coincidía con la de antropometría: la letra "M" suelta era VARÓN aquí y
  // MUJER allá, así que el mismo paciente podía recibir el rango de referencia
  // de hemoglobina del otro sexo. Cuando el sexo no se puede determinar,
  // `defaultRange` devuelve null y el analito se muestra SIN rango, que es lo
  // correcto: mejor sin referencia que con la del sexo equivocado.
  const sex = normalizeSexRaw(raw);
  return sex === 'F' ? 'female' : sex === 'M' ? 'male' : null;
};

/**
 * Clave con la que se guarda un override de rango. Los analitos con rango por
 * sexo se guardan por separado ("hemoglobin:female") para que ajustar el rango
 * de una paciente no pise el de los pacientes varones.
 */
export const overrideKey = (analyte, sex) => (analyte.refBySex && sex ? `${analyte.key}:${sex}` : analyte.key);

/** Rango del catálogo, ya resuelto por sexo (sin overrides). */
export const defaultRange = (analyte, sex) => {
  if (analyte.refBySex) {
    if (!sex) return null; // Sin sexo registrado no se puede elegir la columna correcta.
    return analyte.refBySex[sex];
  }
  return analyte.ref ?? null;
};

const isUsableRange = (range) => Boolean(range) && (range?.min != null || range?.max != null);

/**
 * Rango vigente para un analito, en orden de precedencia:
 *   1. override puntual de la toma (el paciente trajo otro laboratorio),
 *   2. override de la cuenta del nutricionista ("mi laboratorio"),
 *   3. rango por defecto del catálogo (por sexo si aplica).
 */
export const resolveRange = (analyte, sex, accountRanges, entryRanges) => {
  const entryOverride = entryRanges?.[overrideKey(analyte, sex)] ?? entryRanges?.[analyte.key];
  if (isUsableRange(entryOverride)) return { range: entryOverride, source: 'entry' };

  const accountOverride = accountRanges?.[overrideKey(analyte, sex)] ?? accountRanges?.[analyte.key];
  if (isUsableRange(accountOverride)) return { range: accountOverride, source: 'account' };

  const fallback = defaultRange(analyte, sex);
  if (isUsableRange(fallback)) return { range: fallback, source: 'default' };

  return { range: null, source: 'none' };
};

export const hasValue = (value) => value !== null && value !== undefined && value !== '';

/**
 * Estado de un valor frente a su rango. Devuelve null cuando no hay valor o no
 * hay rango con el que comparar (nunca inventa una interpretación).
 */
export const evaluateValue = (analyte, value, range) => {
  if (!hasValue(value)) return null;

  if (analyte.kind === 'select') {
    if (!analyte.normal) return null;
    return value === analyte.normal ? 'normal' : 'abnormal';
  }

  if (!isUsableRange(range)) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (range.min != null && numeric < range.min) return 'low';
  if (range.max != null && numeric > range.max) return 'high';
  return 'normal';
};

/** Formatea un rango para mostrarlo ("136 – 145", "≤ 150", "—"). */
export const formatRange = (range) => {
  if (!isUsableRange(range)) return '—';
  if (range.min != null && range.max != null) return `${range.min} – ${range.max}`;
  if (range.min != null) return `≥ ${range.min}`;
  return `≤ ${range.max}`;
};
