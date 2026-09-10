import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SomatocartaSection from '@/components/patient/results/SomatocartaSection';
import { computeSomatotype } from '@/lib/anthropometry/composition';

// ─────────────────────────────────────────────────────────────────────────────
// LA SOMATOCARTA: qué forma tiene el cuerpo del paciente.
//
// 411 líneas y CERO pruebas, con el somatotipo de Heath-Carter calculado a mano
// dentro del componente. Y calculado DOS VECES en la app: aquí para la pantalla
// y en lib/anthropometry/composition para el informe impreso.
//
// Estas pruebas se escribieron ANTES de unificar las dos implementaciones, para
// poder comprobar que unificar no mueve ni un número. Por eso comparan la
// pantalla contra la librería: si alguna vez se separaran, el papel y la
// pantalla dirían cosas distintas del mismo paciente.
// ─────────────────────────────────────────────────────────────────────────────

/** Paciente con todas las medidas que pide Heath-Carter. */
const medidasCompletas = {
  weight: 70,
  height: 175,
  skinfolds: { triceps: 10, subscapular: 12, supraspinal: 8, medial_calf: 8 },
  diameters: { humerus: 7, femur: 9.5 },
  perimeters: { arm_contracted: 32, calf: 36 },
};

const pintar = (data = medidasCompletas) => render(<SomatocartaSection data={data} sex="M" />);

/** La tríada que la tarjeta pinta: "2.1 – 4.5 – 3.0". */
const triadaEnPantalla = () => {
  const texto = document.body.textContent || '';
  const m = texto.match(/(-?\d+\.\d)\s*–\s*(-?\d+\.\d)\s*–\s*(-?\d+\.\d)/);
  return m ? [m[1], m[2], m[3]].join(' – ') : null;
};

afterEach(() => cleanup());

describe('somatocarta — coincide con lo que sale en el informe impreso', () => {
  // EL CANDADO PRINCIPAL de este archivo. El somatotipo se calculaba en dos
  // sitios; mientras coincidan no se nota, pero nada los mantenía sincronizados.
  it.each([
    ['varón de referencia', medidasCompletas],
    ['más graso', { ...medidasCompletas, skinfolds: { triceps: 22, subscapular: 25, supraspinal: 20, medial_calf: 18 } }],
    ['más delgado', { ...medidasCompletas, weight: 55, skinfolds: { triceps: 5, subscapular: 6, supraspinal: 4, medial_calf: 5 } }],
    ['más corpulento', { ...medidasCompletas, weight: 95, diameters: { humerus: 8, femur: 11 }, perimeters: { arm_contracted: 38, calf: 42 } }],
    ['bajo y pesado', { ...medidasCompletas, weight: 90, height: 155 }],
  ])('%s: la pantalla dice lo mismo que la librería', (_caso, data) => {
    pintar(data);
    const enLibreria = computeSomatotype({
      weight: data.weight, height: data.height, sex: 'M',
      skinfolds: data.skinfolds, diameters: data.diameters, perimeters: data.perimeters,
    });

    expect(triadaEnPantalla()).toBe(enLibreria.triad);
    expect(document.body.textContent).toContain(enLibreria.classification);
  });
});

describe('somatocarta — los tres componentes', () => {
  // Los números concretos del paciente de referencia, para que un coeficiente
  // cambiado se note aquí y no en la consulta.
  it('el varón de referencia da su tríada exacta', () => {
    pintar();

    expect(triadaEnPantalla()).toBe('3.0 – 4.8 – 2.5');
  });

  // La mesomorfia usa los perímetros CORREGIDOS restando el pliegue de la zona.
  // Sin esa resta se estaría contando grasa como corpulencia ósea y muscular.
  it('más pliegue en el brazo = MENOS mesomorfia', () => {
    pintar();
    const flaco = triadaEnPantalla();
    cleanup();

    pintar({ ...medidasCompletas, skinfolds: { ...medidasCompletas.skinfolds, triceps: 25 } });
    const graso = triadaEnPantalla();

    const mesoFlaco = Number(flaco.split('–')[1]);
    const mesoGraso = Number(graso.split('–')[1]);
    expect(mesoGraso).toBeLessThan(mesoFlaco);
  });

  // La endomorfia es la adiposidad relativa: más pliegues, más endomorfia.
  it('más pliegues = MÁS endomorfia', () => {
    pintar();
    const flaco = Number(triadaEnPantalla().split('–')[0]);
    cleanup();

    pintar({ ...medidasCompletas, skinfolds: { triceps: 20, subscapular: 22, supraspinal: 18, medial_calf: 8 } });
    const graso = Number(triadaEnPantalla().split('–')[0]);

    expect(graso).toBeGreaterThan(flaco);
  });

  // La ectomorfia es la linealidad: a igual talla, menos peso es más ectomorfo.
  it('menos peso a la misma talla = MÁS ectomorfia', () => {
    pintar();
    const normal = Number(triadaEnPantalla().split('–')[2]);
    cleanup();

    pintar({ ...medidasCompletas, weight: 55 });
    const delgado = Number(triadaEnPantalla().split('–')[2]);

    expect(delgado).toBeGreaterThan(normal);
  });
});

describe('somatocarta — sin las medidas no inventa', () => {
  it('sin pliegues no hay endomorfia, y dice qué falta', () => {
    pintar({ ...medidasCompletas, skinfolds: {} });
    const texto = document.body.textContent || '';

    expect(texto).not.toContain('NaN');
    expect(texto).toMatch(/Endomorfia/i);
  });

  it('sin peso ni talla no revienta', () => {
    pintar({ skinfolds: {}, diameters: {}, perimeters: {} });

    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('undefined');
  });

  it('con la ficha entera vacía tampoco', () => {
    expect(() => pintar({})).not.toThrow();
    expect(document.body.textContent).not.toContain('NaN');
  });

  // El pliegue de la pantorrilla entra en la mesomorfia: sin él el perímetro
  // queda sin corregir, y darlo por bueno la subiría sin avisar (0.16 puntos
  // en un adulto medio). Por eso el indicador se declara incompleto y la ficha
  // pide justo ese pliegue, en vez de dar un número redondo que no es el suyo.
  it('sin el pliegue de pantorrilla no se da la mesomorfia, y se pide', () => {
    pintar({
      ...medidasCompletas,
      skinfolds: { triceps: 10, subscapular: 12, supraspinal: 8 },
    });
    const texto = document.body.textContent || '';

    // No hay tríada: falta uno de los tres componentes.
    expect(triadaEnPantalla()).toBeNull();
    expect(texto).toContain('pliegue de pantorrilla');
    expect(texto).not.toContain('NaN');
  });
});
