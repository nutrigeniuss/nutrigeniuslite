// Motor de seguimiento de peso en gestantes.
//
// Reproduce el cálculo que el nutricionista hacía en su Excel:
//
//   IMC pregestacional = peso pregestacional / talla²        → categoría
//   ganancia real      = peso actual − peso pregestacional
//   [mín, máx]         = tabla[categoría][semana][único|múltiple]
//   peso recomendado   = pregestacional + mín … pregestacional + máx
//   diagnóstico        = comparar la ganancia real con ese rango
//
// La tabla viene de GESTANTE/tabla-GESTANTE.xlsx, convertida por
// scripts/build-gestational-gain.mjs.
//
// Fuente: IOM (Institute of Medicine) and NRC (National Research Council). 2009.
// Weight Gain During Pregnancy: Reexamining the Guidelines. Washington, DC: The
// National Academies Press.
//
// Módulo puro y sin dependencias: no toca DOM, React ni red.

import table from './gestationalGain.generated.json';
import { toLocalDateStr } from '@/lib/weekRange';

/** Cita completa de la referencia, para mostrarla en pantalla y en el PDF. */
export const GAIN_TABLE_SOURCE: string = table.source;
/** Versión corta para pies de tabla y chips. */
export const GAIN_TABLE_SOURCE_SHORT: string = table.sourceShort;

export type PrePregnancyCategory = 'underweight' | 'normal' | 'overweight' | 'obesity';
export type PregnancyType = 'single' | 'twin';
export type GainRange = { min: number; max: number };

export type GestationalAge = {
  /** Semanas cumplidas. Es la que se usa para buscar en la tabla. */
  weeks: number;
  /** Días sueltos sobre las semanas cumplidas (0-6). */
  days: number;
  totalDays: number;
  /** De dónde salió: fecha de última menstruación o ecografía. */
  source: 'fum' | 'ultrasound';
};

/** Edad gestacional confirmada por ecografía en una fecha concreta. */
export type UltrasoundReference = {
  weeks: number;
  days?: number | null;
  /** Fecha en que se hizo la ecografía. */
  onDate: string;
};

export type PregnancyRecord = {
  id: string;
  /** Fecha de última menstruación. Vía preferente. */
  fum?: string | null;
  /** Alternativa cuando no hay FUM confiable. */
  ultrasound?: UltrasoundReference | null;
  prePregnancyKg?: number | null;
  type?: PregnancyType;
  status?: 'active' | 'ended';
  endedOn?: string | null;
  notes?: string | null;
};

/** Gestación vigente de la paciente, o null si no está declarada como gestante. */
export const activePregnancy = (pregnancies?: PregnancyRecord[] | null): PregnancyRecord | null => {
  if (!Array.isArray(pregnancies) || pregnancies.length === 0) return null;
  // Si hubiera más de una activa (no debería), gana la última registrada.
  const actives = pregnancies.filter((pregnancy) => pregnancy?.status === 'active');
  return actives.length > 0 ? actives[actives.length - 1] : null;
};

/** ¿Se le aplica el procedimiento de gestante a esta paciente? */
export const isPregnant = (pregnancies?: PregnancyRecord[] | null): boolean => activePregnancy(pregnancies) !== null;

export type GestationAssessment = {
  bmi: number | null;
  category: PrePregnancyCategory | null;
  categoryLabel: string | null;
  week: number | null;
  gainKg: number | null;
  range: GainRange | null;
  /** Peso absoluto esperado a esa semana (pregestacional + rango). */
  recommendedWeight: GainRange | null;
  diagnosis: string | null;
  severity: 'good' | 'warn' | 'bad' | 'info';
  /** Datos que faltan para poder evaluar. */
  missing: string[];
  /** Avisos: fuera del rango de semanas de la tabla, gemelar sin tabla, etc. */
  notes: string[];
};

// Puntos de corte estándar del IMC pregestacional, los mismos que usa el IOM
// para elegir el rango de ganancia.
export const CATEGORY_CUTOFFS: Array<{ key: PrePregnancyCategory; label: string; maxExclusive: number | null }> = [
  { key: 'underweight', label: 'Delgada', maxExclusive: 18.5 },
  { key: 'normal', label: 'Normal', maxExclusive: 25 },
  { key: 'overweight', label: 'Sobrepeso', maxExclusive: 30 },
  { key: 'obesity', label: 'Obesidad', maxExclusive: null },
];

