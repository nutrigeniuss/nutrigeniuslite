// Generador de reporte PDF de Evolución Antropométrica.
//
// A diferencia del PDF por consulta (printReport.ts) que muestra los
// indicadores de UNA fecha, este reporte compara MÚLTIPLES consultas y resalta
// la trayectoria del paciente a lo largo del tiempo.
//
// Reglas clave (definidas por producto):
//  1. Una sección solo aparece si al menos UNA consulta tiene datos para ella.
//     Ejemplo: si ningún registro tiene los pliegues + diámetros para
//     somatotipo, la sección y la somatocarta NO se imprimen.
//  2. Cada consulta válida en una sección recibe un color único; la fila de la
//     tabla y el punto en la gráfica comparten ese color.
//  3. El fondo de la fila usa el mismo color del punto pero con baja opacidad
//     (~14 %) para mantener la legibilidad.
//
// Estrategia de impresión: idéntica a printReport.ts → iframe oculto + srcdoc
// + window.print(). Cero dependencias adicionales.

import { computeSomatotype, compute5Components, compute4Components } from './composition';
import { calcAge, normalizeSex } from './indicators';
import {
  ageInMonths,
  assessPatientMeasurement,
  buildIndicatorTrajectory,
  buildZemelTrajectory,
  hasDownSyndrome,
  isPediatricPatient,
  parseSex,
  pediatricNormalZLabel,
  type PediatricIndicator,
  type ZemelPublicIndicator,
} from './pediatric';
import { buildGrowthChartSVG } from './growthChartSvg';
import type { Sex } from './types';
import { getCurrentLocale } from '@/lib/formatLocale';

// El modelo de 5C (Kerr) y el somatotipo (Heath-Carter) aplican desde los 6 años.
const ANTHRO_MODEL_MIN_MONTHS = 72;

type AnyRecord = Record<string, any>;

// Indicador OMS (cambia de nombre por tramo de edad) → clave/etiqueta estable
// para seguir el z-score a lo largo del tiempo en el reporte de evolución.
// La etiqueta incluye la banda normal en z (constante por indicador).
const PED_INDICATOR_BASE: Array<{ key: string; label: string; from: PediatricIndicator[] }> = [
  { key: 'weight_age', label: 'Peso/edad', from: ['wfa'] },
  { key: 'height_age', label: 'Talla/edad', from: ['lhfa', 'hfa'] },
  { key: 'bmi_age', label: 'IMC/edad', from: ['bmi'] },
  { key: 'weight_height', label: 'Peso/talla', from: ['wfl', 'wfh'] },
  { key: 'head', label: 'P. cefálico/edad', from: ['hcfa'] },
  { key: 'arm', label: 'P. braquial/edad', from: ['acfa'] },
  { key: 'ts', label: 'Pliegue tríceps/edad', from: ['tsfa'] },
  { key: 'ss', label: 'Pliegue subescapular/edad', from: ['ssfa'] },
];
const PED_INDICATORS = PED_INDICATOR_BASE.map((ind) => ({
  ...ind,
  label: `${ind.label} · normal ${pediatricNormalZLabel(ind.from[0])}`,
}));
const PED_KEY: Record<string, string> = Object.fromEntries(
  PED_INDICATORS.flatMap((ind) => ind.from.map((f) => [f, ind.key])),
);

export interface PrintEvolutionInput {
  patient: AnyRecord;
  measurements: AnyRecord[];
  brand?: string;
  /** Logo de la clínica (URL) para personalizar el encabezado. */
  brandLogoUrl?: string | null;
}

// ── Paleta de colores para distinguir consultas ─────────────────────────────
// Se asignan en orden cronológico. Si hay más consultas que colores, el ciclo
// vuelve a empezar (poco probable: una serie clínica rara vez supera 10).
const PALETTE = [
  '#3b5feb', // indigo
  '#ff5c57', // coral
  '#06a510', // verde
  '#f59e0b', // ámbar
  '#0ea5e9', // celeste
  '#a855f7', // morado
  '#ec4899', // rosa
  '#14b8a6', // teal
  '#84cc16', // lima
  '#f97316', // naranja
];

