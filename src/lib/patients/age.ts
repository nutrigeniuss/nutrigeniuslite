// =============================================================================
// Edad del paciente: un solo lugar donde se calcula y se escribe.
// -----------------------------------------------------------------------------
// Había tres copias de `Math.floor(diff / 365.25 días)` (lista de pacientes,
// sidebar, guardado de la ficha) y todas compartían dos fallos:
//
//   1. Un bebé daba `age = 0`, y `0` es FALSY. `if (patient.age) ...` y
//      `age ? `${age} años` : 'Edad no registrada'` trataban a un paciente de
//      10 meses como paciente SIN fecha de nacimiento: el sidebar decía "Edad
//      no registrada" sobre una fecha perfectamente guardada.
//   2. `new Date('2025-10-14')` se interpreta como medianoche UTC, que en Perú
//      (UTC-5) es el 13 a las 19:00. En el cumpleaños la edad salía un año
//      corta. Aquí se parsea en local, como en el módulo pediátrico.
//
// Además "0 años" no es una edad útil para un lactante: por debajo del año se
// muestra en meses, y por debajo del mes en días.
// =============================================================================

import { ageBreakdown, parseLocalDate as coreParseLocalDate } from './ageCore.js';

export type PatientAgeParts = { years: number; months: number; days: number };

export type PatientAgeRecord = {
  birth_date?: string | null;
  age?: number | null;
};

// La aritmética vive en ./ageCore.js: la comparten el cliente (este archivo) y
// el servidor (lib/ai/patientContext.js, que corre en JS puro y no puede
// importar TypeScript). Aquí quedan los tipos, las etiquetas y la API pública.
export const parseLocalDate = (value: string): Date | null => coreParseLocalDate(value);

/**
 * Edad en años, meses y días completos. `null` si no hay fecha, si no se puede
 * leer o si está en el futuro (un tipeo tipo 2027 no debe dar edades negativas).
 */
export const patientAgeBreakdown = (
  birthDate?: string | null,
  atDate: Date = new Date(),
): PatientAgeParts | null => ageBreakdown(birthDate, atDate) as PatientAgeParts | null;

/**
 * Años cumplidos. Es lo que se guarda en la columna `patients.age`.
 * OJO: `0` es un valor VÁLIDO (lactante). Comparar siempre con `=== null`.
 */
export const patientAgeYears = (birthDate?: string | null, atDate: Date = new Date()): number | null =>
  patientAgeBreakdown(birthDate, atDate)?.years ?? null;

/**
 * Edad en MESES cumplidos (entero). Es el valor con el que conviene comparar
 * los tramos de las fórmulas ("menor de 6 meses", "menor de 30 años"): al ser
 * entero, el corte cae siempre en el día exacto y no hay redondeos raros.
 */
export const patientAgeMonths = (birthDate?: string | null, atDate: Date = new Date()): number | null => {
  const parts = patientAgeBreakdown(birthDate, atDate);
  return parts ? parts.years * 12 + parts.months : null;
};

/**
 * Edad DECIMAL en años: 12 meses = 1, 1 año y 6 meses = 1.5, 10 meses = 0.833.
 *
 * Es la que corresponde cuando la edad MULTIPLICA dentro de una ecuación
 * (Harris-Benedict, Mifflin-St Jeor), porque esas ecuaciones salieron de una
 * regresión sobre la edad como variable continua: truncar a años enteros
 * introduce un error sistemático (siempre hacia abajo, hasta 11 meses).
 *
 * No cuenta los días a propósito: aportan 0.0156 kcal por día, cuatro órdenes
 * de magnitud por debajo del margen de error de las propias fórmulas. Donde los
 * días SÍ pesan es en los z-scores pediátricos de la OMS, y ese módulo
 * (lib/anthropometry/pediatric) ya los cuenta por su cuenta.
 */
export const patientAgeDecimalYears = (birthDate?: string | null, atDate: Date = new Date()): number | null => {
  const months = patientAgeMonths(birthDate, atDate);
  return months === null ? null : months / 12;
};

/** Etiqueta a partir de la descomposición: años, o meses, o días. */
export const formatAgeParts = ({ years, months, days }: PatientAgeParts): string => {
  if (years >= 1) return `${years} ${years === 1 ? 'año' : 'años'}`;
  if (months >= 1) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  if (days >= 1) return `${days} ${days === 1 ? 'día' : 'días'}`;
  return 'Recién nacido';
};

/**
 * Edad lista para pintar. La fecha de nacimiento manda; la columna `age` solo
 * se usa como respaldo para fichas antiguas que no la tienen.
 */
export const formatPatientAge = (
  patient: PatientAgeRecord | null | undefined,
  fallback = 'Edad no registrada',
): string => {
  const parts = patientAgeBreakdown(patient?.birth_date);
  if (parts) return formatAgeParts(parts);

  const stored = patient?.age;
  if (typeof stored === 'number' && Number.isFinite(stored) && stored >= 0) {
    return `${stored} ${stored === 1 ? 'año' : 'años'}`;
  }
  return fallback;
};
