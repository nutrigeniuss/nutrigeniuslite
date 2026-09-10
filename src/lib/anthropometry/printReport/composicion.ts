// Las cuatro secciones que reparten el cuerpo del paciente: el porcentaje de
// grasa, el modelo clásico de 4 componentes, el fraccionamiento de 5 de Kerr y
// el somatotipo.
//
// Van juntas porque comparten el MISMO input de cálculo. Y ese input lleva la
// fórmula de grasa que el nutricionista tiene puesta en pantalla: si el PDF
// saliera siempre con Siri, estaría entregando al paciente unos números que el
// profesional no ha visto y no puede defender.
//
// Los cálculos NO están aquí: vienen de lib/anthropometry/composition, que es
// la única implementación y la que usa también la tarjeta de la pantalla.
//
// El cuerpo se movió TAL CUAL, con su indentación original: lo que hay dentro
// de las plantillas es el HTML que se imprime, y reindentarlo lo cambiaría.
import { compute4Components, compute5Components, computeSomatotype } from '../composition';
import { ageInMonths } from '../pediatric';
import type { IndicatorResult, Sex } from '../types';
import { leerFormulaGrasa } from '@/hooks/useFormulaGrasa';
import { type AnyRecord, chip, esc, fmtNum } from './format';
import { buildSomatotypeSection } from './somatotype';

type Entrada = {
  patient: AnyRecord;
  measurement: AnyRecord;
  consultDate: string | null;
  sex: Sex | null;
  ageYears: number | null;
  w: number | null;
  h: number | null;
  skin: AnyRecord;
  peri: AnyRecord;
  /** El % de grasa ya calculado con la fórmula de Derivados de Pliegues. */
  fat: IndicatorResult<number> & { detail?: string };
  fatDx: { classification?: string; severity?: string };
  fatMass: number | null;
  leanMass: number | null;
  /** Nombre largo del autor, para citarlo bajo el porcentaje. */
  autorGrasa: string;
};

