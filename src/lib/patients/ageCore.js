// =============================================================================
// Aritmética de la edad — el núcleo, en JavaScript a propósito.
// -----------------------------------------------------------------------------
// Lo consumen dos mundos que no comparten compilador: el cliente (TypeScript,
// vía ./age.ts, que le pone los tipos y las etiquetas) y el servidor (lib/ai,
// que corre como función de Vercel en JS puro y no puede importar TypeScript).
// Misma razón que ./sex.js y lib/lab/labAnalytes.js.
//
// Aquí vive el CÁLCULO y nada más. Las etiquetas ("3 meses", "Recién nacido") y
// la API pública tipada están en ./age.ts.
//
// Los dos fallos que motivaron centralizarlo:
//   1. `ms / (365.25 días)` daba una edad por debajo del corte el mismo día del
//      cumpleaños (48 de 48 fechas probadas al cumplir 25, 45 o 65 años), y esos
//      cortes eligen la fila de las tablas de percentiles y el tramo del IMC.
//   2. `new Date('2025-10-14')` se lee como medianoche UTC, que en Perú (UTC-5)
//      es el día 13 a las 19:00: en el cumpleaños la edad salía un año corta.
// =============================================================================

/** Parsea 'YYYY-MM-DD' en hora LOCAL (evita el corrimiento de un día en UTC-negativo). */
export const parseLocalDate = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  const parsed = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Suma meses a una fecha CLAMPANDO el día al último del mes destino.
 * Sin esto, `31 de enero + 1 mes` se desborda a marzo y la resta de días sale
 * negativa (nacido el 31/01 visto un 01/03 daba "-2 días").
 */
const addMonths = (date, months) => {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDayOfTarget));
  return target;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Edad en años, meses y días completos. `null` si no hay fecha, si no se puede
 * leer o si está en el futuro (un tipeo tipo 2027 no debe dar edades negativas).
 * @returns {{ years: number, months: number, days: number } | null}
 */
export const ageBreakdown = (birthDate, atDate = new Date()) => {
  if (!birthDate) return null;
  const born = parseLocalDate(birthDate);
  const at = parseLocalDate(atDate) ?? new Date();
  if (!born || at.getTime() < born.getTime()) return null;

  // Meses completos primero; los días son el resto desde el "mesversario".
  let totalMonths = (at.getFullYear() - born.getFullYear()) * 12 + (at.getMonth() - born.getMonth());
  if (addMonths(born, totalMonths).getTime() > at.getTime()) totalMonths -= 1;

  const anchor = addMonths(born, totalMonths);
  // Redondeo, no truncado: con cambio de horario (México, Chile) un día dura
  // 23 o 25 horas y truncar perdería un día entero.
  const days = Math.max(0, Math.round((at.getTime() - anchor.getTime()) / MS_PER_DAY));

  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, days };
};

/** Años cumplidos. OJO: `0` es válido (lactante); comparar siempre con `=== null`. */
export const ageYears = (birthDate, atDate = new Date()) =>
  ageBreakdown(birthDate, atDate)?.years ?? null;