// Etiquetas del diagnóstico, tomadas del Excel del nutricionista para que lea
// lo mismo que ya conoce.
export const GAIN_DIAGNOSIS = {
  low: 'Baja ganancia de peso',
  adequate: 'Ganancia adecuada',
  high: 'Alta ganancia de peso',
} as const;

const [MIN_WEEK, MAX_WEEK] = table.weekRange as [number, number];

/** Semanas de gestación hasta las que la tabla sigue siendo aplicable. */
export const TABLE_MAX_WEEK = MAX_WEEK;

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const isNum = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const parseDate = (value?: string | null): number | null => {
  if (!value) return null;
  const time = new Date(`${String(value).slice(0, 10)}T12:00:00`).getTime();
  return Number.isNaN(time) ? null : time;
};

const DAY_MS = 86_400_000;

export const calcPrePregnancyBmi = (weightKg?: number | null, heightCm?: number | null): number | null => {
  if (!isNum(weightKg) || !isNum(heightCm) || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return round(weightKg / (meters * meters), 2);
};

export const prePregnancyCategory = (bmi?: number | null): PrePregnancyCategory | null => {
  if (!isNum(bmi) || bmi <= 0) return null;
  const found = CATEGORY_CUTOFFS.find((entry) => entry.maxExclusive === null || bmi < entry.maxExclusive);
  return found ? found.key : null;
};

export const categoryLabel = (category?: PrePregnancyCategory | null): string | null =>
  CATEGORY_CUTOFFS.find((entry) => entry.key === category)?.label ?? null;

/**
 * Edad gestacional a una fecha dada.
 *
 * MANDA LA ECOGRAFÍA. Si hay estudio, se usa ese; la FUM solo entra cuando no
 * lo hay. Antes era al revés, y con una FUM registrada la ecografía se
 * ignoraba por completo aunque la contradijera.
 *
 * La razón es clínica: la FUM depende de que la paciente recuerde bien la
 * fecha y de que haya ovulado el día 14 del ciclo. Ninguna de las dos cosas se
 * cumple siempre —ciclos irregulares, sangrado de implantación confundido con
 * una regla, anticoncepción reciente— y un error ahí desplaza la semana
 * gestacional y con ella todo el rango de ganancia de peso esperada.
 *
 * Se aplica también a las gestantes ya registradas: es la misma regla para
 * todas, por decisión de Edhel. A alguna puede cambiarle la semana en el
 * próximo control si tenía las dos fechas cargadas y no coincidían.
 *
 * Se calcula SIEMPRE contra la fecha del control, no contra hoy: una consulta
 * de hace un mes debe mostrar la semana que la paciente tenía entonces.
 */
export const gestationalAgeAt = (
  pregnancy: Pick<PregnancyRecord, 'fum' | 'ultrasound'> | null | undefined,
  onDate?: string | null,
): GestationalAge | null => {
  const at = parseDate(onDate) ?? Date.now();

  // La ecografía da la edad que tenía el feto EL DÍA DEL ESTUDIO; hay que
  // sumarle los días transcurridos hasta la fecha del control.
  const ultrasound = pregnancy?.ultrasound;
  const referenceDate = parseDate(ultrasound?.onDate);
  if (ultrasound && referenceDate !== null && isNum(ultrasound.weeks)) {
    const baseDays = ultrasound.weeks * 7 + (isNum(ultrasound.days) ? ultrasound.days : 0);
    const totalDays = baseDays + Math.floor((at - referenceDate) / DAY_MS);
    if (totalDays < 0) return null;
    return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays, source: 'ultrasound' };
  }

  const fum = parseDate(pregnancy?.fum);
  if (fum !== null) {
    const totalDays = Math.floor((at - fum) / DAY_MS);
    if (totalDays < 0) return null;
    return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays, source: 'fum' };
  }

  return null;
};

export const formatGestationalAge = (age?: GestationalAge | null): string => {
  if (!age) return '—';
  return age.days > 0 ? `${age.weeks} s ${age.days} d` : `${age.weeks} s`;
};

/**
 * Fecha probable de parto: el día en que cumplirá 40 semanas.
 *
 * Sigue la MISMA prioridad que la edad gestacional (ecografía primero). Si no
 * la siguiera, la pantalla mostraría una semana calculada con la eco y una
 * fecha de parto calculada con la FUM, dos datos que se contradicen entre sí y
 * que el nutricionista no tiene forma de conciliar.
 */
