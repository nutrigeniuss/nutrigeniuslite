// Sección "Evaluación de la gestante" del informe de consulta.
//
// En gestación esta sección REEMPLAZA a todo el bloque de adulto (peso ideal,
// riesgo cardiometabólico, pliegues, composición y somatocarta), igual que en
// pantalla: esos indicadores están validados en población NO gestante, y con la
// expansión de volumen del embarazo darían lecturas engañosas. El requerimiento
// calórico sí se conserva, porque ese sí aplica.
//
// Vive aparte de `index.ts` por el mismo motivo que `somatotype.ts`: son 80
// líneas con su propia lógica clínica, y dentro del generador sólo sumaban
// ruido a una función que ya era la más compleja del repositorio.
import {
  activePregnancy,
  assessGestation,
  formatGestationalAge,
  gestationalAgeAt,
} from '@/lib/gestation/gestationalGain';
import { buildGainChartSVG } from '@/lib/gestation/gainChartSvg';
import { type AnyRecord, chip, esc, row, rowHtml, section, v } from './format';

type Embarazo = NonNullable<ReturnType<typeof activePregnancy>>;
type EdadGestacional = NonNullable<ReturnType<typeof gestationalAgeAt>>;

type EntradaGestante = {
  patient: AnyRecord;
  pregnancy: Embarazo;
  gestAge: EdadGestacional;
  /** Peso y talla de ESTA consulta, tal como llegan de la medición. */
  weight: unknown;
  height: unknown;
};

export function buildGestationSection({ patient, pregnancy, gestAge, weight: w, height: h }: EntradaGestante): string {

  const gest = assessGestation({
    prePregnancyKg: pregnancy.prePregnancyKg,
    currentWeightKg: v(w) ? Number(w) : null,
    heightCm: v(h) ? Number(h) : null,
    week: gestAge.weeks,
    type: pregnancy.type || 'single',
  });

  const chipHtml = gest.diagnosis ? chip(gest.diagnosis, gest.severity) : '';
  const rows = [
    rowHtml('Edad gestacional', `<b>${esc(formatGestationalAge(gestAge))}</b>`, `<span class="lbl-mini">por ${gestAge.source === 'fum' ? 'FUM' : 'ecografía'}</span>`),
    row('Peso pregestacional', pregnancy.prePregnancyKg ?? null, 'kg'),
    gest.bmi !== null
      ? rowHtml('IMC pregestacional', `<b>${gest.bmi.toFixed(2)}</b>`, chip(gest.categoryLabel || '', 'info'))
      : '',
    gest.gainKg !== null
      ? rowHtml('Ganancia de peso', `<b>${gest.gainKg > 0 ? '+' : ''}${gest.gainKg} kg</b>`, chipHtml)
      : '',
    gest.range
      ? rowHtml('Ganancia esperada', `${gest.range.min} – ${gest.range.max} kg`, `<span class="lbl-mini">semana ${gest.week}</span>`)
      : '',
    gest.recommendedWeight
      ? rowHtml('Peso recomendado', `<b>${gest.recommendedWeight.min} – ${gest.recommendedWeight.max} kg</b>`, '')
      : '',
  ].join('');

  const notes = [...gest.notes, ...(gest.missing.length > 0 ? [`Falta registrar: ${gest.missing.join(', ')}.`] : [])];
  const notesHtml = notes.length > 0
    ? `<p class="lbl-mini" style="margin-top:8px">${notes.map((note) => esc(note)).join(' ')}</p>`
    : '';

  // Misma curva que la pantalla: comparten el generador de SVG.
  const points = (Array.isArray(patient?.measurements) ? patient.measurements : [])
    .filter((m: AnyRecord) => m?.date && m?.weight != null)
    .sort((a: AnyRecord, b: AnyRecord) => String(a.date).localeCompare(String(b.date)))
    .map((m: AnyRecord) => {
      const rowAge = gestationalAgeAt(pregnancy, m.date);
      if (!rowAge) return null;
      const rowAssessment = assessGestation({
        prePregnancyKg: pregnancy.prePregnancyKg,
        currentWeightKg: m.weight,
        heightCm: m.height,
        week: rowAge.weeks,
        type: pregnancy.type || 'single',
      });
      if (rowAssessment.gainKg === null) return null;
      return {
        week: rowAge.weeks,
        gainKg: rowAssessment.gainKg,
        date: m.date as string,
        weightKg: m.weight as number,
        diagnosis: rowAssessment.diagnosis,
        severity: rowAssessment.severity,
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null);

  const curva = gest.category && points.length >= 2
    ? `<div class="gain-chart">${buildGainChartSVG({
        category: gest.category,
        type: pregnancy.type || 'single',
        points,
        highlightWeek: gestAge.weeks,
        width: 620,
        height: 240,
      })}</div>
      <p class="lbl-mini" style="margin-top:6px">Kg ganados sobre el peso pregestacional por semana de gestación. La franja verde es el rango recomendado.</p>`
    : '';

  return section('Evaluación de la gestante', 'dot-red', rows, {
    before: `${notesHtml}`,
  }) + (curva ? `<section class="section">${curva}</section>` : '');
}
