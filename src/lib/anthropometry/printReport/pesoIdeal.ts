// La primera sección del informe: el estado general y las cuatro fórmulas de
// peso ideal.
//
// SE VALORA CON EL PORCENTAJE DE PESO IDEAL, el mismo criterio que la pantalla
// de resultados. Tiene que ser el mismo: este informe se le entrega al paciente,
// y que el papel y la pantalla dijeran cosas distintas del mismo dato es de las
// cosas que hacen perder la confianza en la herramienta.
//
// El cuerpo se movió TAL CUAL, con su indentación original: lo que hay dentro
// de las plantillas es el HTML que se imprime, y reindentarlo lo cambiaría.
import { imcObjetivoPara, imcSaludablePara, percentIdealWeight } from '../indicators';
import type { IndicatorResult } from '../types';
import { chip, esc, fmtNum, rowHtml, v } from './format';

/** Una fórmula de peso ideal puede dar un valor o un rango (complexión). */
type ResultadoPesoIdeal = IndicatorResult<number> & {
  range?: { min: number; max: number };
  classification?: string;
};

type Entrada = {
  /** Peso actual del paciente. Sin él no hay nada contra qué comparar. */
  w: number | null;
  ageYears: number | null;
  bmi: IndicatorResult<number> & { classification?: string; severity?: string };
  west: ResultadoPesoIdeal;
  hamwi: ResultadoPesoIdeal;
  byBmi: ResultadoPesoIdeal;
  byComplex: ResultadoPesoIdeal;
  frame: { classification?: string | null };
  range: { min: IndicatorResult<number>; max: IndicatorResult<number> };
  corrected: IndicatorResult<number> & { detail?: string };
};

/** Estado general y peso ideal. Cadena vacía si no hay nada que mostrar. */
export const buildIdealWeightSection = ({
  w, ageYears, bmi, west, hamwi, byBmi, byComplex, frame, range, corrected,
}: Entrada): string => {
  // ── Sección: Estado general y peso ideal ──
  // Se valora con el PORCENTAJE DE PESO IDEAL, el mismo criterio que la
  // pantalla de resultados. Tiene que ser el mismo: este informe se le entrega
  // al paciente, y que el papel y la pantalla dijeran cosas distintas del mismo
  // dato es de las cosas que hacen perder la confianza en la herramienta.
  //
  // Antes se marcaba "Adecuado" con ±3 kg de tolerancia, un número que no salía
  // de ninguna guía. Ver percentIdealWeight() para el detalle.
  const SEVERIDAD_PI: Record<string, string> = {
    normal: 'good',
    sobrepeso: 'warn',
    desnutricion_leve: 'warn',
    obesidad: 'bad',
    desnutricion_moderada: 'bad',
    desnutricion_severa: 'bad',
  };

  const diagFromIdeal = (res: any): { label: string; severity: string } | null => {
    if (!v(w)) return null;
    const val = res.value;
    const range = res.range;

    // Las fórmulas por complexión dan un rango: ahí la referencia es el propio
    // rango y un porcentaje contra su punto medio se inventaría precisión.
    if (range) {
      // `v(w)` de arriba ya garantizó que hay peso; el compilador no lo deduce
      // porque no es un type guard. La comparación es la misma de siempre.
      const peso = w as number;
      const inside = peso >= range.min && peso <= range.max;
      if (inside) return { label: 'Dentro del rango', severity: 'good' };
      return peso < range.min
        ? { label: 'Por debajo', severity: 'warn' }
        : { label: 'Por encima', severity: 'bad' };
    }

    if (val == null) return null;

    const pi = percentIdealWeight(w, val);
    if (pi.value == null) return null;

    return {
      label: `${pi.value} % · ${pi.label}`,
      severity: SEVERIDAD_PI[pi.category ?? ''] ?? 'info',
    };
  };

  const pesoIdealRows = [
    { name: 'West', res: west },
    { name: 'Hamwi', res: hamwi },
    // El número del rótulo sale de la MISMA fuente que el cálculo (ver
    // imcObjetivoPara): si se copiara aquí, el papel podría decir un IMC y
    // calcular con otro.
    { name: `IMC objetivo (${imcObjetivoPara(ageYears)})`, res: byBmi },
    { name: `Complexión ${frame.classification?.toLowerCase() || ''}`.trim(), res: byComplex },
  ]
    .map(({ name, res }) => {
      // "Tablas no disponibles" se incluye porque ES una clasificación válida
      // (no es "falta dato"; es información diagnóstica para el nutricionista).
      if ((res as any).classification === 'Tablas no disponibles') {
        return rowHtml(name, '<i style="color:#94a3b8">Tablas no disponibles</i>');
      }
      const r = (res as any).range;
      const dx = diagFromIdeal(res);
      // Sin valor calculado o sin posibilidad de clasificar → omitir fila.
      if (!dx) return '';
      if (r) return rowHtml(name, `<b>${r.min}–${r.max}</b> kg`, chip(dx.label, dx.severity));
      if (res.value != null) return rowHtml(name, `<b>${res.value}</b> kg`, chip(dx.label, dx.severity));
      return '';
    })
    .join('');

  // Hero superior: solo se renderizan los bloques que tengan valor.
  const heroBlocks: string[] = [];
  if (bmi.value != null) {
    heroBlocks.push(`
      <div>
        <div class="hero-lbl">IMC actual</div>
        <div class="hero-val">${fmtNum(bmi.value, 1)} <span class="unit">kg/m²</span></div>
        ${chip(bmi.classification, bmi.severity)}
      </div>`);
  }
  if (range.min.value != null && range.max.value != null) {
    heroBlocks.push(`
      <div>
        <div class="hero-lbl">Rango saludable (IMC ${imcSaludablePara(ageYears).min}–${imcSaludablePara(ageYears).max})</div>
        <div class="hero-val-sm">${fmtNum(range.min.value, 1)} – ${fmtNum(range.max.value, 1)} <span class="unit">kg</span></div>
      </div>`);
  }
  if (corrected.value != null) {
    heroBlocks.push(`
      <div>
        <div class="hero-lbl">Peso corregido (obesidad)</div>
        <div class="hero-val-sm" style="color:#3b5feb">${fmtNum(corrected.value, 2)} <span class="unit">kg</span></div>
        <div class="hero-detail">${esc(corrected.detail || '')}</div>
      </div>`);
  }

  const seccion1 = (heroBlocks.length || pesoIdealRows.trim())
    ? `
    <section class="section">
      <h2><span class="dot dot-primary"></span>Estado general y peso ideal</h2>
      ${heroBlocks.length ? `<div class="hero">${heroBlocks.join('')}</div>` : ''}
      ${pesoIdealRows.trim()
        ? `<table class="data-table">
            <thead><tr><th>Fórmula</th><th>Valor</th><th></th></tr></thead>
            <tbody>${pesoIdealRows}</tbody>
          </table>`
        : ''}
    </section>`
    : '';

  // El informe se entrega en mano y no lleva a nadie al lado que lo explique:
  // si el juicio salió de la franja etaria de al lado (pliegues y AMB llegan a
  // los 74.9 años, el brazo a los 79.9), tiene que decirlo el papel.
  return seccion1;
};
