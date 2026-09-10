// Constantes y cálculos puros del requerimiento energético / macronutrientes.
import type {
  ActivityLevel,
  MacroKey,
  MacroState,
  MeasurementRecord,
  PatientRequirementRecord,
} from './types';
import { getCurrentLocale } from '@/lib/formatLocale';
import { patientAgeMonths } from '@/lib/patients/age';
import { normalizeSex } from '@/lib/anthropometry';
import { MACRO_HEX, MACRO_STYLES } from '@/lib/macroColors';

export const ACTIVITY_LEVELS: ActivityLevel[] = [
  { label: 'Sedentario', desc: 'Sin ejercicio', factor: 1.2 },
  { label: 'Leve', desc: '1-3 días/semana', factor: 1.375 },
  { label: 'Moderado', desc: '3-5 días/semana', factor: 1.55 },
  { label: 'Activo', desc: '6-7 días/semana', factor: 1.725 },
  { label: 'Muy activo', desc: 'Trabajo físico intenso', factor: 1.9 },
];

/**
 * Las cuatro ecuaciones de gasto basal.
 *
 * ESTE TEXTO SE GUARDA EN LA BASE DE DATOS (`selected_formula`, una fila por
 * paciente) y `calcTMB` lo compara para decidir qué ecuación aplicar. Es decir:
 * NO es solo el rótulo del desplegable, es la llave del cálculo.
 *
 * Si se renombra una, `calcTMB` deja de reconocerla y devuelve null — y el
 * requerimiento energético sale VACÍO. Y no solo para los pacientes nuevos:
 * todos los que ya tienen guardado el nombre viejo dejarían de calcular.
 *
 * Por eso viven aquí como constantes con nombre: el desplegable, el cálculo y
 * las pruebas leen las MISMAS, y no se pueden desincronizar. Si algún día hay
 * que cambiar un texto, hace falta además una migración de la columna, no basta
 * con editar la cadena.
 */
export const FORMULA = {
  harrisBenedict: 'Harris-Benedict',
  mifflin: 'Mifflin-St Jeor',
  faoOmsOps: 'FAO/OMS/OPS',
  schofield: 'Schofield',
} as const;

export type FormulaName = typeof FORMULA[keyof typeof FORMULA];

export const FORMULAS: FormulaName[] = [
  FORMULA.harrisBenedict,
  FORMULA.mifflin,
  FORMULA.faoOmsOps,
  FORMULA.schofield,
];
export const MACRO_DEFAULTS: Record<MacroKey, number> = { carbs: 50, protein: 20, fat: 30 };
export const MACRO_KCAL: Record<MacroKey, number> = { carbs: 4, protein: 4, fat: 9 };
// Colores: carbohidratos = amarillo, proteínas = rojo, grasas = celeste.
// Este criterio nació aquí y ahora vive en `@/lib/macroColors`, compartido con
// las tablas de los buscadores, el panel de macros y la dona. Los valores son
// los mismos de antes (`bg-amber-400` ES #fbbf24, `text-amber-600` ES #d97706,
// etc.): solo cambia de dónde salen.
export const MACRO_LABELS: Record<MacroKey, { label: string; color: string; hex: string; text: string }> = {
  carbs: { label: 'Carbohidratos', color: MACRO_STYLES.carbs.dot, hex: MACRO_HEX.carbs.fill, text: MACRO_STYLES.carbs.value },
  protein: { label: 'Proteínas', color: MACRO_STYLES.protein.dot, hex: MACRO_HEX.protein.fill, text: MACRO_STYLES.protein.value },
  fat: { label: 'Grasas', color: MACRO_STYLES.fat.dot, hex: MACRO_HEX.fat.fill, text: MACRO_STYLES.fat.value },
};

// ── El reparto de macronutrientes tiene que sumar 100 ────────────────────────
//
// POR QUÉ ESTO ES UNA REGLA Y NO UN AVISO. Los gramos que se recetan salen de
// `(kcal objetivo × %) ÷ 100`. Si los tres porcentajes suman 174, los gramos
// suman un 74 % más de comida de la que el objetivo pedía, y el plan se
// construye encima. En la revisión del 14-08-2026 había 5 de 27 pacientes con
// el reparto mal guardado —uno en 174 %— porque la pantalla solo avisaba.
//
// El mismo dato viaja al copiloto de IA como `nutritionTargets`, así que un
// reparto imposible también le hace juzgar las propuestas contra un objetivo
// que no existe.

