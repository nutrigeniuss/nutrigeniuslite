import { describe, expect, it } from 'vitest';

import { isMacroSplitValid, macroTotalPct, normalizeMacroSplit } from '../logic';
import type { MacroState } from '../types';

// El reparto de macronutrientes decide los GRAMOS que se recetan, así que un
// reparto que no suma 100 produce un plan con más (o menos) comida de la que el
// objetivo calórico pedía. En la revisión del 14-08-2026 había 5 de 27 pacientes
// con el dato mal guardado —uno en 174 %— porque la pantalla solo avisaba y
// además autoguardaba al salir.
//
// Estas pruebas fijan las dos mitades del arreglo: saber cuándo está mal, y
// saber arreglarlo sin cambiar lo que el profesional quiso.

const split = (carbs: number, protein: number, fat: number): MacroState => ({
  carbs: { pct: carbs, gkg: null },
  protein: { pct: protein, gkg: null },
  fat: { pct: fat, gkg: null },
}) as MacroState;

const pcts = (state: MacroState): number[] => [state.carbs.pct, state.protein.pct, state.fat.pct];

describe('macroTotalPct', () => {
  it('suma los tres macronutrientes', () => {
    expect(macroTotalPct(split(50, 20, 30))).toBe(100);
  });

  it('trata los valores que faltan como cero en vez de dar NaN', () => {
    const roto = { carbs: { pct: 50 }, protein: {}, fat: { pct: 30 } } as unknown as MacroState;
    expect(macroTotalPct(roto)).toBe(80);
  });
});

describe('isMacroSplitValid', () => {
  it('acepta el reparto que suma 100', () => {
    expect(isMacroSplitValid(split(50, 20, 30))).toBe(true);
  });

  // Los cinco casos son los que estaban REALMENTE guardados en producción.
  it.each([
    ['104 %', 50, 24, 30],
    ['132 %', 82, 20, 30],
    ['174 %', 50, 94, 30],
    ['68 %', 28, 16, 24],
    ['89 %', 25, 33, 31],
  ])('rechaza el caso real de %s', (_etiqueta, carbs, protein, fat) => {
    expect(isMacroSplitValid(split(carbs, protein, fat))).toBe(false);
  });
});

describe('normalizeMacroSplit', () => {
  it('deja intacto lo que ya suma 100', () => {
    expect(pcts(normalizeMacroSplit(split(50, 20, 30)))).toEqual([50, 20, 30]);
  });

  it('el resultado SIEMPRE suma 100 exacto, no 99 ni 101', () => {
    // Si no sumara 100 exacto, el guardado seguiría bloqueado después de pulsar
    // el botón que promete arreglarlo.
    const casos: Array<[number, number, number]> = [
      [50, 24, 30], [82, 20, 30], [50, 94, 30], [28, 16, 24], [25, 33, 31],
      [1, 1, 1], [33, 33, 33], [70, 15, 16], [10, 10, 5],
    ];
    for (const caso of casos) {
      const resultado = normalizeMacroSplit(split(...caso));
      expect(macroTotalPct(resultado)).toBe(100);
      expect(isMacroSplitValid(resultado)).toBe(true);
    }
  });

  it('mantiene la proporción que eligió el profesional', () => {
    // 28/16/24 suma 68: al escalar, los carbohidratos siguen siendo los que más
    // pesan y las proteínas las que menos.
    const [carbs, protein, fat] = pcts(normalizeMacroSplit(split(28, 16, 24)));
    expect(carbs).toBeGreaterThan(fat);
    expect(fat).toBeGreaterThan(protein);
  });

  it('reparte proporcionalmente un caso que se pasa del 100', () => {
    // 50/94/30 = 174. Escalado: 29/54/17.
    expect(pcts(normalizeMacroSplit(split(50, 94, 30)))).toEqual([29, 54, 17]);
  });

  it('con los tres a cero vuelve al reparto por defecto en vez de dividir entre cero', () => {
    expect(pcts(normalizeMacroSplit(split(0, 0, 0)))).toEqual([50, 20, 30]);
  });

  it('nunca deja un porcentaje negativo', () => {
    for (const caso of [[100, 1, 1], [1, 100, 1], [99, 99, 1]] as Array<[number, number, number]>) {
      for (const valor of pcts(normalizeMacroSplit(split(...caso)))) {
        expect(valor).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
