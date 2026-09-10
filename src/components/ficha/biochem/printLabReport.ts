// Reporte imprimible (PDF) de una toma de laboratorio.
//
// Misma estrategia que el reporte antropométrico: HTML auto-contenido en un
// iframe oculto + print(), sin sumar dependencias al bundle. Se reutilizan su
// CSS y sus helpers de formato para que ambos documentos se vean como del mismo
// consultorio.
//
// Qué imprime:
//   • Cabecera con marca del profesional y datos del paciente.
//   • Un bloque por panel con SOLO los analitos que tienen valor, su rango
//     vigente y un chip cuando el valor cae fuera.
//   • Los índices calculados con su interpretación y la fórmula desarrollada.
//   • Un resumen de hallazgos arriba, para que el paciente y el médico tratante
//     vean primero lo que está fuera de rango.

import { chip, esc, fmtDate, section } from '@/lib/anthropometry/printReport/format';
import { REPORT_CSS } from '@/lib/anthropometry/printReport/styles';
import { openHtmlPrintPreview } from '@/lib/htmlPrintPreview';
import { parseLocalDate, patientAgeYears } from '@/lib/patients/age';
import {
  PANELS,
  evaluateValue,
  formatRange,
  hasValue,
  parseSexKey,
  resolveRange,
  type LabAnalyte,
  type LabEntry,
  type LabRange,
  type LabStatus,
} from './biochemConfig';
import { computeIndices, type IndexResult, type IndexTone, type MeasurementLike } from './labIndices';
import { isPregnant, type PregnancyRecord } from '@/lib/gestation/gestationalGain';

type LabReportPatient = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  gender?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  measurements?: MeasurementLike[];
  reference_weights?: { habitual?: { kg?: number | null } | null } | null;
  pregnancies?: PregnancyRecord[] | null;
};

export type PrintLabReportInput = {
  patient: LabReportPatient;
  entry: LabEntry;
  accountRanges?: Record<string, LabRange> | null;
  brand?: string;
  brandLogoUrl?: string | null;
};

// Estado del valor → severidad de los chips compartidos con el otro reporte.
// `low` usa el gris neutro porque la paleta del reporte solo define
// good/warn/bad/info; la palabra "Bajo" ya comunica la dirección.
const STATUS_SEVERITY: Record<Exclude<LabStatus, null>, string> = {
  high: 'bad',
  low: 'info',
  abnormal: 'warn',
  normal: 'good',
};

const STATUS_LABEL: Record<Exclude<LabStatus, null>, string> = {
  high: 'Alto',
  low: 'Bajo',
  abnormal: 'Anormal',
  normal: '',
};

const TONE_SEVERITY: Record<IndexTone, string> = {
  critical: 'bad',
  warning: 'bad',
  caution: 'warn',
  normal: 'good',
};

/** Años cumplidos el día de la toma, del cálculo común de la app. */
const calcAgeYears = (birthDate?: string | null, onDate?: string | null): number | null =>
  patientAgeYears(birthDate, (onDate ? parseLocalDate(onDate) : null) ?? new Date());

const valueText = (analyte: LabAnalyte, raw: unknown): string => {
  if (analyte.kind === 'select') return String(raw);
  return `${raw}${analyte.unit ? ` ${analyte.unit}` : ''}`;
};

// Fila de analito. Solo se emite si hay valor: el PDF no muestra huecos.
const analyteRow = (
  analyte: LabAnalyte,
  raw: unknown,
  range: LabRange | null,
  status: LabStatus,
): string => {
  if (!hasValue(raw)) return '';
  const statusChip = status && STATUS_LABEL[status] ? chip(STATUS_LABEL[status], STATUS_SEVERITY[status]) : '';
  const rangeText = analyte.kind === 'select'
    ? (analyte.normal ? `Normal: ${analyte.normal}` : '—')
    : formatRange(range);

  return `
  <tr>
    <td class="lbl">${esc(analyte.label)}</td>
    <td class="val">${esc(valueText(analyte, raw))}</td>
    <td class="extra">${esc(rangeText)} ${statusChip}</td>
  </tr>`;
};

const indexRow = (result: IndexResult): string => {
  if (result.value === null) return '';
  const interpretation = result.band ? chip(result.band.label, TONE_SEVERITY[result.band.tone]) : '';
  return `
  <tr>
    <td class="lbl">${esc(result.label)}</td>
    <td class="val">${esc(result.value.toFixed(result.decimals))}</td>
    <td class="extra">${interpretation}${result.formula ? `<div class="formula">${esc(result.formula)}</div>` : ''}</td>
  </tr>`;
};

