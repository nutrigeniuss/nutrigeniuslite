import { describe, expect, it } from 'vitest';

import { buildHtml } from '@/lib/anthropometry/printReport';

// ─────────────────────────────────────────────────────────────────────────────────
// QUÉ SECCIONES LLEVA EL INFORME DE CADA TIPO DE PACIENTE.
//
// El fallo que esto vigila no es un número mal calculado: es una SECCIÓN QUE
// DESAPARECE. Ya pasó con el índice cintura-talla, que se esfumó del informe y
// de la pantalla sin que nada fallara, porque una etiqueta de texto se usaba de
// clave. La hoja sale más corta y nadie la revisa contra la pantalla.
//
// Estas pruebas nacieron al partir `buildHtml` en ocho módulos: durante el
// refactor la red fue comparar el HTML byte a byte contra la versión anterior,
// pero eso no se puede dejar puesto (obligaría a regenerar 130 KB de ficheros
// cada vez que el informe cambie a propósito). Lo que SÍ queda puesto es esto:
// qué secciones le corresponden a cada perfil.
//
// Las TRES RAMAS del informe son excluyentes y ese es el punto clínico:
//   · gestante  → reemplaza el informe de adulto entero
//   · niño      → z-scores de la OMS, nunca fórmulas de adulto
//   · adulto    → peso ideal, composición y somatotipo
// ─────────────────────────────────────────────────────────────────────────────────

const skinfolds = {
  biceps: 5, triceps: 14, subscapular: 12, iliac_crest: 16,
  supraspinal: 9, abdominal: 18, front_thigh: 20, medial_calf: 12,
};
const diameters = {
  wrist_bistyloid: 5, femur: 8.8, humerus: 6.2, biacromial: 36,
  biiliocrestal: 26, thorax_anteroposterior: 17, thorax_transverse: 25,
};
const perimeters = {
  waist: 78, hip: 98, arm_relaxed: 27, arm_flexed: 29, arm_contracted: 29, forearm: 24,
  thigh_mid: 52, calf: 34, cephalic: 55, mesosternal: 82, wrist: 15,
  abdominal_per: 84,
};

const completa = {
  date: '2026-03-15', weight: 62, height: 160, height_sitting: 84,
  skinfolds, diameters, perimeters,
  requirement: {
    target_calories: 1850, macro_pct_carbs: 50, macro_pct_protein: 20,
    macro_pct_fat: 30, selected_formula: 'Mifflin-St Jeor', activity_level: 'Ligera',
  },
};

const perfiles: Record<string, { patient: Record<string, unknown>; measurement: Record<string, unknown> }> = {
  'adulta-completa': {
    patient: { name: 'Ana', last_name: 'Quispe', gender: 'Femenino', birth_date: '1990-03-15' },
    measurement: completa,
  },
  'varon-obesidad': {
    patient: { name: 'Luis', last_name: 'Mamani', gender: 'Masculino', birth_date: '1975-06-01' },
    measurement: { ...completa, weight: 105, height: 168 },
  },
  'adulto-mayor': {
    patient: { name: 'Rosa', last_name: 'Flores', gender: 'Femenino', birth_date: '1955-02-20' },
    measurement: completa,
  },
  'nina-8-anios': {
    patient: { name: 'Sofía', last_name: 'Ríos', gender: 'Femenino', birth_date: '2018-03-15' },
    measurement: { date: '2026-03-15', weight: 25, height: 128, perimeters, skinfolds },
  },
  'gestante': {
    patient: {
      name: 'Carmen', last_name: 'Vega', gender: 'Femenino', birth_date: '1995-09-10',
      pregnancies: [{ id: 'g1', status: 'active', fum: '2025-11-01', prePregnancyKg: 58, type: 'single' }],
    },
    measurement: completa,
  },
  'sin-datos': {
    patient: { name: 'Sin', last_name: 'Datos' },
    measurement: { date: '2026-03-15' },
  },
  'medidas-parciales': {
    patient: { name: 'Parcial', last_name: 'Datos', gender: 'Masculino', birth_date: '1988-01-01' },
    measurement: { date: '2026-03-15', weight: 80, height: 175, perimeters: { waist: 92 } },
  },
};

/** Los títulos de sección que trae un informe, en orden. */
const seccionesDe = (html: string): string[] =>
  (html.match(/<h2><span[^>]*><\/span>[^<]*/g) || [])
    .map((h) => h.replace(/.*<\/span>/, '').trim());

const informe = (clave: keyof typeof perfiles): string =>
  buildHtml(perfiles[clave] as never);

describe('el informe de un adulto lleva sus nueve secciones', () => {
  it('con todas las medidas no falta ninguna', () => {
    expect(seccionesDe(informe('adulta-completa'))).toEqual([
      'Estado general y peso ideal',
      'Riesgo y derivados de perímetros',
      'Derivados de pliegues',
      'Composición corporal',
      'Composición corporal — 4 componentes',
      'Composición corporal — 5 componentes (Kerr 1988 · Phantom)',
      'Somatotipo clínico',
      'Requerimiento calórico',
    ]);
  });

  it('un varón con obesidad lleva las mismas', () => {
    expect(seccionesDe(informe('varon-obesidad'))).toEqual(seccionesDe(informe('adulta-completa')));
  });

  it('un adulto mayor también', () => {
    expect(seccionesDe(informe('adulto-mayor'))).toEqual(seccionesDe(informe('adulta-completa')));
  });

  // Con media ficha se cae lo que no se puede calcular, pero NO lo que sí.
  // Una sección vacía es ruido; una que falta habiendo datos es un fallo.
  it('con medidas parciales quedan solo las que se pueden calcular', () => {
    expect(seccionesDe(informe('medidas-parciales'))).toEqual([
      'Estado general y peso ideal',
      'Riesgo y derivados de perímetros',
      'Composición corporal — 4 componentes',
    ]);
  });

  it('sin ninguna medida no se imprime ninguna sección', () => {
    expect(seccionesDe(informe('sin-datos'))).toEqual([]);
  });
});

describe('a un niño NO se le aplican fórmulas de adulto', () => {
  // El peso ideal, la composición corporal y el somatotipo no están validados
  // en la infancia. Un número de adulto puesto sobre un niño es peor que
  // ningún número.
  it('lleva z-scores de la OMS y sus curvas, y nada más', () => {
    expect(seccionesDe(informe('nina-8-anios'))).toEqual([
      'Evaluación pediátrica — patrones de crecimiento OMS',
      'Curvas de crecimiento OMS',
    ]);
  });
});

describe('la gestante reemplaza el informe de adulto', () => {
  // Los indicadores de adulto no están validados en embarazo: se sustituyen
  // por la evaluación de ganancia de peso gestacional.
  it('lleva su evaluación y el requerimiento, no el bloque de adulto', () => {
    const secciones = seccionesDe(informe('gestante'));

    expect(secciones).toContain('Evaluación de la gestante');
    expect(secciones).not.toContain('Estado general y peso ideal');
    expect(secciones).not.toContain('Composición corporal — 5 componentes (Kerr 1988 · Phantom)');
  });

  // El requerimiento calórico SÍ se mantiene: una gestante come, y es
  // justamente lo que hay que ajustar.
  it('el requerimiento calórico se mantiene', () => {
    expect(seccionesDe(informe('gestante'))).toContain('Requerimiento calórico');
  });
});

describe('ningún informe imprime basura', () => {
  it.each(Object.keys(perfiles))('%s sale sin NaN ni undefined', (clave) => {
    const html = informe(clave as keyof typeof perfiles);

    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('[object Object]');
  });
});