/** Suma de los tres porcentajes, redondeada como la ve el usuario. */
export const macroTotalPct = (macros: MacroState): number =>
  Math.round((Number(macros.carbs?.pct) || 0) + (Number(macros.protein?.pct) || 0) + (Number(macros.fat?.pct) || 0));

/** ¿Se puede guardar este reparto? */
export const isMacroSplitValid = (macros: MacroState): boolean => macroTotalPct(macros) === 100;

/**
 * Reparte la diferencia manteniendo las proporciones que el profesional eligió.
 *
 * Escala los tres y da el sobrante del redondeo al mayor, para que el resultado
 * sume 100 EXACTO y no 99.9: si no, el guardado seguiría bloqueado después de
 * pulsar el botón que promete arreglarlo, que es la peor forma de romper la
 * confianza en un botón.
 *
 * Con los tres a cero no hay proporción que conservar, así que se vuelve al
 * reparto por defecto en lugar de dividir entre cero.
 */
export const normalizeMacroSplit = (macros: MacroState): MacroState => {
  const keys: MacroKey[] = ['carbs', 'protein', 'fat'];
  const raw = keys.map((key) => Number(macros[key]?.pct) || 0);
  const total = raw.reduce((sum, value) => sum + value, 0);

  const scaled = total > 0
    ? raw.map((value) => Math.round((value / total) * 100))
    : keys.map((key) => MACRO_DEFAULTS[key]);

  // El redondeo puede dejar 99 o 101. La diferencia se le suma al macro con más
  // peso, que es donde menos se nota.
  const diff = 100 - scaled.reduce((sum, value) => sum + value, 0);
  if (diff !== 0) {
    const mayor = scaled.indexOf(Math.max(...scaled));
    scaled[mayor] = Math.max(0, scaled[mayor] + diff);
  }

  const next = { ...macros };
  keys.forEach((key, index) => {
    next[key] = { ...macros[key], pct: scaled[index], gkg: null };
  });
  return next;
};

