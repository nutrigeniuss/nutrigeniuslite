// La parte pediátrica del informe: la tabla de z-scores de la OMS y las curvas
// de crecimiento con la trayectoria del niño.
//
// Vive aparte porque REEMPLAZA al informe de adulto entero. A un niño no se le
// aplican las fórmulas de peso ideal ni la composición corporal: no están
// validadas en esa etapa, y un número de adulto puesto sobre un niño es peor
// que ningún número.
//
// El cuerpo se movió TAL CUAL, con su indentación original: lo que hay dentro
// de las plantillas es el HTML que se imprime, y reindentarlo lo cambiaría.
import { buildGrowthChartSVG } from '../growthChartSvg';
import {
  buildIndicatorTrajectory,
  buildZemelTrajectory,
  formatNormalRange,
  parseSex,
  pediatricNormalRange,
  type PediatricIndicator,
  type PediatricTone,
  type ZemelPublicIndicator,
} from '../pediatric';
import { type AnyRecord, chip, esc, section } from './format';

type ResultadoPediatrico = {
  indicator: string;
  indicatorLabel: string;
  valueLabel: string;
  chartX?: number | null;
  chartValue?: number | null;
  classification: { label: string; tone: PediatricTone };
};

type Entrada = {
  patient: AnyRecord;
  measurement: AnyRecord;
  consultDate: string | null;
  /** La evaluación ya hecha: `assessPatientMeasurement` del módulo pediátrico. */
  pediatric: { standard?: string; results: ResultadoPediatrico[] } | null;
  /** Cartas de síndrome de Down (Zemel) en lugar de las de la OMS. */
  isZemel: boolean;
};

/**
 * Las DOS secciones pediátricas: la tabla de indicadores y las curvas.
 *
 * Van juntas porque salen de la misma evaluación; separarlas obligaría a
 * recorrer los resultados dos veces. Si el paciente no es un niño, o no se le
 * pudo determinar el sexo, devuelve las dos vacías y el informe no las pinta.
 */
export const buildPediatricSections = (
  { patient, measurement, consultDate, pediatric, isZemel }: Entrada,
): { tabla: string; curvas: string } => {
  const isChild = !!pediatric && pediatric.results.length > 0;
  const pedSex = parseSex(patient?.gender || patient?.sex);
  if (!isChild || !pedSex || !pediatric) return { tabla: '', curvas: '' };

  // ── Sección: Evaluación pediátrica (z-scores OMS) ──
  // Cada indicador aplicable a la edad, ordenado por severidad, con su z-score y
  // la clasificación clínica (desnutrición, sobrepeso, talla baja, etc.).
  const TONE_SEVERITY: Record<PediatricTone, string> = {
    critical: 'bad', warning: 'warn', high: 'warn', caution: 'warn', normal: 'good',
  };
  const TONE_ORDER: Record<PediatricTone, number> = {
    critical: 4, warning: 3, high: 2, caution: 1, normal: 0,
  };
  const pedRows = isChild
    ? [...pediatric!.results]
        .sort((a, b) => TONE_ORDER[b.classification.tone] - TONE_ORDER[a.classification.tone])
        .map((r) => {
          // El rango normal en unidades reales es OMS; en Zemel el valor ya es
          // percentil, así que esa columna no aplica.
          const nr = !isZemel && pedSex && typeof r.chartX === 'number'
            ? pediatricNormalRange(r.indicator as PediatricIndicator, pedSex, r.chartX, r.chartValue)
            : null;
          return `
  <tr>
    <td class="lbl">${esc(r.indicatorLabel)}</td>
    <td class="val"><b>${esc(r.valueLabel)}</b></td>
    <td class="val">${nr ? esc(formatNormalRange(nr)) : '<i style="color:#94a3b8">—</i>'}</td>
    <td class="extra">${chip(r.classification.label, TONE_SEVERITY[r.classification.tone])}</td>
  </tr>`;
        })
        .join('')
    : '';
  const seccionPediatrica = isChild
    ? section(
        isZemel ? 'Evaluación pediátrica — cartas de Síndrome de Down (Zemel 2015)' : 'Evaluación pediátrica — patrones de crecimiento OMS',
        'dot-primary', pedRows, {
          headerCols: `<th>Indicador</th><th>Valor</th><th>${isZemel ? '' : 'Rango normal'}</th><th>Clasificación</th>`,
          before: isZemel
            ? '<p style="margin:0 0 8px;font-size:10px;line-height:1.4;color:#64748b">Cartas de crecimiento específicas para síndrome de Down (Zemel BS et al., Pediatrics 2015), de 0 a 20 años. El valor es el percentil respecto a la población con Down.</p>'
            : '<p style="margin:0 0 8px;font-size:10px;line-height:1.4;color:#64748b">Clasificación según los patrones de crecimiento de la OMS (adoptados por MINSA) por edad y sexo. El z-score expresa cuántas desviaciones estándar se aparta el niño de la mediana.</p>',
        })
    : '';

  // Curvas de crecimiento OMS con la trayectoria del niño (todo su historial),
  // marcando esta consulta en rojo. Usa patient.measurements si está disponible.
  let seccionCurvasOMS = '';
  if (isChild && pedSex && pediatric) {
    const src: AnyRecord[] = Array.isArray(patient?.measurements) && patient.measurements.length > 0
      ? patient.measurements
      : [measurement];
    const records = src.map((m) => ({
      date: m?.date || m?.created_at,
      weightKg: m?.weight,
      heightCm: m?.height,
      headCircCm: m?.perimeters?.cephalic,
      armCircCm: m?.perimeters?.arm_relaxed,
      tricepsMm: m?.skinfolds?.triceps,
      subscapularMm: m?.skinfolds?.subscapular,
    }));
    const figures = pediatric.results
      .filter((r) => typeof r.chartX === 'number' && typeof r.chartValue === 'number')
      .map((r) => {
        const traj = isZemel
          ? buildZemelTrajectory(r.indicator as ZemelPublicIndicator, pedSex, patient?.birth_date, records, consultDate)
          : buildIndicatorTrajectory(r.indicator as PediatricIndicator, pedSex, patient?.birth_date, records, consultDate);
        return traj.length > 0
          ? buildGrowthChartSVG(r.indicator as PediatricIndicator, pedSex, r.indicatorLabel, traj, isZemel ? 'zemel' : 'oms')
          : '';
      })
      .filter(Boolean);
    if (figures.length > 0) {
      seccionCurvasOMS = `
    <section class="section">
      <h2><span class="dot dot-primary"></span>${isZemel ? 'Curvas de crecimiento (Síndrome de Down · Zemel)' : 'Curvas de crecimiento OMS'}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${figures.join('')}</div>
    </section>`;
    }
  }
  return { tabla: seccionPediatrica, curvas: seccionCurvasOMS };
};
