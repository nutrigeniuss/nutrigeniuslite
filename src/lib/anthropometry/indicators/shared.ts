// Helpers compartidos por los indicadores antropométricos.
// `isNum` se exporta para uso interno entre submódulos (no forma parte de la API
// pública del barrel `index.ts`).
import { PERCENTILES } from '../tables.generated';
import { parseLocalDate, patientAgeDecimalYears } from '@/lib/patients/age';
import { normalizeSexRaw } from '@/lib/patients/sex';
import type { IndicatorResult, PercentileRow, Sex } from '../types';

export const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v);

/** Redondea a `decimals` decimales (default 2). */
export const round = (v: number, decimals = 2): number => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/**
 * Edad en años a la fecha indicada (por defecto, hoy).
 *
 * `refDate` DEBE ser la fecha de la consulta, no el día en que se mira la
 * pantalla. Todo lo que sale de aquí depende de la edad: el tramo del IMC
 * (adulto vs ≥60), el rango de peso saludable, el peso ideal, la fila de las
 * tablas de percentiles y las constantes de Durnin-Womersley. Con la edad de
 * hoy, una consulta archivada cambia de diagnóstico sola con el calendario: la
 * misma medición que se imprimió como "Sobrepeso" reaparece como "Normal" al
 * cumplir el paciente 60, y el peso ideal que se le entregó al paciente ya no
 * coincide con el que muestra la ficha.
 *
 * El cálculo es de CALENDARIO, no `ms / 365.25 días`. Esa aproximación daba una
 * edad por debajo del corte el mismo día del cumpleaños (48 de 48 fechas
 * probadas al cumplir 25, 45 o 65 años), así que el paciente pasaba un día
 * evaluado con la tabla del tramo anterior.
 */
export const calcAge = (
  birthDate?: string | null,
  refDate: Date | string | null = new Date(),
): number | null => {
  if (!birthDate) return null;
  const at = refDate instanceof Date ? refDate : refDate ? parseLocalDate(refDate) : new Date();
  if (!at || Number.isNaN(at.getTime())) return null;
  return patientAgeDecimalYears(birthDate, at);
};

/**
 * Normaliza el sexo del paciente a 'M' | 'F'. La implementación vive en
 * `@/lib/patients/sex` porque el laboratorio y el asistente de IA corren en JS
 * puro y no pueden importar TypeScript; aquí solo se le pone el tipo `Sex`.
 * "M" es masculino y "F" femenino en todos los módulos; ver ese archivo.
 */
export const normalizeSex = (raw?: string | null): Sex | null =>
  normalizeSexRaw(raw) as Sex | null;

/**
 * Busca la fila de una tabla de percentiles que cubra una edad dada.
 * Estrategia (decisión del usuario, opción b): match exacto al rango del Excel.
 * Si la edad queda fuera del rango total → devuelve la fila más cercana (extremo).
 */
export const findPercentileRow = (
  table: readonly PercentileRow[],
  ageYears: number
): PercentileRow | null => {
  if (!table.length) return null;
  // Match exacto dentro de un rango.
  const match = table.find((r) => ageYears >= r.ageMin && ageYears <= r.ageMax);
  if (match) return match;
  // Fuera de rango → extremo más cercano (clamp).
  if (ageYears < table[0].ageMin) return table[0];
  return table[table.length - 1];
};

/**
 * Devuelve el percentil aproximado en el que se ubica `value` dentro de una fila.
 * Si está debajo del p5 → 0; si está sobre el p95 → 100; entre dos percentiles
 * conocidos hace interpolación lineal sobre los percentiles (no sobre la edad).
 *
 * Los extremos DEBEN salirse de la escala 5-95 de la tabla. Antes se devolvía
 * 5 y 95 (los propios extremos), y entonces "por debajo del p5" era
 * indistinguible de "justo en el p5": las interpretaciones que vigilan los
 * extremos (`pct < 5`, `pct > 95`) no se alcanzaban nunca y un brazo de 40 cm
 * o de 20 cm salía igual de "Normal". Estar EN el corte sigue valiendo 5 o 95;
 * pasarse vale 0 o 100.
 */
export const valueToPercentile = (row: PercentileRow, value: number): number => {
  const p = row.p;
  const last = p.length - 1;
  if (value < p[0]) return 0;
  if (value > p[last]) return 100;
  for (let i = 0; i < last; i++) {
    if (value >= p[i] && value <= p[i + 1]) {
      const range = p[i + 1] - p[i] || 1;
      const frac = (value - p[i]) / range;
      return PERCENTILES[i] + frac * (PERCENTILES[i + 1] - PERCENTILES[i]);
    }
  }
  return PERCENTILES[last];
};

export type { IndicatorResult };
