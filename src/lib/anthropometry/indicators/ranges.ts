// Validaciones de rango (control de calidad de las mediciones).
import { isNum } from './shared';

/** Rangos plausibles para alertar al nutricionista de mediciones improbables. */
export const PLAUSIBLE_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  weight: { min: 2, max: 350, unit: 'kg' },
  height: { min: 40, max: 230, unit: 'cm' },
  waist: { min: 40, max: 200, unit: 'cm' },
  hip: { min: 40, max: 200, unit: 'cm' },
  arm: { min: 10, max: 60, unit: 'cm' },
  triceps: { min: 1, max: 80, unit: 'mm' },
  subscapular: { min: 1, max: 80, unit: 'mm' },
};

export const isPlausible = (key: keyof typeof PLAUSIBLE_RANGES, value: number | null | undefined): boolean => {
  if (!isNum(value)) return true; // null = no medido, no es implausible
  const r = PLAUSIBLE_RANGES[key];
  return value >= r.min && value <= r.max;
};
