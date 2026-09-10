// El rango "normal" que se muestra en la tarjeta (Normal: 11.2 – 15.5 kg) y el
// diagnóstico salen de la misma tabla, pero el rango se REDONDEA para leerlo.
// Ese redondeo llegó a contradecir al diagnóstico: un niño de 91 cm y 15.5 kg da
// z +2.02 ("Sobrepeso") porque el límite de +2 DE son 15.478 kg, y al mostrarlo
// como "15.5" parecía estar dentro del rango. Estas pruebas fijan la regla: lo
// que se muestra nunca puede contradecir al veredicto del z-score.
import { describe, expect, it } from 'vitest';

import { evaluatePediatricIndicator, pediatricNormalRange } from '../index';

describe('pediatricNormalRange', () => {
  it('afina los decimales cuando el redondeo metería al niño dentro del rango', () => {
    const ev = evaluatePediatricIndicator('wfh', 'boys', 91, 15.5);
    expect(ev?.zScore).toBeGreaterThan(2); // se pasa: no es peso adecuado
    const nr = pediatricNormalRange('wfh', 'boys', 91, 15.5);
    expect(nr?.max).toBeLessThan(15.5);
    expect(nr?.max).toBe(15.48);
  });

  it('afina también el límite de abajo', () => {
    // −2 DE = 11.224 kg: con un decimal (11.2) un niño de 11.2 kg parecería
    // estar justo dentro, pero su z-score es menor que −2.
    const ev = evaluatePediatricIndicator('wfh', 'boys', 91, 11.2);
    expect(ev?.zScore).toBeLessThan(-2);
    const nr = pediatricNormalRange('wfh', 'boys', 91, 11.2);
    expect(nr?.min).toBeGreaterThan(11.2);
    expect(nr?.min).toBe(11.22);
  });

  it('se queda en un decimal cuando no hay conflicto', () => {
    const ev = evaluatePediatricIndicator('wfh', 'boys', 91, 13);
    expect(ev?.zScore).toBeGreaterThan(-2);
    expect(ev?.zScore).toBeLessThan(2);
    const nr = pediatricNormalRange('wfh', 'boys', 91, 13);
    expect(nr).toEqual({ min: 11.2, max: 15.5, unit: 'kg' });
  });

  it('sin medición se comporta como antes (un decimal)', () => {
    expect(pediatricNormalRange('wfh', 'boys', 91)).toEqual({ min: 11.2, max: 15.5, unit: 'kg' });
  });

  it('mantiene el tope abierto de los indicadores sin límite superior', () => {
    const nr = pediatricNormalRange('acfa', 'boys', 24, 15);
    expect(nr?.max).toBeNull();
  });
});