export const estimatedDueDate = (pregnancy: Pick<PregnancyRecord, 'fum' | 'ultrasound'> | null | undefined): string | null => {
  const reference = parseDate(pregnancy?.ultrasound?.onDate);
  if (reference !== null) {
    const age = gestationalAgeAt(pregnancy, pregnancy?.ultrasound?.onDate);
    if (age) return toLocalDateStr(new Date(reference + (280 - age.totalDays) * DAY_MS));
  }

  // Sin ecografía, Naegele: FUM + 280 días.
  const fum = parseDate(pregnancy?.fum);
  if (fum !== null) return toLocalDateStr(new Date(fum + 280 * DAY_MS));

  return null;
};

/**
 * Rango de ganancia esperada. Devuelve null cuando la tabla no cubre el caso:
 * la categoría Delgada no tiene valores de embarazo múltiple, y el resto solo
 * los tiene desde la semana 14. El IOM no publica esos rangos, así que no se
 * estiman.
 */
export const gainRange = (
  category?: PrePregnancyCategory | null,
  week?: number | null,
  type: PregnancyType = 'single',
): GainRange | null => {
  if (!category || !isNum(week)) return null;

  const categoryData = (table.categories as Record<string, { weeks: Record<string, { single: number[]; twin?: number[] }> }>)[category];
  if (!categoryData) return null;

  const clamped = Math.min(Math.max(Math.trunc(week), MIN_WEEK), MAX_WEEK);
  const entry = categoryData.weeks[String(clamped)];
  if (!entry) return null;

  const pair = type === 'twin' ? entry.twin : entry.single;
  if (!pair || pair.length !== 2) return null;

  return { min: pair[0], max: pair[1] };
};

export type AssessGestationInput = {
  prePregnancyKg?: number | null;
  currentWeightKg?: number | null;
  heightCm?: number | null;
  week?: number | null;
  type?: PregnancyType;
};

/**
 * Evaluación completa de una gestante en un control.
 *
 * Cuando falta un insumo no se estima nada: se devuelve en `missing` para que la
 * interfaz pida el dato, igual que en el resto de los módulos clínicos.
 */
export const assessGestation = ({
  prePregnancyKg,
  currentWeightKg,
  heightCm,
  week,
  type = 'single',
}: AssessGestationInput): GestationAssessment => {
  const missing: string[] = [];
  const notes: string[] = [];

  if (!isNum(prePregnancyKg)) missing.push('Peso pregestacional');
  if (!isNum(currentWeightKg)) missing.push('Peso actual');
  if (!isNum(heightCm)) missing.push('Talla');
  if (!isNum(week)) missing.push('Semana de gestación');

  const bmi = calcPrePregnancyBmi(prePregnancyKg, heightCm);
  const category = prePregnancyCategory(bmi);
  const gainKg = isNum(prePregnancyKg) && isNum(currentWeightKg) ? round(currentWeightKg - prePregnancyKg, 1) : null;

  // Fuera del rango de la tabla se avisa, pero se sigue usando el extremo más
  // cercano: una gestante de 41 semanas se evalúa con el criterio de la 40.
  if (isNum(week)) {
    if (week < MIN_WEEK) notes.push(`La tabla empieza en la semana ${MIN_WEEK}.`);
    else if (week > MAX_WEEK) notes.push(`La tabla llega hasta la semana ${MAX_WEEK}; se usa ese criterio.`);
  }

  const range = gainRange(category, week, type);

  if (!range && category && isNum(week) && type === 'twin') {
    notes.push('No hay tabla de ganancia de peso para embarazo múltiple en esta condición.');
  }

  const recommendedWeight = range && isNum(prePregnancyKg)
    ? { min: round(prePregnancyKg + range.min, 1), max: round(prePregnancyKg + range.max, 1) }
    : null;

  let diagnosis: string | null = null;
  let severity: GestationAssessment['severity'] = 'info';

  if (range && gainKg !== null) {
    if (gainKg < range.min) {
      diagnosis = GAIN_DIAGNOSIS.low;
      severity = 'warn';
    } else if (gainKg > range.max) {
      diagnosis = GAIN_DIAGNOSIS.high;
      severity = 'bad';
    } else {
      diagnosis = GAIN_DIAGNOSIS.adequate;
      severity = 'good';
    }
  }

  return {
    bmi,
    category,
    categoryLabel: categoryLabel(category),
    week: isNum(week) ? Math.trunc(week) : null,
    gainKg,
    range,
    recommendedWeight,
    diagnosis,
    severity,
    missing,
    notes,
  };
};