// `atDate` existe para poder fijar el "hoy" en los tests; en la app siempre es
// la fecha real.
export const calcTMB = (
  formula: string,
  patient: PatientRequirementRecord,
  measurement: MeasurementRecord | null,
  atDate: Date = new Date(),
): number | null => {
  const weight = measurement?.weight;
  const height = measurement?.height;
  if (!weight || !height) return null;

  // Edad de calendario exacta, no `diferencia / 365.25 días`. Esa aproximación
  // corría el cumpleaños un día, y justo en los cortes de 30 y 60 años eso
  // cambia de TRAMO de fórmula: un hombre de 70 kg pasaba de 1746 a 1676 kcal
  // por un día de desfase. Además leía la fecha en UTC, lo que en Perú (UTC-5)
  // la adelantaba unas horas más.
  //
  // Se trabaja en MESES cumplidos (entero) y no en años: es lo que hace que los
  // tramos caigan en el día exacto sin depender de un redondeo. Antes se
  // comparaba `age < 0.5` con la edad en años enteros, condición que cumplía
  // CUALQUIER menor de un año: la fórmula de 6-12 meses era inalcanzable.
  const ageMonths = patientAgeMonths(patient.birth_date, atDate);
  if (ageMonths === null) return null;

  // Edad decimal en años (10 meses = 0.833). Solo la usan las fórmulas donde la
  // edad MULTIPLICA; en las demás la edad únicamente elige el tramo, y ahí un
  // decimal no cambiaría nada.
  const age = ageMonths / 12;
  const YEAR = 12; // meses, para escribir los tramos en años y leerlos igual

  // El sexo sale del parser común, no de comparar con la cadena exacta
  // 'Masculino': con `=== 'Masculino'` cualquier otra forma del mismo dato
  // ("masculino" en minúscula, "Hombre", un "M" importado) caía en la rama de
  // MUJER sin avisar, y ahí se van 166 kcal de diferencia en la TMB.
  //
  // Y sin sexo NO se calcula. Las cuatro fórmulas tienen una ecuación por sexo:
  // el `=== 'Masculino'` anterior daba `false` cuando el dato faltaba, así que
  // una ficha sin sexo recibía el requerimiento de una mujer y nada lo decía.
  // Devolver null hace que la pantalla no muestre número, que es lo mismo que
  // ya hacen el peso ideal y el resto de indicadores cuando falta el sexo.
  const sex = normalizeSex(patient.gender || patient.sex);
  if (!sex) return null;
  const male = sex === 'M';

  if (formula === FORMULA.harrisBenedict) {
    return male ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age : 447.593 + 9.247 * weight + 3.098 * height - 4.33 * age;
  }

  if (formula === FORMULA.mifflin) {
    // Coeficientes ORIGINALES de Mifflin et al. (1990): 9.99 y 4.92. No son un
    // error de tipeo por 10 y 5 — esa es la versión redondeada, que la app usó
    // hasta el 31-08-2026 y que se cambió a propósito por la exacta. La
    // diferencia es de 2 a 4 kcal por paciente.
    return male ? 9.99 * weight + 6.25 * height - 4.92 * age + 5 : 9.99 * weight + 6.25 * height - 4.92 * age - 161;
  }

  if (formula === FORMULA.faoOmsOps) {
    // FAO/OMS/OPS — solo peso (W = kg), según planilla de referencia.
    // Lactantes sin distinción de sexo:
    if (ageMonths < 6) return -152 + 92.8 * weight;
    if (ageMonths < 12) return -99.4 + 88.6 * weight;
    // 1-18 años: la referencia usa la MISMA ecuación para 1-5, 5-12 y 12-18.
    if (ageMonths < 18 * YEAR) {
      return male
        ? 310.2 + 63.3 * weight - 0.263 * weight * weight
        : 263.4 + 65.3 * weight - 0.454 * weight * weight;
    }
    if (male) {
      if (ageMonths < 30 * YEAR) return 15.057 * weight + 692.2;
      if (ageMonths < 60 * YEAR) return 11.472 * weight + 873.1;
      return 11.711 * weight + 587.7;
    }
    if (ageMonths < 30 * YEAR) return 14.818 * weight + 486.6;
    if (ageMonths < 60 * YEAR) return 8.126 * weight + 845.6;
    return 9.082 * weight + 658.5;
  }

  if (formula === FORMULA.schofield) {
    // Schofield WN. Hum Nutr Clin Nutr 1985; 39C Suppl 1:5-41 — versión peso+talla.
    // W = peso en kg; H = talla en cm.
    if (male) {
      if (ageMonths < 3 * YEAR) return 0.167 * weight + 15.174 * height - 617.6;
      if (ageMonths < 10 * YEAR) return 19.59 * weight + 1.303 * height + 414.9;
      if (ageMonths < 18 * YEAR) return 16.25 * weight + 1.372 * height + 515.5;
      if (ageMonths < 30 * YEAR) return 15.057 * weight - 0.1 * height + 705.8;
      if (ageMonths < 60 * YEAR) return 11.47 * weight - 0.026 * height + 877.2;
      return 9.08 * weight + 9.723 * height - 834.4;
    }
    if (ageMonths < 3 * YEAR) return 16.252 * weight + 10.232 * height - 413.5;
    if (ageMonths < 10 * YEAR) return 16.969 * weight + 1.618 * height + 371.2;
    if (ageMonths < 18 * YEAR) return 8.365 * weight + 4.65 * height + 200.0;
    if (ageMonths < 30 * YEAR) return 13.623 * weight + 2.83 * height + 98.2;
    if (ageMonths < 60 * YEAR) return 8.126 * weight + 0.014 * height + 843.7;
    return 7.887 * weight + 4.582 * height + 17.7;
  }

  return null;
};

export const formatDate = (value?: string | null): string => {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(getCurrentLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
};

export const asMeasurementArray = (measurements: unknown): MeasurementRecord[] => {
  return Array.isArray(measurements) ? (measurements as MeasurementRecord[]) : [];
};

export const buildMacroState = (measurement: MeasurementRecord | null, patient: PatientRequirementRecord): MacroState => {
  const req = measurement?.requirement || {};

  return {
    carbs: { pct: (req.macro_pct_carbs ?? patient.macro_pct_carbs ?? MACRO_DEFAULTS.carbs) as number, gkg: null },
    protein: { pct: (req.macro_pct_protein ?? patient.macro_pct_protein ?? MACRO_DEFAULTS.protein) as number, gkg: null },
    fat: { pct: (req.macro_pct_fat ?? patient.macro_pct_fat ?? MACRO_DEFAULTS.fat) as number, gkg: null },
  };
};

/**
 * Antepone el signo SOLO cuando el número es positivo.
 *
 * El desglose del VCT escribía `+${valor}` a secas. Con un NAF por debajo de 1
 * —que ocurre de verdad: el calculador MET avisa de «supera las 24 h» y deja
 * un NAF de 0.70— la contribución de actividad es NEGATIVA, y en pantalla
 * salía «+-230», que no significa nada. El menos ya viene dentro del número.
 *
 * Vive aquí, y no dentro del componente, para poder probarlo.
 */
export const formatSigned = (value: number): string => (value > 0 ? `+${value}` : String(value));