/** Las cuatro secciones. Vacía la que no se pudo calcular. */
export const buildCompositionSections = ({
  patient, measurement, consultDate, sex, ageYears, w, h, skin, peri,
  fat, fatDx, fatMass, leanMass, autorGrasa,
}: Entrada): { porcentajeGrasa: string; cuatro: string; cinco: string; somatotipo: string } => {
  // ── Sección: Composición corporal (% grasa Durnin-Siri + Gallagher) ──
  // Se cita la fórmula bajo el porcentaje: el informe se entrega al paciente y
  // puede acabar en manos de otro profesional, que necesita saber con qué se
  // calculó para poder compararlo o discutirlo.
  const composicionHero: string[] = [];
  if (fat.value != null && fatDx.classification) {
    composicionHero.push(`
      <div>
        <div class="hero-lbl">% Grasa corporal</div>
        <div class="hero-val">${fmtNum(fat.value, 1)} <span class="unit">%</span></div>
        ${chip(fatDx.classification, fatDx.severity)}
        <div class="hero-detail">${esc(autorGrasa)}${fat.detail ? ` · ${esc(fat.detail)}` : ''}</div>
      </div>`);
  }
  if (fatMass != null) {
    composicionHero.push(`
      <div>
        <div class="hero-lbl">Masa grasa</div>
        <div class="hero-val-sm">${fmtNum(fatMass, 2)} <span class="unit">kg</span></div>
      </div>`);
  }
  if (leanMass != null) {
    composicionHero.push(`
      <div>
        <div class="hero-lbl">Masa magra (MLG)</div>
        <div class="hero-val-sm" style="color:#3b5feb">${fmtNum(leanMass, 2)} <span class="unit">kg</span></div>
      </div>`);
  }

  const seccion3 = composicionHero.length
    ? `
    <section class="section">
      <h2><span class="dot dot-amber"></span>Composición corporal</h2>
      <div class="hero">${composicionHero.join('')}</div>
    </section>`
    : '';

  // ── Sección: Composición corporal por 4 y 5 componentes ──
  // Solo se incluyen las filas con masa calculada. Si ningún componente del
  // modelo se pudo calcular, la sección entera se omite.
  // Edad en la FECHA de la consulta (no la actual), que es la relevante para las
  // fórmulas de composición dependientes de edad (Durnin/Siri).
  const ageAtConsultMonths = ageInMonths(patient?.birth_date, consultDate);
  const compAgeYears = ageAtConsultMonths != null ? ageAtConsultMonths / 12 : ageYears;
  const compInput = {
    weight: w, height: h, height_sitting: measurement?.height_sitting,
    sex, ageYears: compAgeYears,
    skinfolds: skin, diameters: measurement?.diameters || {}, perimeters: peri,
    // La MISMA formula que el nutricionista tiene puesta en pantalla. Si el PDF
    // saliera siempre con Siri, estaria entregando al paciente unos numeros que
    // el profesional no ha visto y no puede defender.
    formulaGrasa: leerFormulaGrasa('composicion'),
  };
  const four = compute4Components(compInput);
  const five = compute5Components(compInput);

  // Paleta consistente con la UI (cyan, blue, slate, lime para 4-comp;
  // blue, yellow, orange, red, slate para 5-comp Kerr).
  const COLORS_4 = ['#22d3ee', '#60a5fa', '#334155', '#84cc16'];
  const COLORS_5 = ['#60a5fa', '#fde047', '#fb923c', '#f87171', '#94a3b8'];

  // SE INCLUYEN TODOS LOS COMPONENTES, tambien los que no se pudieron calcular.
  // Antes se filtraban los que daban null y el informe salia con dos filas de
  // cuatro, sin decir nada: quien lo leia no sabia si ese componente no aplicaba
  // o si faltaba una medida por tomar. Ahora la fila aparece con un guion y
  // debajo, en pequeno, que medida falta.
  const four4Rows = four.rows
    .map((r, i) => `
      <tr>
        <td class="lbl">
          <span class="bullet" style="background:${COLORS_4[i] || '#94a3b8'}"></span>
          ${esc(r.name)}
          ${r.autor ? `<span class="extra"> · ${esc(r.autor)}</span>` : ''}
          ${r.kg === null && r.missing?.length
            ? `<div class="extra">Falta: ${esc(r.missing.join(', '))}</div>`
            : ''}
        </td>
        <td class="val">${r.kg !== null ? `${fmtNum(r.kg, 2)} kg` : '—'}</td>
        <td class="extra">${r.pct != null ? `<b>${fmtNum(r.pct, 1)}%</b>` : '—'}</td>
      </tr>`)
    .join('');
  // La seccion se muestra si al menos uno salio; si no salio ninguno, no hay
  // nada que informar y solo aportaria ruido.
  const seccion4comp = four.rows.some((r) => r.kg !== null)
    ? `
    <section class="section">
      <h2><span class="dot dot-primary"></span>Composición corporal — 4 componentes</h2>
      <table class="data-table">
        <thead><tr><th>Componente</th><th>Kilogramos</th><th>%</th></tr></thead>
        <tbody>${four4Rows}</tbody>
      </table>
    </section>`
    : '';

  // 5-componentes — solo si el modelo está completo (peso predictivo definido).
  const five5Rows = five.rows
    .filter(r => r.kgAdj !== null)
    .map((r) => `
      <tr>
        <td class="lbl">
          <span class="bullet" style="background:${COLORS_5[five.rows.indexOf(r)] || '#94a3b8'}"></span>
          ${esc(r.name)}
        </td>
        <td class="val">${fmtNum(r.kgAdj, 2)} kg</td>
        <td class="extra">${r.pct != null ? `<b>${fmtNum(r.pct, 1)}%</b>` : ''}</td>
      </tr>`)
    .join('');
  const seccion5comp = five.pesoPredictivo !== null
    ? `
    <section class="section">
      <h2><span class="dot dot-red"></span>Composición corporal — 5 componentes (Kerr 1988 · Phantom)</h2>
      <table class="data-table">
        <thead><tr><th>Componente</th><th>Kg ajustado</th><th>%</th></tr></thead>
        <tbody>${five5Rows}</tbody>
      </table>
      <div class="kerr-meta kerr-meta--solo">
        <div><span class="lbl-mini">Peso real</span><b>${fmtNum(w, 1)} kg</b></div>
      </div>
    </section>`
    : '';

  // ── Sección: Somatotipo (Heath-Carter) con somatocarta SVG ──
  const soma = computeSomatotype(compInput);
  // Solo se incluye si los 3 componentes están calculados.
  const seccionSoma = (soma.endo !== null && soma.meso !== null && soma.ecto !== null)
    ? buildSomatotypeSection(soma)
    : '';
  return {
    porcentajeGrasa: seccion3,
    cuatro: seccion4comp,
    cinco: seccion5comp,
    somatotipo: seccionSoma,
  };
};
