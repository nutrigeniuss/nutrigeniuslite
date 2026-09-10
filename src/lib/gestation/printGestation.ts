// Reporte imprimible (PDF) de la evolución de la gestación.
//
// Misma estrategia que los otros reportes de la app: HTML autocontenido en un
// iframe oculto + print(), reutilizando su CSS. La curva es el MISMO SVG que se
// ve en pantalla (gainChartSvg), así que el papel y la pantalla no pueden
// divergir.

import { esc, fmtDate } from '@/lib/anthropometry/printReport/format';
import { REPORT_CSS } from '@/lib/anthropometry/printReport/styles';
import { openHtmlPrintPreview } from '@/lib/htmlPrintPreview';
import { buildGainChartSVG, type GainPoint } from './gainChartSvg';
import {
  assessGestation,
  estimatedDueDate,
  formatGestationalAge,
  gestationalAgeAt,
  GAIN_TABLE_SOURCE,
  type PregnancyRecord,
} from './gestationalGain';

type PrintablePatient = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  birth_date?: string | null;
  measurements?: Array<{ date?: string | null; weight?: number | null; height?: number | null }>;
};

export type PrintGestationInput = {
  patient: PrintablePatient;
  pregnancy: PregnancyRecord;
  brand?: string;
  brandLogoUrl?: string | null;
};

const SEVERITY_CHIP: Record<string, { bg: string; fg: string }> = {
  good: { bg: '#dcfce7', fg: '#15803d' },
  warn: { bg: '#fef9c3', fg: '#a16207' },
  bad: { bg: '#fee2e2', fg: '#b91c1c' },
  info: { bg: '#f1f5f9', fg: '#475569' },
};

