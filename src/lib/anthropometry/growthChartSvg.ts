// =============================================================================
// Curva de crecimiento OMS como SVG en línea, para incrustar en los reportes PDF
// (printReport.ts por consulta y printEvolution.ts). Dibuja las 5 líneas SD
// (−3/−2/0/+2/+3), la banda normal sombreada y la trayectoria del niño a lo
// largo de sus consultas, marcando la última en rojo. Reutiliza el mismo motor
// verificado (buildGrowthCurve / TrajectoryPoint) que la versión en pantalla.
// =============================================================================

import {
  buildTrajectoryCurve,
  buildZemelCurve,
  type PediatricIndicator,
  type PediatricSex,
  type TrajectoryPoint,
  type ZemelPublicIndicator,
} from './pediatric';

// Qué mide cada indicador (para la unidad del eje Y en el subtítulo).
const MEASURE_UNIT: Record<string, string> = {
  wfa: 'kg', lhfa: 'cm', hfa: 'cm', wfl: 'kg', wfh: 'kg',
  bmi: '', hcfa: 'cm', acfa: 'cm', tsfa: 'mm', ssfa: 'mm',
};

const C_MEDIAN = '#16a34a';
const C_SD2 = '#ef4444';
const C_SD3 = '#111111';
const C_BAND = '#eafaf0';
const C_TRACK = '#94a3b8';
const C_DOT = '#64748b';
const C_CURRENT = '#ff3b30';

const n1 = (v: number): string => (Math.round(v * 10) / 10).toString();

// Reduce la resolución de la curva para no inflar el SVG (las tablas tienen
// hasta ~228 puntos). Conserva siempre el primero y el último.
const downsample = <T,>(arr: T[], max = 80): T[] => {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
};

/**
 * Devuelve un `<figure>` con la curva OMS del indicador (o cadena vacía si no
 * hay tabla). `points` es la trayectoria del niño (una entrada por consulta);
 * la que tenga `isCurrent` se resalta en rojo.
 */
