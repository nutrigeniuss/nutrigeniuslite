// Capa tipada del catálogo de laboratorio + helpers de UI.
//
// Los DATOS y la lógica pura de rangos viven en @/lib/lab/labAnalytes.js, en
// JavaScript, porque el contexto del asistente de IA (lib/ai/patientContext.js)
// corre en el servidor y no puede importar TypeScript. Así el rango con el que
// la app pinta un valor en rojo es el mismo con el que la IA lo interpreta, sin
// duplicar el catálogo. Aquí solo se les pone tipos y se agrega lo que únicamente
// necesita la interfaz (conteos, parseo de inputs).

import {
  ANALYTE_BY_KEY as RAW_ANALYTE_BY_KEY,
  ANALYTES as RAW_ANALYTES,
  PANELS as RAW_PANELS,
  defaultRange as rawDefaultRange,
  evaluateValue as rawEvaluateValue,
  formatRange as rawFormatRange,
  hasValue as rawHasValue,
  overrideKey as rawOverrideKey,
  parseSexKey as rawParseSexKey,
  resolveRange as rawResolveRange,
} from '@/lib/lab/labAnalytes.js';

export type Sex = 'male' | 'female' | null;

export type LabRange = { min?: number | null; max?: number | null };

export type LabAnalyte = {
  key: string;
  label: string;
  /** Unidad mostrada a la derecha del input. Vacía en los cualitativos. */
  unit?: string;
  kind: 'number' | 'select';
  /** Paso del input numérico; también sugiere los decimales esperados. */
  step?: number;
  /** Opciones de los cualitativos (orina, valoración clínica). */
  options?: Array<{ value: string; label: string }>;
  /** Valor considerado normal en un cualitativo; el resto se marca anormal. */
  normal?: string;
  /** Rango por defecto cuando no depende del sexo. */
  ref?: LabRange;
  /** Rango por defecto cuando sí depende del sexo (Hb, Hto, creatinina…). */
  refBySex?: { male: LabRange; female: LabRange };
  /** Texto de ayuda (ícono de interrogación). */
  hint?: string;
};

export type LabPanel = {
  key: string;
  label: string;
  analytes: LabAnalyte[];
};

/** Estado de un valor respecto de su rango de referencia. */
export type LabStatus = 'low' | 'high' | 'normal' | 'abnormal' | null;

export type LabEntry = {
  id: string;
  date?: string | null;
  lab?: string | null;
  created_at?: string | null;
  values?: Record<string, number | string | null>;
  ranges?: Record<string, LabRange>;
  notes?: string | null;
};

// Los `as` son necesarios porque el módulo de datos es JS: TypeScript infiere
// `kind: string` donde el tipo exige la unión 'number' | 'select'.
export const PANELS = RAW_PANELS as LabPanel[];
export const ANALYTES = RAW_ANALYTES as LabAnalyte[];
export const ANALYTE_BY_KEY = RAW_ANALYTE_BY_KEY as Record<string, LabAnalyte>;

export const parseSexKey: (raw?: string | null) => Sex = rawParseSexKey;
export const overrideKey: (analyte: LabAnalyte, sex: Sex) => string = rawOverrideKey;
export const defaultRange: (analyte: LabAnalyte, sex: Sex) => LabRange | null = rawDefaultRange;
export const hasValue: (value: unknown) => boolean = rawHasValue;
export const formatRange: (range: LabRange | null) => string = rawFormatRange;

export const resolveRange = rawResolveRange as (
  analyte: LabAnalyte,
  sex: Sex,
  accountRanges?: Record<string, LabRange> | null,
  entryRanges?: Record<string, LabRange> | null,
) => { range: LabRange | null; source: 'entry' | 'account' | 'default' | 'none' };

export const evaluateValue = rawEvaluateValue as (
  analyte: LabAnalyte,
  value: unknown,
  range: LabRange | null,
) => LabStatus;

// ── Helpers exclusivos de la interfaz ────────────────────────────────────────

/** Convierte lo tipeado en el input a número, o null si queda vacío/ilegible. */
export const parseLabNumber = (raw: string): number | null => {
  if (raw === '' || raw === null || raw === undefined) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Cuántos analitos de un panel tienen valor en esta toma. */
export const countPanelFilled = (panel: LabPanel, values?: Record<string, unknown> | null): number =>
  panel.analytes.filter((analyte) => hasValue(values?.[analyte.key])).length;

/** Cuántos analitos de un panel caen fuera de su rango de referencia. */
export const countPanelOutOfRange = (
  panel: LabPanel,
  values: Record<string, unknown> | null | undefined,
  sex: Sex,
  accountRanges?: Record<string, LabRange> | null,
  entryRanges?: Record<string, LabRange> | null,
): number =>
  panel.analytes.filter((analyte) => {
    const { range } = resolveRange(analyte, sex, accountRanges, entryRanges);
    const status = evaluateValue(analyte, values?.[analyte.key], range);
    return status === 'low' || status === 'high' || status === 'abnormal';
  }).length;

/** Total de analitos con valor en toda la toma (para el listado). */
export const countEntryFilled = (entry: LabEntry): number =>
  PANELS.reduce((total, panel) => total + countPanelFilled(panel, entry.values), 0);

/** Total de hallazgos fuera de rango en toda la toma (para el listado). */
export const countEntryOutOfRange = (
  entry: LabEntry,
  sex: Sex,
  accountRanges?: Record<string, LabRange> | null,
): number =>
  PANELS.reduce(
    (total, panel) => total + countPanelOutOfRange(panel, entry.values, sex, accountRanges, entry.ranges),
    0,
  );
