/**
 * Formato único de números calculados en pantalla / impresión.
 * Regla de producto: exactamente 2 decimales en todo resultado clínico.
 */
export const CALC_DECIMALS = 2;

/** Redondeo numérico a 2 decimales. */
export function roundCalc(value: number, decimals: number = CALC_DECIMALS): number {
  const d = Math.min(Math.max(0, decimals), CALC_DECIMALS);
  const f = 10 ** d;
  return Math.round(value * f) / f;
}

/** Texto para UI/impresión: siempre 2 decimales (p. ej. 26.67). */
export function formatCalc(
  value: number | null | undefined,
  decimals: number = CALC_DECIMALS,
): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const d = Math.min(Math.max(0, decimals), CALC_DECIMALS);
  return roundCalc(value, d).toFixed(d);
}
