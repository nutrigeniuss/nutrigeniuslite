// Dos secciones que se leen juntas: el riesgo cardiometabólico que sale de los
// perímetros, y los diagnósticos de los pliegues individuales.
//
// Comparten `chipConTabla`, que es el detalle que las une: el informe se
// entrega en mano y no lleva a nadie al lado que lo explique, así que cuando un
// juicio salió de la franja etaria de al lado —los pliegues y el AMB llegan a
// los 74.9 años, el brazo a los 79.9— tiene que decirlo el papel.
//
// El cuerpo se movió TAL CUAL, con su indentación original: lo que hay dentro
// de las plantillas es el HTML que se imprime, y reindentarlo lo cambiaría.
import { cmbCriterionApplies } from '../indicators';
import type { IndicatorResult } from '../types';
import { type AnyRecord, chip, esc, fmtNum, rowHtml, section, v } from './format';

/** Un indicador con su clasificación y, si aplica, el aviso de tabla vecina. */
type Diagnostico = {
  classification?: string;
  severity?: string;
  detail?: string;
  outOfTable?: boolean;
};

type Entrada = {
  peri: AnyRecord;
  skin: AnyRecord;
  ageYears: number | null;
  whr: IndicatorResult<number> & Diagnostico;
  whtr: IndicatorResult<number> & Diagnostico;
  amb: IndicatorResult<number>;
  ambDx: Diagnostico;
  armDx: Diagnostico;
  cmb: IndicatorResult<number>;
  cmbDx: Diagnostico;
  wRisk: Diagnostico;
  triDx: Diagnostico;
  subDx: Diagnostico;
  triSubDx: Diagnostico;
  triSubSum: number | null;
};

/** Devuelve las dos secciones. Vacías las que no tengan ninguna fila. */
export const buildPerimeterAndSkinfoldSections = ({
  peri, skin, ageYears, whr, whtr, amb, ambDx, armDx, cmb, cmbDx, wRisk,
  triDx, subDx, triSubDx, triSubSum,
}: Entrada): { perimetros: string; pliegues: string } => {
  const chipConTabla = (dx: { classification?: string; severity?: string; detail?: string; outOfTable?: boolean }) =>
    chip(dx.classification, dx.severity as Parameters<typeof chip>[1])
    + (dx.outOfTable && dx.detail ? `<div class="lbl-mini">${esc(dx.detail)}</div>` : '');

  // ── Sección: Riesgo y derivados de perímetros (espejo de Resultados) ──
  // Cada `row` se autoexcluye si el valor es null. Solo se incluyen los
  // indicadores que tienen valor calculado Y clasificación diagnóstica.
  const riesgoRows = [
    rowHtml('Índice Cintura-Cadera (ICC)',
      whr.value != null && whr.classification ? `<b>${fmtNum(whr.value, 2)}</b>` : '',
      chip(whr.classification, whr.severity)),
    rowHtml('Índice Cintura-Talla (ICT)',
      whtr.value != null && whtr.classification ? `<b>${fmtNum(whtr.value, 2)}</b>` : '',
      chip(whtr.classification, whtr.severity)),
    rowHtml('Área Muscular del Brazo (AMB)',
      amb.value != null && ambDx.classification ? `<b>${fmtNum(amb.value, 2)}</b> cm²` : '',
      chipConTabla(ambDx)),
    // El tercil no dice nada suelto: en un papel que se entrega en mano tiene
    // que ir con su rango y su fuente debajo (Wu 2017, 40–90 años).
    rowHtml('Circunferencia Muscular del Brazo',
      cmb.value != null && cmbCriterionApplies(ageYears) ? `<b>${fmtNum(cmb.value, 2)}</b> cm` : '',
      chip(cmbDx.classification, cmbDx.severity)
      + (cmbDx.detail ? `<div class="lbl-mini">${esc(cmbDx.detail)}</div>` : '')),
    rowHtml('Perímetro del brazo',
      v(peri.arm_relaxed) && armDx.classification ? `<b>${fmtNum(peri.arm_relaxed, 1)}</b> cm` : '',
      chipConTabla(armDx)),
    rowHtml('Perímetro de Cintura',
      v(peri.waist) && wRisk.classification ? `<b>${fmtNum(peri.waist, 1)}</b> cm` : '',
      chip(wRisk.classification, wRisk.severity)),
  ].join('');
  const seccion2 = section('Riesgo y derivados de perímetros', 'dot-red', riesgoRows);

  // ── Sección: Derivados de pliegues ──
  // Solo aparecen los pliegues que tienen diagnóstico Frisancho calculable
  // (TR, SE, y la suma TR+SE). Los demás pliegues son insumo para Durnin-Siri
  // y/o Kerr; no se muestran como "derivados" porque no llevan clasificación.
  const pliegues = [
    rowHtml('Pliegue Tricipital',
      v(skin.triceps) && triDx.classification ? `<b>${fmtNum(skin.triceps, 1)}</b> mm` : '',
      chipConTabla(triDx)),
    rowHtml('Pliegue Subescapular',
      v(skin.subscapular) && subDx.classification ? `<b>${fmtNum(skin.subscapular, 1)}</b> mm` : '',
      chipConTabla(subDx)),
    rowHtml('Tricipital + Subescapular',
      triSubSum != null && triSubDx.classification ? `<b>${fmtNum(triSubSum, 1)}</b> mm` : '',
      chipConTabla(triSubDx)),
  ].join('');
  const seccionPliegues = section('Derivados de pliegues', 'dot-sky', pliegues);
  return { perimetros: seccion2, pliegues: seccionPliegues };
};