const colorFor = (i: number) => PALETTE[i % PALETTE.length];
// Devuelve el mismo color con un canal alpha (en hex de 1 byte) para fondos tenues.
const tintFor = (i: number, alphaHex: string = '22') => `${colorFor(i)}${alphaHex}`;

// ── Helpers de formato ──────────────────────────────────────────────────────
const esc = (s: unknown): string => {
  const t = s == null ? '' : String(s);
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const fmtNum = (n: any, dec = 1): string => {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const num = Number(n);
  return num.toFixed(dec);
};

const fmtDate = (d: any): string => {
  if (!d) return '—';
  const dt = new Date(`${d}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString(getCurrentLocale(), { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Construcción del SVG de la somatocarta con múltiples puntos ─────────────
// Cada punto representa una consulta con su color; los puntos van etiquetados
// con el número de consulta (1, 2, 3…) para correlacionar con la tabla.
function buildSomatocartaSVG(
  points: Array<{ x: number; y: number; color: string; label: string }>,
): string {
  const VB_W = 460;
  const VB_H = 420;
  const PAD_TOP = 40;
  const PAD_BOTTOM = 50;
  const PAD_X = 40;

  const xToPx = (gx: number) => PAD_X + ((gx + 8) / 16) * (VB_W - 2 * PAD_X);
  const yToPx = (gy: number) => PAD_TOP + ((16 - gy) / 24) * (VB_H - PAD_TOP - PAD_BOTTOM);
  const toPx = (gx: number, gy: number): [number, number] => [xToPx(gx), yToPx(gy)];

  const [mx, my] = toPx(0, 16);
  const [enx, eny] = toPx(-8, -8);
  const [ecx, ecy] = toPx(8, -8);
  const [cLx, cLy] = toPx(-6, 12);
  const [cRx, cRy] = toPx(6, 12);
  const domainPath = `M ${enx} ${eny} L ${ecx} ${ecy} Q ${cRx} ${cRy} ${mx} ${my} Q ${cLx} ${cLy} ${enx} ${eny} Z`;

  // Grilla
  const grid: string[] = [];
  for (let gx = -8; gx <= 8; gx += 2) {
    if (gx === 0) continue;
    const [px, py1] = toPx(gx, -8);
    const [, py2] = toPx(gx, 16);
    grid.push(`<line x1="${px}" y1="${py1}" x2="${px}" y2="${py2}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="2 3" />`);
  }
  for (let gy = -8; gy <= 16; gy += 4) {
    if (gy === 0) continue;
    const [px1, py] = toPx(-8, gy);
    const [px2] = toPx(8, gy);
    grid.push(`<line x1="${px1}" y1="${py}" x2="${px2}" y2="${py}" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="2 3" />`);
  }

  // Trayectoria (línea punteada conectando puntos en orden)
  const pxPts = points.map((p) => toPx(p.x, p.y));
  const trajectory = pxPts.length >= 2
    ? `<path d="${pxPts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px} ${py}`).join(' ')}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4 4" opacity="0.6" />`
    : '';

  // Marcas X/Y
  const xMarks: string[] = [];
  for (let gx = -8; gx <= 8; gx += 2) {
    const [px, py] = toPx(gx, 0);
    xMarks.push(`<text x="${px}" y="${py + 12}" text-anchor="middle" font-size="9" fill="#94a3b8">${gx}</text>`);
  }
  const yMarks: string[] = [];
  for (let gy = -8; gy <= 16; gy += 4) {
    if (gy === 0) continue;
    const [px, py] = toPx(0, gy);
    yMarks.push(`<text x="${px + 4}" y="${py + 3}" text-anchor="start" font-size="9" fill="#94a3b8">${gy}</text>`);
  }

  // Puntos coloreados con su etiqueta numérica
  const dots = points
    .map((p, i) => {
      const [px, py] = pxPts[i];
      return `
        <circle cx="${px}" cy="${py}" r="11" fill="${p.color}" opacity="0.18" />
        <circle cx="${px}" cy="${py}" r="6" fill="${p.color}" stroke="#fff" stroke-width="1.5" />
        <text x="${px}" y="${py + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">${esc(p.label)}</text>`;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${VB_W} ${VB_H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <path d="${domainPath}" fill="#eef1fe" stroke="#a5b4fc" stroke-width="1.2" />
      ${grid.join('')}
      <line x1="${toPx(-8, 0)[0]}" y1="${toPx(0, 0)[1]}" x2="${toPx(8, 0)[0]}" y2="${toPx(0, 0)[1]}" stroke="#94a3b8" stroke-width="0.6" />
      <line x1="${toPx(0, -8)[0]}" y1="${toPx(0, -8)[1]}" x2="${toPx(0, 16)[0]}" y2="${toPx(0, 16)[1]}" stroke="#94a3b8" stroke-width="0.6" stroke-dasharray="3 3" />
      <text x="${mx}" y="${my - 12}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">MESOMORFO</text>
      <text x="${enx}" y="${eny + 18}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">ENDOMORFO</text>
      <text x="${ecx}" y="${ecy + 18}" text-anchor="middle" font-size="13" font-weight="700" fill="#0f172a">ECTOMORFO</text>
      ${xMarks.join('')}
      ${yMarks.join('')}
      ${trajectory}
      ${dots}
    </svg>`;
}

// ── HTML principal del reporte ──────────────────────────────────────────────
function buildHtml({ patient, measurements, brand = 'NutriGenius', brandLogoUrl }: PrintEvolutionInput): string {
  // Datos básicos del paciente.
  const fullName = [patient?.name, patient?.last_name].filter(Boolean).join(' ') || patient?.full_name || 'Paciente';
  const sex: Sex | null = normalizeSex(patient?.gender || patient?.sex);
  const ageYears = calcAge(patient?.birth_date);
  const ageStr = ageYears != null ? `${Math.floor(ageYears)} años` : '—';
  const sexStr = sex === 'M' ? 'Masculino' : sex === 'F' ? 'Femenino' : '—';

  // Ordenamos cronológicamente por FECHA DE REGISTRO (created_at) para que
  // la consulta #1 sea la primera en haber sido capturada en el sistema.
  // Caemos a `date` si created_at no existe (datos antiguos).
  const sortKey = (m: AnyRecord) => String(m?.created_at || m?.date || '');
  const ordered = [...measurements].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  // Menor de 6 años en la fecha de la consulta (con fecha de nacimiento válida):
  // el somatotipo y la composición 5C/4C no aplican y se excluyen.
  const underSix = (m: AnyRecord): boolean => {
    const am = ageInMonths(patient?.birth_date, m?.date);
    return am !== null && am < ANTHRO_MODEL_MIN_MONTHS;
  };
  // Edad (años) en la FECHA de cada consulta, no la actual: las fórmulas de
  // composición/somatotipo dependen de la edad.
  const ageYearsAt = (m: AnyRecord): number | null => {
    const am = ageInMonths(patient?.birth_date, m?.date);
    return am !== null ? am / 12 : ageYears;
  };

  const downPatient = hasDownSyndrome(patient?.health_conditions?.current_pathologies);

  // z-scores OMS por consulta (según la edad del niño en cada fecha). En síndrome
  // de Down NO aplican (la referencia es Zemel por percentiles) → se omiten y en
  // su lugar se muestran las curvas de Zemel más abajo.
  const pedByM = new Map<AnyRecord, Record<string, number>>();
  for (const m of downPatient ? [] : ordered) {
    const zByKey: Record<string, number> = {};
    try {
      const a = assessPatientMeasurement({
        gender: patient?.gender || patient?.sex,
        birthDate: patient?.birth_date,
        measurementDate: m?.date,
        weightKg: m?.weight,
        heightCm: m?.height,
        headCircCm: m?.perimeters?.cephalic,
        armCircCm: m?.perimeters?.arm_relaxed,
        tricepsSkinfoldMm: m?.skinfolds?.triceps,
        subscapularSkinfoldMm: m?.skinfolds?.subscapular,
        abdominalCm: m?.perimeters?.abdominal_per,
      });
      for (const r of a?.results ?? []) {
        const key = PED_KEY[r.indicator];
        if (key && typeof r.zScore === 'number') zByKey[key] = Number(r.zScore.toFixed(2));
      }
    } catch { /* adulto o datos insuficientes */ }
    pedByM.set(m, zByKey);
  }

  // ── Sección Somatotipo ────────────────────────────────────────────────────
  // Solo se incluye si AL MENOS una consulta tiene endo/meso/ecto calculables.
  const somatoRows = ordered
    .map((m, idx) => {
      if (underSix(m)) return { idx, date: m?.date, x: null, y: null, endo: null, meso: null, ecto: null, classification: null };
      const r = computeSomatotype({
        weight: m?.weight,
        height: m?.height,
        height_sitting: m?.height_sitting,
        sex,
        ageYears: ageYearsAt(m),
        skinfolds: m?.skinfolds || {},
        diameters: m?.diameters || {},
        perimeters: m?.perimeters || {},
      });
      return { idx, date: m?.date, ...r };
    })
    .filter((r) => r.x !== null && r.y !== null && r.endo !== null && r.meso !== null && r.ecto !== null);

  let seccionSomatotipo = '';
  if (somatoRows.length >= 1) {
    // Asignamos color por orden cronológico de aparición en la lista filtrada.
    const points = somatoRows.map((r, i) => ({
      x: r.x as number,
      y: r.y as number,
      color: colorFor(i),
      label: String(i + 1),
    }));

    const tbody = somatoRows
      .map((r, i) => {
        const c = colorFor(i);
        const tint = tintFor(i, '22'); // ~13% alpha
        return `
          <tr style="background:${tint}">
            <td><span class="dot" style="background:${c}"></span><b>#${i + 1}</b></td>
            <td>${esc(fmtDate(r.date))}</td>
            <td><b style="color:${c}">${esc(r.classification || '—')}</b></td>
            <td>${fmtNum(r.endo, 2)}</td>
            <td>${fmtNum(r.meso, 2)}</td>
            <td>${fmtNum(r.ecto, 2)}</td>
          </tr>`;
      })
      .join('');

    seccionSomatotipo = `
      <section class="section">
        <h2><span class="dot dot-primary"></span>Evolución del Somatotipo (Heath-Carter)</h2>
        <div class="soma-row">
          <div class="soma-chart">${buildSomatocartaSVG(points)}</div>
          <table class="data-table data-table--colored">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Diagnóstico</th>
                <th>Endo</th>
                <th>Meso</th>
                <th>Ecto</th>
              </tr>
            </thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </section>`;
  }

  // ── Sección Composición 5 componentes (Kerr) ─────────────────────────────
  // Aparece si al menos una consulta tiene un modelo Kerr completo
  // (peso predictivo definido).
  const kerrRows = ordered
    .map((m, idx) => {
      if (underSix(m)) return { idx, date: m?.date, pesoPredictivo: null, rows: [] as AnyRecord[] };
      const r = compute5Components({
        weight: m?.weight,
        height: m?.height,
        height_sitting: m?.height_sitting,
        sex,
        ageYears: ageYearsAt(m),
        skinfolds: m?.skinfolds || {},
        diameters: m?.diameters || {},
        perimeters: m?.perimeters || {},
      });
      return { idx, date: m?.date, ...r };
    })
    .filter((r) => r.pesoPredictivo !== null);

  let seccionKerr = '';
  if (kerrRows.length >= 1) {
    const tbody = kerrRows
      .map((r, i) => {
        const tint = tintFor(i, '22');
        const c = colorFor(i);
        const find = (name: string) => r.rows.find((row) => row.name === name);
        const piel = find('Masa Piel');
        const adip = find('Masa Adiposa');
        const musc = find('Masa Muscular');
        const osea = find('Masa Ósea');
        const resi = find('Masa Residual');
        const cell = (v: any) => (v != null ? `${fmtNum(v, 2)} <span class="lbl-mini">kg</span>` : '—');
        return `
          <tr style="background:${tint}">
            <td><span class="dot" style="background:${c}"></span><b>#${i + 1}</b></td>
            <td>${esc(fmtDate(r.date))}</td>
            <td>${cell(piel?.kgAdj)}</td>
            <td>${cell(adip?.kgAdj)}</td>
            <td>${cell(musc?.kgAdj)}</td>
            <td>${cell(osea?.kgAdj)}</td>
            <td>${cell(resi?.kgAdj)}</td>
          </tr>`;
      })
      .join('');

    seccionKerr = `
      <section class="section">
        <h2><span class="dot dot-red"></span>Evolución de Composición Corporal — 5 componentes (Kerr 1988)</h2>
        <table class="data-table data-table--colored">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Piel</th>
              <th>Adiposa</th>
              <th>Muscular</th>
              <th>Ósea</th>
              <th>Residual</th>
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </section>`;
  }

  // ── Sección Composición 4 componentes (Matiegka) ─────────────────────────
  const fourRows = ordered
    .map((m, idx) => {
      if (underSix(m)) return { idx, date: m?.date, rows: [] as AnyRecord[] };
      const r = compute4Components({
        weight: m?.weight,
        height: m?.height,
        sex,
        ageYears: ageYearsAt(m),
        skinfolds: m?.skinfolds || {},
        diameters: m?.diameters || {},
        perimeters: m?.perimeters || {},
      });
      return { idx, date: m?.date, ...r };
    })
    .filter((r) => r.rows.some((row) => row.kg !== null));

  let seccion4comp = '';
  if (fourRows.length >= 1) {
    const tbody = fourRows
      .map((r, i) => {
        const tint = tintFor(i, '22');
        const c = colorFor(i);
        // Nota: compute4Components devuelve los nombres en minúsculas
        // ('Masa grasa', 'Masa muscular', 'Masa ósea', 'Masa residual').
        const find = (name: string) => r.rows.find((row) => row.name === name);
        const grasa = find('Masa grasa');
        const musc = find('Masa muscular');
        const osea = find('Masa ósea');
        const resi = find('Masa residual');
        const cell = (v: any) => (v != null ? `${fmtNum(v, 2)} <span class="lbl-mini">kg</span>` : '—');
        return `
          <tr style="background:${tint}">
            <td><span class="dot" style="background:${c}"></span><b>#${i + 1}</b></td>
            <td>${esc(fmtDate(r.date))}</td>
            <td>${cell(grasa?.kg)}</td>
            <td>${cell(musc?.kg)}</td>
            <td>${cell(osea?.kg)}</td>
            <td>${cell(resi?.kg)}</td>
          </tr>`;
      })
      .join('');

    seccion4comp = `
      <section class="section">
        <h2><span class="dot dot-sky"></span>Evolución de Composición Corporal — 4 componentes</h2>
        <table class="data-table data-table--colored">
          <thead>
            <tr>
              <th>#</th>
              <th>Fecha</th>
              <th>Grasa</th>
              <th>Muscular</th>
              <th>Ósea</th>
              <th>Residual</th>
            </tr>
          </thead>
          <tbody>${tbody}</tbody>
        </table>
      </section>`;
  }

  // ── Sección Mediciones Antropométricas básicas ────────────────────────────
  // Tabla resumen de peso, talla, IMC, perímetros y pliegues clave.
  // Cada columna indicador solo aparece si al menos UNA consulta la tiene.
  const indicators: Array<{ label: string; unit: string; get: (m: AnyRecord) => any }> = [
    { label: 'Peso', unit: 'kg', get: (m) => m?.weight },
    { label: 'Talla', unit: 'cm', get: (m) => m?.height },
    {
      label: 'IMC',
      unit: 'kg/m²',
      get: (m) => {
        const w = Number(m?.weight); const h = Number(m?.height);
        if (!w || !h) return null;
        return w / Math.pow(h / 100, 2);
      },
    },
    { label: 'Cintura', unit: 'cm', get: (m) => m?.perimeters?.waist },
    { label: 'Cadera', unit: 'cm', get: (m) => m?.perimeters?.hip },
    { label: 'Perímetro del brazo', unit: 'cm', get: (m) => m?.perimeters?.arm_relaxed },
    { label: 'Pliegue tríceps', unit: 'mm', get: (m) => m?.skinfolds?.triceps },
    { label: 'Pliegue subescapular', unit: 'mm', get: (m) => m?.skinfolds?.subscapular },
    { label: 'Suma 6 pliegues', unit: 'mm', get: (m) => {
      const s = m?.skinfolds || {};
      const vals = ['triceps', 'subscapular', 'iliac_crest', 'supraspinal', 'abdominal', 'front_thigh']
        .map((k) => Number(s[k])).filter((v) => !Number.isNaN(v) && v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
    } },
    // Indicadores OMS por edad/sexo (z-score). Solo tendrán datos —y por tanto
    // aparecerán— en pacientes niños/adolescentes.
    ...PED_INDICATORS.map((ind) => ({
      label: ind.label,
      unit: 'DE',
      get: (m: AnyRecord) => pedByM.get(m)?.[ind.key] ?? null,
    })),
  ];

  // Filtramos indicadores que tengan datos en al menos una consulta.
  const visibleIndicators = indicators.filter((ind) => ordered.some((m) => {
    const v = ind.get(m); return v != null && v !== '' && !Number.isNaN(Number(v));
  }));

  let seccionResumen = '';
  if (ordered.length >= 1 && visibleIndicators.length >= 1) {
    const headerRow = `
      <tr>
        <th class="th-sticky">Indicador</th>
        ${ordered.map((m, i) => `<th style="background:${tintFor(i, '33')};color:${colorFor(i)}">
          <div class="th-num">#${i + 1}</div>
          <div class="th-date">${esc(fmtDate(m?.date))}</div>
        </th>`).join('')}
      </tr>`;

    const dataRows = visibleIndicators
      .map((ind) => {
        const cells = ordered.map((m, i) => {
          const v = ind.get(m);
          if (v == null || v === '' || Number.isNaN(Number(v))) {
            return `<td style="background:${tintFor(i, '11')}">—</td>`;
          }
          return `<td style="background:${tintFor(i, '11')}"><b>${fmtNum(v, ind.unit === 'kg/m²' || ind.unit === 'DE' ? 2 : 1)}</b> <span class="lbl-mini">${esc(ind.unit)}</span></td>`;
        }).join('');
        return `<tr><td class="td-sticky"><b>${esc(ind.label)}</b></td>${cells}</tr>`;
      })
      .join('');

    seccionResumen = `
      <section class="section">
        <h2><span class="dot dot-primary"></span>Resumen de Mediciones por Consulta</h2>
        <table class="data-table data-table--matrix">
          <thead>${headerRow}</thead>
          <tbody>${dataRows}</tbody>
        </table>
      </section>`;
  }

  // ── Sección Curvas OMS (pacientes pediátricos ≤18 años) ──────────────────
  // Para niños/adolescentes se dibujan las curvas de crecimiento de la OMS con
  // la trayectoria a lo largo de las consultas; reemplazan al somatotipo/5C/4C,
  // que aplican a adultos (>18 años).
  const latestMeas = ordered[ordered.length - 1];
  const pedSex = parseSex(patient?.gender || patient?.sex);
  const latestPathologies = patient?.health_conditions?.current_pathologies;
  const pediatricReport = !!latestMeas && !!pedSex &&
    isPediatricPatient(ageInMonths(patient?.birth_date, latestMeas?.date || latestMeas?.created_at), latestPathologies);

  let seccionCurvasOMS = '';
  if (pediatricReport && pedSex) {
    const latestDate = latestMeas?.date || latestMeas?.created_at;
    const assessment = assessPatientMeasurement({
      gender: patient?.gender || patient?.sex,
      birthDate: patient?.birth_date,
      measurementDate: latestDate,
      weightKg: latestMeas?.weight,
      heightCm: latestMeas?.height,
      headCircCm: latestMeas?.perimeters?.cephalic,
      armCircCm: latestMeas?.perimeters?.arm_relaxed,
      tricepsSkinfoldMm: latestMeas?.skinfolds?.triceps,
      subscapularSkinfoldMm: latestMeas?.skinfolds?.subscapular,
      abdominalCm: latestMeas?.perimeters?.abdominal_per,
      pathologies: latestPathologies,
    });
    const isZemel = assessment?.standard === 'zemel';
    const chartables = (assessment?.results ?? []).filter(
      (r) => typeof r.chartX === 'number' && typeof r.chartValue === 'number',
    );
    // `date` cae a `created_at` para no perder consultas antiguas sin `date` (el
    // resto del módulo usa el mismo respaldo).
    const records = ordered.map((m) => ({
      date: m?.date || m?.created_at,
      weightKg: m?.weight,
      heightCm: m?.height,
      headCircCm: m?.perimeters?.cephalic,
      armCircCm: m?.perimeters?.arm_relaxed,
      tricepsMm: m?.skinfolds?.triceps,
      subscapularMm: m?.skinfolds?.subscapular,
    }));
    const figures = chartables
      .map((r) => {
        const traj = isZemel
          ? buildZemelTrajectory(r.indicator as ZemelPublicIndicator, pedSex, patient?.birth_date, records, latestDate)
          : buildIndicatorTrajectory(r.indicator as PediatricIndicator, pedSex, patient?.birth_date, records, latestDate);
        return traj.length > 0
          ? buildGrowthChartSVG(r.indicator as PediatricIndicator, pedSex, r.indicatorLabel, traj, isZemel ? 'zemel' : 'oms')
          : '';
      })
      .filter(Boolean);
    if (figures.length > 0) {
      seccionCurvasOMS = `
        <section class="section">
          <h2><span class="dot dot-primary"></span>${isZemel ? 'Curvas de crecimiento (Síndrome de Down · Zemel)' : 'Curvas de crecimiento OMS'}</h2>
          <div class="growth-grid">${figures.join('')}</div>
        </section>`;
    }
  }

  // ── Comprobación: si NO hay ninguna sección, mostramos un aviso ──────────
  const anySection = !!(seccionCurvasOMS || seccionSomatotipo || seccionKerr || seccion4comp || seccionResumen);

  // ── Header con metadatos del paciente ────────────────────────────────────
  const consultsBadge = `${ordered.length} consulta${ordered.length === 1 ? '' : 's'}`;
  const dateRange = ordered.length >= 1
    ? `${fmtDate(ordered[0]?.date)} → ${fmtDate(ordered[ordered.length - 1]?.date)}`
    : '—';

  // ── CSS embebido (auto-contenido para el iframe) ─────────────────────────
  const styles = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Roboto, system-ui, sans-serif;
    color: #0f172a; font-size: 11.5px; line-height: 1.45;
    margin: 0; padding: 0; background: #fff;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 10px; margin-bottom: 14px; border-bottom: 2px solid #3b5feb;
  }
  .brand { font-size: 18px; font-weight: 800; color: #3b5feb; letter-spacing: -0.3px; }
  .brand-sub { font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
  .meta-card {
    background: #f7f8ff; border: 1px solid #e0e4f5; border-radius: 12px;
    padding: 10px 14px; margin-bottom: 14px;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  }
  .meta-card .k { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
  .meta-card .v { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .growth-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 999px;
    background: #ecffef; color: #06a510; font-size: 10px; font-weight: 700;
    border: 1px solid #b8efbd;
  }
  .section { margin-bottom: 16px; page-break-inside: avoid; }
  .section h2 {
    font-size: 13px; font-weight: 800; color: #0f172a;
    display: flex; align-items: center; gap: 8px;
    margin: 0 0 8px; padding-bottom: 4px;
    border-bottom: 1px solid #e2e8f0;
  }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
  .dot-primary { background: #3b5feb; }
  .dot-red { background: #ff5c57; }
  .dot-sky { background: #0ea5e9; }
  .data-table {
    width: 100%; border-collapse: collapse; font-size: 10.5px;
  }
  .data-table th, .data-table td {
    padding: 6px 8px; text-align: left; border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  .data-table th {
    background: #f7f8ff; color: #475569; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; font-size: 9px;
  }
  .data-table--colored td:first-child { width: 38px; white-space: nowrap; }
  .data-table--matrix th, .data-table--matrix td { text-align: center; }
  .data-table--matrix th:first-child, .data-table--matrix td:first-child { text-align: left; }
  .th-num { font-size: 11px; font-weight: 800; }
  .th-date { font-size: 9px; font-weight: 600; opacity: 0.85; margin-top: 2px; }
  .th-sticky, .td-sticky { background: #fafbff; }
  .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 10px; color: #475569; }
  .lbl-mini { font-size: 9px; color: #94a3b8; font-weight: 500; }
  .soma-row {
    display: grid; grid-template-columns: 1.05fr 1fr; gap: 14px;
    align-items: start;
  }
  .soma-chart svg { width: 100%; height: auto; display: block; }
  .empty-state {
    text-align: center; padding: 40px 20px;
    background: #fafbff; border: 1px dashed #cbd5e1; border-radius: 12px;
    color: #64748b; font-size: 12px; font-weight: 600;
  }
  .footer {
    margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0;
    font-size: 9px; color: #94a3b8; text-align: center;
  }
  `;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Evolución Antropométrica — ${esc(fullName)}</title>
  <style>${styles}</style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:10px">
      ${brandLogoUrl ? `<img src="${esc(brandLogoUrl)}" alt="${esc(brand)}" style="width:40px;height:40px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid #e2e8f0;" />` : ''}
      <div>
        <div class="brand">${esc(brand)}</div>
        <div class="brand-sub">Reporte de Evolución Antropométrica</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:13px;font-weight:800">${esc(fullName)}</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px">${esc(sexStr)} · ${esc(ageStr)}</div>
    </div>
  </div>

  <div class="meta-card">
    <div><div class="k">Consultas</div><div class="v">${esc(consultsBadge)}</div></div>
    <div><div class="k">Período</div><div class="v">${esc(dateRange)}</div></div>
    <div><div class="k">Sexo</div><div class="v">${esc(sexStr)}</div></div>
    <div><div class="k">Edad</div><div class="v">${esc(ageStr)}</div></div>
  </div>

  ${anySection ? '' : `
    <div class="empty-state">
      No hay datos suficientes en las consultas registradas para generar
      un reporte de evolución. Registre al menos una medición completa.
    </div>`}

  ${pediatricReport
    ? `${seccionCurvasOMS}${seccionResumen}`
    : `${seccionResumen}${seccionSomatotipo}${seccionKerr}${seccion4comp}`}

  <div class="footer">
    Generado por ${esc(brand)} · ${esc(new Date().toLocaleDateString(getCurrentLocale(), { day: '2-digit', month: 'long', year: 'numeric' }))}
  </div>
</body>
</html>`;
}

/**
 * Lanza la impresión del reporte de evolución (iframe oculto + auto-print).
 * Devuelve true si se pudo iniciar el flujo de impresión.
 */
export function printEvolutionReport(input: PrintEvolutionInput): boolean {
  const html = buildHtml(input);
  try {
    const previous = document.getElementById('nutrigenius-evolucion-print-frame');
    if (previous) previous.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'nutrigenius-evolucion-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.srcdoc = html;
    document.body.appendChild(iframe);

    iframe.addEventListener('load', () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          /* silencioso */
        }
      }, 250);
    });
    return true;
  } catch {
    // Fallback: descargar como HTML.
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evolucion-antropometrica.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return false;
  }
}