function buildHtml({ patient, entry, accountRanges, brand = 'NutriGenius', brandLogoUrl }: PrintLabReportInput): string {
  const fullName = [patient?.name || patient?.first_name, patient?.last_name].filter(Boolean).join(' ')
    || patient?.full_name
    || 'Paciente';
  const sexRaw = patient?.gender || patient?.sex;
  const sex = parseSexKey(sexRaw);
  const ageYears = calcAgeYears(patient?.birth_date, entry.date);
  const values = entry.values || {};

  // Paneles con al menos un valor cargado; el resto no aparece en el reporte.
  let filledTotal = 0;
  const findings: string[] = [];

  const panelSections = PANELS.map((panel) => {
    const rows = panel.analytes.map((analyte) => {
      const raw = values[analyte.key];
      if (!hasValue(raw)) return '';
      filledTotal += 1;
      const { range } = resolveRange(analyte, sex, accountRanges, entry.ranges);
      const status = evaluateValue(analyte, raw, range);
      if (status === 'high' || status === 'low' || status === 'abnormal') {
        findings.push(`${analyte.label}: ${valueText(analyte, raw)} (${STATUS_LABEL[status].toLowerCase()})`);
      }
      return analyteRow(analyte, raw, range, status);
    }).join('');

    return section(panel.label, 'dot-primary', rows, {
      headerCols: '<th>Análisis</th><th>Valor</th><th>Referencia</th>',
    });
  }).join('');

  const indices = computeIndices(entry, {
    sex,
    birthDate: patient?.birth_date,
    measurements: patient?.measurements || [],
    habitualWeightKg: patient?.reference_weights?.habitual?.kg ?? null,
    isPregnant: isPregnant(patient?.pregnancies),
    thresholds: Object.fromEntries(
      Object.entries(accountRanges || {})
        .filter(([key, range]) => key.startsWith('index:') && range?.max != null)
        .map(([key, range]) => [key, range.max as number]),
    ),
  });

  const indicesSection = section(
    'Índices calculados',
    'dot-amber',
    indices.map(indexRow).join(''),
    { headerCols: '<th>Índice</th><th>Valor</th><th>Interpretación</th>' },
  );

  // Resumen de hallazgos: lo primero que se lee. Si todo está en rango se dice
  // explícitamente, que también es información clínica.
  const summaryHtml = filledTotal === 0
    ? ''
    : `
    <div class="findings ${findings.length > 0 ? 'findings--alert' : 'findings--ok'}">
      <div class="findings-title">${findings.length > 0
        ? `${findings.length} ${findings.length === 1 ? 'valor fuera de rango' : 'valores fuera de rango'}`
        : 'Todos los valores registrados están dentro del rango de referencia'}</div>
      ${findings.length > 0 ? `<ul>${findings.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>` : ''}
    </div>`;

  const headerHtml = `
    <header class="report-header">
      <div class="brand">
        ${brandLogoUrl
          ? `<img src="${esc(brandLogoUrl)}" alt="${esc(brand)}" style="width:44px;height:44px;object-fit:contain;border-radius:8px;background:#fff;border:1px solid #e2e8f0;" />`
          : `<div class="brand-mark">${esc(brand[0] || 'N')}</div>`}
        <div>
          <div class="brand-name">${esc(brand)}</div>
          <div class="brand-sub">Reporte de Exámenes de Laboratorio</div>
        </div>
      </div>
      <div class="meta">
        <div><span>Fecha del examen:</span> ${esc(fmtDate(entry.date))}</div>
        ${entry.lab ? `<div><span>Laboratorio:</span> ${esc(entry.lab)}</div>` : ''}
      </div>
    </header>`;

  const patientHtml = `
    <div class="patient-card">
      <div>
        <div class="patient-name">${esc(fullName)}</div>
        <div class="lbl-mini" style="margin-top:4px">Paciente</div>
      </div>
      <div class="patient-grid">
        <div>
          <div class="lbl-mini">Edad</div>
          <div>${ageYears != null ? `${ageYears} años` : '—'}</div>
        </div>
        <div>
          <div class="lbl-mini">Sexo</div>
          <div>${sex === 'male' ? 'Masculino' : sex === 'female' ? 'Femenino' : '—'}</div>
        </div>
        <div>
          <div class="lbl-mini">Análisis</div>
          <div>${filledTotal}</div>
        </div>
      </div>
    </div>`;

  const emptyHtml = filledTotal === 0
    ? '<section class="section"><p style="color:#94a3b8">Esta toma todavía no tiene valores registrados.</p></section>'
    : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Laboratorio — ${esc(fullName)} — ${esc(entry.date || '')}</title>
  <style>${REPORT_CSS}
  .findings { border-radius: 10px; padding: 12px 16px; margin-bottom: 18px; }
  .findings--alert { background: #fff1f0; border: 1px solid #fecaca; }
  .findings--ok { background: #f0fdf4; border: 1px solid #bbf7d0; }
  .findings-title { font-weight: 800; font-size: 12px; }
  .findings--alert .findings-title { color: #b91c1c; }
  .findings--ok .findings-title { color: #15803d; }
  .findings ul { margin: 6px 0 0; padding-left: 18px; color: #7f1d1d; font-size: 11px; }
  .findings li { margin-top: 2px; }
  .formula { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 9.5px; color: #94a3b8; margin-top: 3px; }
  .chip { white-space: nowrap; }
  </style>
</head>
<body>
  <div class="page">
    ${headerHtml}
    ${patientHtml}
    ${summaryHtml}
    ${panelSections}
    ${indicesSection}
    ${emptyHtml}
    <footer class="report-footer">
      <div class="signature">
        <div class="line"></div>
        <div class="sig-lbl">Firma y sello del profesional</div>
      </div>
      <div class="legal">
        Documento generado por ${esc(brand)} a partir de los valores registrados por el profesional.
        Los rangos de referencia pueden variar entre laboratorios. No sustituye la interpretación clínica.
      </div>
    </footer>
  </div>
</body>
</html>`;
}

/** Abre la vista previa del reporte de laboratorio. */
export function printLabReport(input: PrintLabReportInput): boolean {
  const html = buildHtml(input);
  return openHtmlPrintPreview({
    html,
    title: 'Vista previa · Laboratorio',
    downloadName: `laboratorio-${input.entry.date || 'reporte'}.html`,
  });
}