export const buildGrowthChartSVG = (
  indicator: PediatricIndicator,
  sex: PediatricSex,
  label: string,
  points: TrajectoryPoint[],
  standard: 'oms' | 'zemel' = 'oms',
): string => {
  const curve = standard === 'zemel'
    ? buildZemelCurve(indicator as unknown as ZemelPublicIndicator, sex, points.map((p) => p.x))
    : buildTrajectoryCurve(indicator, sex, points.map((p) => p.x));
  if (!curve || curve.points.length === 0) return '';

  const isAge = curve.unit === 'month';
  const cpts = curve.points;
  const xMin = cpts[0].x;
  const xMax = cpts[cpts.length - 1].x;

  // Dominio Y: SOLO las líneas SD (−3..+3) con margen; los puntos del niño no
  // expanden la escala (un outlier la aplastaría) y se fijan al borde si exceden.
  const ysAll = cpts.flatMap((p) => [p.sd3neg, p.sd3]);
  const yMin = Math.min(...ysAll) - 1;
  const yMax = Math.max(...ysAll) + 1;
  const clampY = (v: number): number => Math.max(yMin, Math.min(yMax, v));

  // Geometría (viewBox fijo; el ancho se adapta con width=100%).
  const W = 360, H = 220;
  const padL = 30, padR = 26, padT = 12, padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const sx = (x: number): number => padL + ((x - xMin) / (xMax - xMin || 1)) * plotW;
  const sy = (y: number): number => padT + ((yMax - y) / (yMax - yMin || 1)) * plotH;

  const ds = downsample(cpts);
  const poly = (key: 'sd3neg' | 'sd2neg' | 'sd0' | 'sd2' | 'sd3'): string =>
    ds.map((p) => `${n1(sx(p.x))},${n1(sy(p[key]))}`).join(' ');

  // Banda normal (−2 a +2 DE): sd2neg de ida + sd2 de vuelta.
  const bandFwd = ds.map((p) => `${n1(sx(p.x))},${n1(sy(p.sd2neg))}`).join(' ');
  const bandBack = [...ds].reverse().map((p) => `${n1(sx(p.x))},${n1(sy(p.sd2))}`).join(' ');

  // Etiquetas de las 5 líneas: percentiles (Zemel) o z-scores OMS.
  const lineLabels = curve.lineLabels ?? ['-3', '-2', '0', '2', '3'];
  const refLabel = curve.lineLabels ? 'percentiles (Zemel · Down)' : 'z-scores (OMS)';

  const last = cpts[cpts.length - 1];
  const edge = (text: string, y: number, color: string): string =>
    `<text x="${n1(sx(xMax) + 3)}" y="${n1(sy(y) + 3)}" font-size="9" font-weight="700" fill="${color}">${text}</text>`;

  // Trayectoria del niño.
  const track = points.length > 1
    ? `<polyline points="${points.map((p) => `${n1(sx(p.x))},${n1(sy(clampY(p.value)))}`).join(' ')}" fill="none" stroke="${C_TRACK}" stroke-width="1.4" />`
    : '';
  const dots = points.map((p) => {
    const cx = n1(sx(p.x)); const cy = n1(sy(clampY(p.value)));
    return p.isCurrent
      ? `<circle cx="${cx}" cy="${cy}" r="4.5" fill="${C_CURRENT}" stroke="#fff" stroke-width="1.5" />`
      : `<circle cx="${cx}" cy="${cy}" r="2.6" fill="#fff" stroke="${C_DOT}" stroke-width="1.3" />`;
  }).join('');

  // Ticks del eje X: por año (edad) o extremos (talla).
  let xTicks = '';
  if (isAge) {
    for (let m = Math.ceil(xMin / 12) * 12; m <= xMax; m += 12) {
      xTicks += `<text x="${n1(sx(m))}" y="${H - 8}" font-size="8" fill="#94a3b8" text-anchor="middle">${Math.round(m / 12)}</text>`;
    }
  } else {
    xTicks =
      `<text x="${n1(sx(xMin))}" y="${H - 8}" font-size="8" fill="#94a3b8" text-anchor="start">${Math.round(xMin)}</text>` +
      `<text x="${n1(sx(xMax))}" y="${H - 8}" font-size="8" fill="#94a3b8" text-anchor="end">${Math.round(xMax)}</text>`;
  }
  const xAxisLabel = isAge ? 'Edad (años)' : 'Talla (cm)';

  const unit = MEASURE_UNIT[indicator] || '';
  const rangeLabel = isAge
    ? `${Math.round(xMin / 12)}–${Math.round(xMax / 12)} años`
    : `${Math.round(xMin)}–${Math.round(xMax)} cm`;
  const frame = sex === 'girls' ? '#e5007d' : '#0e75bc';
  const sexLabel = sex === 'girls' ? 'niñas' : 'niños';

  return `
  <figure class="growth-chart" style="margin:0;border:1px solid ${frame};border-radius:8px;overflow:hidden;background:#fff;break-inside:avoid;page-break-inside:avoid">
    <figcaption style="background:${frame};color:#fff;padding:4px 8px">
      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;line-height:1.1">${label} · ${sexLabel}</div>
      <div style="font-size:8px;opacity:.9;line-height:1.1">${rangeLabel} · ${refLabel}${unit ? ` · ${unit}` : ''}</div>
    </figcaption>
    <svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${bandFwd} ${bandBack}" fill="${C_BAND}" stroke="none" />
      <polyline points="${poly('sd3neg')}" fill="none" stroke="${C_SD3}" stroke-width="1" />
      <polyline points="${poly('sd2neg')}" fill="none" stroke="${C_SD2}" stroke-width="1" />
      <polyline points="${poly('sd0')}" fill="none" stroke="${C_MEDIAN}" stroke-width="1.4" />
      <polyline points="${poly('sd2')}" fill="none" stroke="${C_SD2}" stroke-width="1" />
      <polyline points="${poly('sd3')}" fill="none" stroke="${C_SD3}" stroke-width="1" />
      ${edge(lineLabels[4], last.sd3, C_SD3)}${edge(lineLabels[3], last.sd2, C_SD2)}${edge(lineLabels[2], last.sd0, C_MEDIAN)}${edge(lineLabels[1], last.sd2neg, C_SD2)}${edge(lineLabels[0], last.sd3neg, C_SD3)}
      ${track}${dots}
      ${xTicks}
      <text x="${padL + plotW / 2}" y="${H - 1}" font-size="8" fill="#94a3b8" text-anchor="middle">${xAxisLabel}</text>
    </svg>
  </figure>`;
};
