// Curva de ganancia de peso gestacional, como SVG en texto.
//
// Se construye como string —no como JSX— para servir a los dos consumidores con
// el mismo dibujo: la pantalla (dangerouslySetInnerHTML) y el PDF imprimible
// (HTML autocontenido en un iframe, donde no corre React). Es la misma
// estrategia de growthChartSvg para las curvas de la OMS.
//
// Ejes: X = semanas de gestación (1 a 40), Y = kg ganados respecto del peso
// pregestacional. La banda sombreada es el rango recomendado de la tabla
// IOM/NRC 2009 para la categoría de IMC pregestacional de la paciente.

import { gainRange, type PrePregnancyCategory, type PregnancyType } from './gestationalGain';

export type GainPoint = {
  week: number;
  /** Kg ganados respecto del peso pregestacional (puede ser negativo). */
  gainKg: number;
  /** Fecha del control, para el tooltip/etiqueta. */
  date?: string | null;
  /** Peso medido en ese control, para el tooltip. */
  weightKg?: number | null;
  /** Diagnóstico textual, para el tooltip. */
  diagnosis?: string | null;
  /** Diagnóstico en ese control, para colorear el punto. */
  severity?: 'good' | 'warn' | 'bad' | 'info';
};

export type GainChartOptions = {
  category: PrePregnancyCategory;
  type?: PregnancyType;
  points?: GainPoint[];
  /** Semana a destacar con una línea vertical (la del control actual). */
  highlightWeek?: number | null;
  width?: number;
  height?: number;
};

const SEVERITY_COLOR: Record<string, string> = {
  good: '#15803d',
  warn: '#c2410c',
  bad: '#b91c1c',
  info: '#3b5feb',
};

const MIN_WEEK = 1;
const MAX_WEEK = 40;

export type GainChartLayout = {
  width: number;
  height: number;
  /** Punto original + su posición en el lienzo y en porcentaje del contenedor. */
  points: Array<{ point: GainPoint; cx: number; cy: number; leftPct: number; topPct: number }>;
};

/**
 * Geometría del gráfico, expuesta aparte para que la capa de hover en pantalla
 * ubique sus zonas sensibles con las MISMAS coordenadas que dibuja el SVG. Sin
 * esto habría dos cálculos de posición que podrían desalinearse.
 */
export const computeGainChartLayout = ({
  category,
  type = 'single',
  points = [],
  width = 560,
  height = 260,
}: GainChartOptions): GainChartLayout => {
  const geometry = buildGeometry({ category, type, points, width, height });
  const usable = sortPoints(points);

  return {
    width,
    height,
    points: usable.map((point) => {
      const cx = geometry.x(point.week);
      const cy = geometry.y(point.gainKg);
      return { point, cx, cy, leftPct: (cx / width) * 100, topPct: (cy / height) * 100 };
    }),
  };
};

const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 30;

const sortPoints = (points: GainPoint[]): GainPoint[] =>
  [...points]
    .filter((point) => Number.isFinite(point.week) && Number.isFinite(point.gainKg))
    .sort((left, right) => left.week - right.week);

// Escalas y banda de referencia. Compartido por el dibujo y por la capa de hover.
const buildGeometry = ({ category, type = 'single', points = [], width = 560, height = 260 }: GainChartOptions) => {
  // Serie de la banda recomendada, semana a semana. Si la categoría no tiene
  // tabla para ese tipo de embarazo (delgada + múltiple), no hay banda.
  const band: Array<{ week: number; min: number; max: number }> = [];
  for (let week = MIN_WEEK; week <= MAX_WEEK; week += 1) {
    const range = gainRange(category, week, type);
    if (range && range.min != null && range.max != null) band.push({ week, min: range.min, max: range.max });
  }

  const gains = points.map((point) => point.gainKg).filter((value) => Number.isFinite(value));
  const bandMax = band.length > 0 ? Math.max(...band.map((entry) => entry.max)) : 0;
  const bandMin = band.length > 0 ? Math.min(...band.map((entry) => entry.min)) : 0;

  let yMin = Math.min(bandMin, ...(gains.length > 0 ? gains : [0]), 0);
  let yMax = Math.max(bandMax, ...(gains.length > 0 ? gains : [0]), 1);
  const pad = (yMax - yMin) * 0.08 || 1;
  yMin -= pad;
  yMax += pad;

  return {
    band,
    yMin,
    yMax,
    x: (week: number): number =>
      PAD_L + ((Math.min(Math.max(week, MIN_WEEK), MAX_WEEK) - MIN_WEEK) / (MAX_WEEK - MIN_WEEK)) * (width - PAD_L - PAD_R),
    y: (kg: number): number => PAD_T + ((yMax - kg) / (yMax - yMin)) * (height - PAD_T - PAD_B),
  };
};

