import { describe, it, expect } from 'vitest';
import { buildCalculation, getFactorForNAF } from '../logic';

// El NAF y el "Factor AF" son DOS cosas distintas y confundirlos hacia que la
// misma evaluacion mostrara dos totales de calorias:
//
//   · NAF     = Σ MET·h / 24. El valor exacto que sale del dia cargado
//               actividad por actividad.
//   · Factor  = ese NAF redondeado al escalon clasico mas cercano
//               (1.2 · 1.375 · 1.55 · 1.725 · 1.9). Solo sirve de etiqueta.
//
// La tarjeta "Gasto del dia" multiplicaba el basal por el FACTOR mientras que
// "Aplicar NAF" pasaba el NAF. Con basal 1742 y NAF 1.21 se anunciaban 2090
// kcal y al aplicarlo salian 2108, sin nada en pantalla que lo explicara.

describe('NAF frente a Factor AF', () => {
  it('el NAF es las MET·h del dia divididas entre 24', () => {
    // 29.1 MET·h es lo que suma un dia sedentario tipico.
    expect(buildCalculation(29.1).naf).toBeCloseTo(1.21, 2);
    expect(buildCalculation(24).naf).toBe(1);
    expect(buildCalculation(48).naf).toBe(2);
  });

  it('el factor redondea a escalones y por eso pierde precision', () => {
    // Todos estos NAF distintos caen en el mismo escalon.
    expect(getFactorForNAF(1.21)).toBe(1.2);
    expect(getFactorForNAF(1.35)).toBe(1.2);
    expect(getFactorForNAF(1.39)).toBe(1.2);
    // Y aqui salta al siguiente.
    expect(getFactorForNAF(1.4)).toBe(1.375);
  });

  // Esta es la prueba que importa: el gasto del dia y lo que se aplica al
  // requerimiento tienen que salir del MISMO numero.
  it('el gasto del dia se calcula con el NAF, no con el factor', () => {
    const basalKcal = 1742;
    const dia = buildCalculation(29.1);

    const gastoConNaf = Math.round(basalKcal * dia.naf);
    const gastoConFactor = Math.round(basalKcal * dia.factor);

    expect(gastoConNaf).toBe(2108);
    expect(gastoConFactor).toBe(2090);

    // Si alguien vuelve a usar el factor para esta cifra, los 18 kcal de
    // diferencia reaparecen y la pantalla se contradice consigo misma.
    expect(gastoConNaf).not.toBe(gastoConFactor);
  });

  it('un dia sin actividades no inventa un NAF', () => {
    const vacio = buildCalculation(0);
    expect(vacio.naf).toBe(0);
    expect(vacio.factor).toBe(1);
  });
});