function buildHtml({ patient, pregnancy, brand = 'NutriGenius', brandLogoUrl }: PrintGestationInput): string {
  const fullName = [patient?.name || patient?.first_name, patient?.last_name].filter(Boolean).join(' ')
    || patient?.full_name
    || 'Paciente';

  const measurements = Array.isArray(patient?.measurements) ? patient.measurements : [];
  const rows = measurements
    .filter((measurement) => measurement?.date && measurement?.weight != null)
    .sort((left, right) => String(left.date).localeCompare(String(right.date)))
    .map((measurement) => {
      const age = gestationalAgeAt(pregnancy, measurement.date);
      if (!age) return null;
      const assessment = assessGestation({
        prePregnancyKg: pregnancy?.prePregnancyKg,
        currentWeightKg: measurement.weight,
        heightCm: measurement.height,
        week: age.weeks,
        type: pregnancy?.type || 'single',
      });
      return { date: measurement.date as string, weight: measurement.weight as number, age, assessment };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const last = rows[rows.length - 1] ?? null;
  const category = rows.find((row) => row.assessment.category)?.assessment.category ?? null;

  const points: GainPoint[] = rows
    .filter((row) => row.assessment.gainKg !== null)
    .map((row) => ({
      week: row.age.weeks,
      gainKg: row.assessment.gainKg as number,
      date: row.date,
      severity: row.assessment.severity,
    }));

  const chart = category
    ? buildGainChartSVG({
        category,
        type: pregnancy?.type || 'single',
        points,
        highlightWeek: last?.age.weeks ?? null,
        width: 620,
        height: 250,
      })
    : '';

  const tableRows = rows.map((row) => {
    const chip = row.assessment.diagnosis
      ? (() => {
          const color = SEVERITY_CHIP[row.assessment.severity] || SEVERITY_CHIP.info;
          return `<span class="chip" style="background:${color.bg};color:${color.fg}">${esc(row.assessment.diagnosis)}</span>`;
        })()
      : '<span class="lbl-mini">Sin tabla</span>';

    return `<tr>
      <td>${esc(fmtDate(row.date))}</td>
      <td><b>${esc(formatGestationalAge(row.age))}</b></td>
      <td class="num">${row.weight} kg</td>
      <td class="num"><b>${row.assessment.gainKg !== null ? `${row.assessment.gainKg > 0 ? '+' : ''}${row.assessment.gainKg}` : '—'}</b></td>
      <td class="num lbl-mini">${row.assessment.range ? `${row.assessment.range.min} – ${row.assessment.range.max}` : '—'}</td>
      <td>${chip}</td>
    </tr>`;
  }).join('');

  const dueDate = estimatedDueDate(pregnancy);
  const summary = last
    ? `
      <div class="kerr-meta">
        <div>Edad gestacional <b>${esc(formatGestationalAge(last.age))}</b></div>
        <div>IMC pregestacional <b>${last.assessment.bmi != null ? `${last.assessment.bmi.toFixed(2)} · ${esc(last.assessment.categoryLabel || '')}` : '—'}</b></div>
        <div>Ganancia acumulada <b>${last.assessment.gainKg !== null ? `${last.assessment.gainKg > 0 ? '+' : ''}${last.assessment.gainKg} kg` : '—'}</b></div>
      </div>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Evolución de la gestación — ${esc(fullName)}</title>
  <style>${REPORT_CSS}
  .data-table td, .data-table th { font-size: 11px; }
  .data-table .num { text-align: right; }
  .lbl-mini { font-size: 9.5px; color: #94a3b8; }
  .gain-chart { border: 1px solid #e2e8f0; border-radius: 10px; background: #fafbff; padding: 6px; }
  .gain-chart svg { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <div class="page">
    <header class="report-header">
      <div class="brand">
        ${brandLogoUrl
          ? `<img src="${esc(brandLogoUrl)}" alt="${esc(brand)}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid #e2e8f0;" />`
          : `<div class="brand-mark">${esc(brand[0] || 'N')}</div>`}
        <div>
          <div class="brand-name">${esc(brand)}</div>
          <div class="brand-sub">Evolución de la Gestación</div>
        </div>
      </div>
      <div class="meta">
        <div><span>Controles:</span> ${rows.length}</div>
        ${pregnancy?.fum ? `<div><span>FUM:</span> ${esc(fmtDate(pregnancy.fum))}</div>` : ''}
        ${dueDate ? `<div><span>Fecha probable de parto:</span> ${esc(fmtDate(dueDate))}</div>` : ''}
      </div>
    </header>

    <div class="patient-card">
      <div>
        <div class="patient-name">${esc(fullName)}</div>
        <div class="lbl-mini" style="margin-top:4px">Gestante${pregnancy?.type === 'twin' ? ' · embarazo múltiple' : ''}</div>
      </div>
      <div class="patient-grid">
        <div>
          <div class="lbl-mini">Peso pregestacional</div>
          <div>${pregnancy?.prePregnancyKg != null ? `${pregnancy.prePregnancyKg} kg` : '—'}</div>
        </div>
      </div>
    </div>

    ${summary}

    ${chart ? `
    <section class="section">
      <h2><span class="dot dot-primary"></span>Curva de ganancia de peso</h2>
      <div class="gain-chart">${chart}</div>
      <p class="lbl-mini" style="margin-top:6px">
        Eje vertical: kg ganados respecto del peso pregestacional. Eje horizontal: semanas de gestación.
        La franja verde es el rango recomendado para su IMC pregestacional.
      </p>
    </section>` : ''}

    ${rows.length > 0 ? `
    <section class="section">
      <h2><span class="dot dot-red"></span>Controles</h2>
      <table class="data-table">
        <thead><tr>
          <th>Control</th><th>Semana</th><th class="num">Peso</th>
          <th class="num">Ganancia</th><th class="num">Esperado</th><th>Diagnóstico</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>` : '<section class="section"><p style="color:#94a3b8">Sin controles con peso dentro de la gestación.</p></section>'}

    <footer class="report-footer">
      <div class="signature">
        <div class="line"></div>
        <div class="sig-lbl">Firma y sello del profesional</div>
      </div>
      <div class="legal">
        Fuente de los rangos: ${esc(GAIN_TABLE_SOURCE)}
        <br />Documento generado por ${esc(brand)}. No sustituye la interpretación clínica.
      </div>
    </footer>
  </div>
</body>
</html>`;
}

/** Abre la vista previa de la evolución gestacional (cerrar / imprimir PDF). */
export function printGestationReport(input: PrintGestationInput): boolean {
  const html = buildHtml(input);
  return openHtmlPrintPreview({
    html,
    title: 'Vista previa · Evolución gestacional',
    downloadName: 'evolucion-gestacion.html',
  });
}