export const buildGainChartSVG = ({
  category,
  type = 'single',
  points = [],
  highlightWeek = null,
  width = 560,
  height = 260,
}: GainChartOptions): string => {
  const geometry = buildGeometry({ category, type, points, width, height });
  const { band, yMin, yMax, x, y } = geometry;

  // Banda como un único polígono cerrado: borde superior de ida, inferior de vuelta.
  const bandPath = band.length > 0
    ? `${band.map((entry, index) => `${index === 0 ? 'M' : 'L'} ${x(entry.week).toFixed(1)} ${y(entry.max).toFixed(1)}`).join(' ')} ${[...band].reverse().map((entry) => `L ${x(entry.week).toFixed(1)} ${y(entry.min).toFixed(1)}`).join(' ')} Z`
    : '';

  const gridY: string[] = [];
  const step = yMax - yMin > 12 ? 4 : 2;
  for (let kg = Math.ceil(yMin / step) * step; kg <= yMax; kg += step) {
    const py = y(kg).toFixed(1);
    gridY.push(
      `<line x1="${PAD_L}" y1="${py}" x2="${width - PAD_R}" y2="${py}" stroke="${kg === 0 ? '#cbd5e1' : '#f1f5f9'}" stroke-width="1" />`
      + `<text x="${PAD_L - 5}" y="${(Number(py) + 3).toFixed(1)}" text-anchor="end" font-size="8.5" fill="#94a3b8">${kg}</text>`,
    );
  }

  const gridX: string[] = [];
  for (let week = 4; week <= MAX_WEEK; week += 4) {
    const px = x(week).toFixed(1);
    gridX.push(
      `<line x1="${px}" y1="${PAD_T}" x2="${px}" y2="${height - PAD_B}" stroke="#f8fafc" stroke-width="1" />`
      + `<text x="${px}" y="${height - PAD_B + 13}" text-anchor="middle" font-size="8.5" fill="#94a3b8">${week}</text>`,
    );
  }

  const sorted = sortPoints(points);

  const trajectory = sorted.length >= 2
    ? `<path d="${sorted.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.week).toFixed(1)} ${y(point.gainKg).toFixed(1)}`).join(' ')}" fill="none" stroke="#3b5feb" stroke-width="1.8" />`
    : '';

  // El <title> da un tooltip nativo: cubre el PDF y cualquier consumidor que no
  // monte la capa de hover de la pantalla.
  const dots = sorted.map((point) => {
    const color = SEVERITY_COLOR[point.severity || 'info'] || SEVERITY_COLOR.info;
    const label = [
      point.date || null,
      `${point.week} s`,
      point.weightKg != null ? `${point.weightKg} kg` : null,
      `${point.gainKg > 0 ? '+' : ''}${point.gainKg} kg ganados`,
      point.diagnosis || null,
    ].filter(Boolean).join(' · ');
    return `<circle cx="${x(point.week).toFixed(1)}" cy="${y(point.gainKg).toFixed(1)}" r="3.6" fill="${color}" stroke="#fff" stroke-width="1.4"><title>${label.replace(/[<>&]/g, '')}</title></circle>`;
  }).join('');

  const highlight = highlightWeek != null && Number.isFinite(highlightWeek)
    ? `<line x1="${x(highlightWeek).toFixed(1)}" y1="${PAD_T}" x2="${x(highlightWeek).toFixed(1)}" y2="${height - PAD_B}" stroke="#ec4899" stroke-width="1" stroke-dasharray="3 3" opacity="0.8" />`
    : '';

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img">
  ${gridX.join('')}
  ${gridY.join('')}
  ${bandPath ? `<path d="${bandPath}" fill="#06a510" fill-opacity="0.12" stroke="#06a510" stroke-opacity="0.35" stroke-width="1" />` : ''}
  ${highlight}
  ${trajectory}
  ${dots}
  <text x="${PAD_L - 5}" y="${PAD_T - 4}" text-anchor="end" font-size="8" fill="#94a3b8">kg</text>
  <text x="${width - PAD_R}" y="${height - 4}" text-anchor="end" font-size="8" fill="#94a3b8">semanas</text>
</svg>`;
};
