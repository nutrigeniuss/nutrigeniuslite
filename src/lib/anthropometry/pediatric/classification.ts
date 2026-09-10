// =============================================================================
// Clasificación clínica del z-score pediátrico según los puntos de corte de la
// OMS (adoptados por MINSA Perú). Convierte un z-score en una categoría legible
// (normal, desnutrición, sobrepeso, obesidad, talla baja, etc.) con un "tono"
// para colorear el resultado en la UI.
// -----------------------------------------------------------------------------
// Convención OMS de los bordes: el valor exacto del corte pertenece a la banda
// MENOS severa (ej. z = −3 es "moderada", no "severa"; z = −2 es "normal").
// =============================================================================

import { computeZScore, type PediatricIndicator, type PediatricSex } from './zscore';

export type PediatricTone = 'critical' | 'warning' | 'caution' | 'normal' | 'high';

export type PediatricClassification = {
  label: string;
  tone: PediatricTone;
};

// Nombre legible del indicador (para títulos en la UI/reporte).
export const INDICATOR_LABELS: Record<PediatricIndicator, string> = {
  wfa: 'Peso para la edad',
  lhfa: 'Talla para la edad',
  hfa: 'Talla para la edad',
  wfl: 'Peso para la talla',
  wfh: 'Peso para la talla',
  bmi: 'IMC para la edad',
  hcfa: 'Perímetro cefálico para la edad',
  acfa: 'Perímetro braquial para la edad',
  tsfa: 'Pliegue tricipital para la edad',
  ssfa: 'Pliegue subescapular para la edad',
};

export const classifyZScore = (
  indicator: PediatricIndicator,
  z: number,
): PediatricClassification => {
  switch (indicator) {
    case 'wfa': // Peso/edad — desnutrición global
      if (z < -3) return { label: 'Bajo peso severo', tone: 'critical' };
      if (z < -2) return { label: 'Bajo peso', tone: 'warning' };
      if (z <= 2) return { label: 'Peso adecuado', tone: 'normal' };
      return { label: 'Sobrepeso', tone: 'caution' };

    case 'lhfa':
    case 'hfa': // Talla/edad — desnutrición crónica
      if (z < -3) return { label: 'Talla baja severa (desnutrición crónica severa)', tone: 'critical' };
      if (z < -2) return { label: 'Talla baja (desnutrición crónica)', tone: 'warning' };
      if (z <= 3) return { label: 'Talla adecuada', tone: 'normal' };
      return { label: 'Talla alta', tone: 'caution' };

    case 'wfl':
    case 'wfh': // Peso/talla (<5 años) — criterio MINSA (tabla de campo):
      //   < −3 DE → Desnutrido severo   · −3 a −2 DE → Desnutrido
      //   −2 a +2 DE → Normal           · +2 a +3 DE → Sobrepeso
      //   > +3 DE → Obesidad
      if (z < -3) return { label: 'Desnutrido severo', tone: 'critical' };
      if (z < -2) return { label: 'Desnutrido', tone: 'warning' };
      if (z <= 2) return { label: 'Normal', tone: 'normal' };
      if (z <= 3) return { label: 'Sobrepeso', tone: 'high' };
      return { label: 'Obesidad', tone: 'critical' };

    case 'bmi': // IMC/edad (5-19) — delgadez y exceso de peso
      if (z < -3) return { label: 'Delgadez severa', tone: 'critical' };
      if (z < -2) return { label: 'Delgadez', tone: 'warning' };
      if (z <= 1) return { label: 'Normal', tone: 'normal' };
      if (z <= 2) return { label: 'Sobrepeso', tone: 'high' };
      return { label: 'Obesidad', tone: 'critical' };

    case 'hcfa': // Perímetro cefálico — micro/macrocefalia
      if (z < -2) return { label: 'Microcefalia', tone: 'warning' };
      if (z <= 2) return { label: 'Normal', tone: 'normal' };
      return { label: 'Macrocefalia', tone: 'warning' };

    case 'acfa': // Perímetro braquial (MUAC/edad). Interpretación oficial OMS 1997
      // (aplicable desde los 6 meses): < −2 DE = desnutrición; si no, sin desnutrición.
      if (z < -2) return { label: 'Desnutrición', tone: 'warning' };
      return { label: 'Sin desnutrición', tone: 'normal' };

    case 'tsfa': // Pliegue tricipital/edad — reserva de grasa
    case 'ssfa': // Pliegue subescapular/edad — reserva de grasa
      if (z < -2) return { label: 'Desnutrición', tone: 'warning' };
      if (z <= 2) return { label: 'Normal', tone: 'normal' };
      return { label: 'Riesgo de obesidad', tone: 'caution' };

    default: {
      // Exhaustividad: si se agrega un indicador nuevo, TS obliga a clasificarlo.
      const _exhaustive: never = indicator;
      return _exhaustive;
    }
  }
};

// Resultado unificado de un indicador pediátrico. `valueLabel` es lo que se
// muestra ("z −0.11", "P25", "Riesgo alto"); `zScore`/`percentile` van según el
// método (OMS z-score vs Frisancho/Fernández percentiles).
export type PediatricEvaluation = {
  indicator: string;
  indicatorLabel: string;
  valueLabel: string;
  zScore?: number;
  percentile?: number;
  classification: PediatricClassification;
  // Punto del niño para graficar sobre las curvas (solo indicadores OMS z-score):
  // chartX = edad en meses o talla en cm; chartValue = la medición.
  chartX?: number;
  chartValue?: number;
};

// Evalúa un indicador OMS de punta a punta: z-score + clasificación + etiquetas.
// Devuelve null si faltan datos o el valor cae fuera de las tablas.
export const evaluatePediatricIndicator = (
  indicator: PediatricIndicator,
  sex: PediatricSex,
  x: number,
  value: number,
): PediatricEvaluation | null => {
  const z = computeZScore({ indicator, sex, x, value });
  if (z === null) return null;
  return {
    indicator,
    indicatorLabel: INDICATOR_LABELS[indicator],
    valueLabel: `z ${z >= 0 ? '+' : ''}${z.toFixed(2)}`,
    zScore: z,
    classification: classifyZScore(indicator, z),
    chartX: x,
    chartValue: value,
  };
};
