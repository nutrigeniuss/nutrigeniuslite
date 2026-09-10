import { describe, expect, it } from 'vitest';

import { calcBMI } from '../indicators/bmi';
import {
  correctedWeight,
  healthyWeightRange,
  idealWeightByBmi,
  idealWeightHamwi,
  idealWeightWest,
} from '../indicators/idealWeight';

// El IMC y el peso ideal son los dos números que más se miran de toda la ficha:
// el IMC pone la etiqueta que el paciente se lleva a casa, y del peso ideal
// salen el peso ajustado y, con él, el requerimiento calórico.
//
// No tenían prueba propia (revisión del 14-08-2026). Lo que más se cuida aquí
// son los BORDES de cada tramo, que es donde una etiqueta se convierte en la de
// al lado: un 24.99 y un 25.00 son el mismo paciente y distinta conversación.

describe('calcBMI', () => {
  it('calcula peso ÷ talla²', () => {
    // 70 / 1.75² = 22.857… → 22.86
    expect(calcBMI(70, 175)?.value).toBe(22.86);
  });

  it('dice QUÉ dato falta, no solo que falta algo', () => {
    expect(calcBMI(null, 175).missing).toEqual(['Peso']);
    expect(calcBMI(70, null).missing).toEqual(['Talla']);
    expect(calcBMI(null, null).missing).toEqual(['Peso', 'Talla']);
  });

  describe('adulto (18-59)', () => {
    // Cada par comprueba un borde: el último valor de un tramo y el primero del
    // siguiente. Peso calculado sobre 1.75 m para que el IMC caiga donde toca.
    it.each([
      [15.9, 'delgadez_g3'],
      [16, 'delgadez_g2'],
      [16.9, 'delgadez_g2'],
      [17, 'delgadez_g1'],
      [18.4, 'delgadez_g1'],
      [18.5, 'normal'],
      [24.9, 'normal'],
      [25, 'sobrepeso'],
      [29.9, 'sobrepeso'],
      [30, 'obesidad_g1'],
      [34.9, 'obesidad_g1'],
      [35, 'obesidad_g2'],
      [39.9, 'obesidad_g2'],
      [40, 'obesidad_g3'],
    ])('IMC %s → %s', (imc, categoriaEsperada) => {
      const pesoParaEseImc = imc * 1.75 ** 2;
      expect(calcBMI(pesoParaEseImc, 175, 30).category).toBe(categoriaEsperada);
    });
  });

  describe('adulto mayor (≥60) usa otros cortes', () => {
    it.each([
      [22, 'delgadez_am'],
      [23, 'delgadez_am'],   // el 23 exacto es delgadez, no normal
      [23.5, 'normal'],
      [27.9, 'normal'],
      [28, 'sobrepeso'],
      [31.9, 'sobrepeso'],
      [32, 'obesidad_am'],
    ])('IMC %s → %s', (imc, categoriaEsperada) => {
      const pesoParaEseImc = imc * 1.75 ** 2;
      expect(calcBMI(pesoParaEseImc, 175, 72).category).toBe(categoriaEsperada);
    });

    it('un IMC de 26 es NORMAL a los 72 y SOBREPESO a los 30', () => {
      const peso = 26 * 1.75 ** 2;
      expect(calcBMI(peso, 175, 72).category).toBe('normal');
      expect(calcBMI(peso, 175, 30).category).toBe('sobrepeso');
    });
  });

  it('sin edad se aplica el criterio de adulto', () => {
    const peso = 26 * 1.75 ** 2;
    expect(calcBMI(peso, 175).category).toBe('sobrepeso');
  });
});

describe('peso ideal', () => {
  it('West usa una constante distinta por sexo', () => {
    expect(idealWeightWest(170, 'F').value).toBe(60.4);  // 1.7² × 20.9
    expect(idealWeightWest(170, 'M').value).toBe(64.74); // 1.7² × 22.4
  });

  it('Hamwi dice CUÁL dato falta, no los dos siempre', () => {
    expect(idealWeightHamwi(null, 'F').missing).toEqual(['Talla']);
    expect(idealWeightHamwi(170, null).missing).toEqual(['Sexo']);
    expect(idealWeightHamwi(null, null).missing).toEqual(['Talla', 'Sexo']);
  });

  it('Hamwi parte de 152.4 cm y suma o resta por pulgada', () => {
    // A 152.4 cm exactos es la base, sin sumar nada.
    expect(idealWeightHamwi(152.4, 'F').value).toBe(45.36);
    expect(idealWeightHamwi(152.4, 'M').value).toBe(48.08);
    // Una pulgada por encima suma; por debajo resta.
    expect(idealWeightHamwi(154.94, 'F').value).toBe(47.63);
    expect(idealWeightHamwi(149.86, 'F').value).toBe(43.09);
  });

  it('el peso ideal por IMC objetivo sube a partir de los 60', () => {
    expect(idealWeightByBmi(170, 40).value).toBe(62.71); // 21.7 × 1.7²
    // 25.5 × 1.7² = 73.695, y sale 73.69 y no 73.70 porque en coma flotante ese
    // valor es en realidad 73.6949…. No se toca: diez gramos en un peso ideal no
    // cambian ninguna decisión, y forzar el redondeo aquí solo movería el
    // problema a otro número.
    expect(idealWeightByBmi(170, 60).value).toBe(73.69);
  });

  it('el rango saludable también cambia a partir de los 60', () => {
    const adulto = healthyWeightRange(170, 40);
    expect(adulto.min.value).toBe(53.47); // 18.5
    expect(adulto.max.value).toBe(71.96); // 24.9

    const mayor = healthyWeightRange(170, 72);
    expect(mayor.min.value).toBe(66.76);  // 23.1
    expect(mayor.max.value).toBe(80.63);  // 27.9
    // El rango del adulto mayor está por encima: no es un error de copia.
    expect(mayor.min.value as number).toBeGreaterThan(adulto.min.value as number);
  });

  it('el peso corregido SOLO se aplica en obesidad', () => {
    // Sin obesidad no devuelve número: aplicarlo a un paciente normal daría un
    // requerimiento calculado sobre un peso que no es el suyo.
    expect(correctedWeight(100, 70, 'normal').value).toBeNull();
    expect(correctedWeight(100, 70, 'sobrepeso').value).toBeNull();
    // (100 − 70) × 0.25 + 70 = 77.5
    expect(correctedWeight(100, 70, 'obesidad_g1').value).toBe(77.5);
    expect(correctedWeight(100, 70, 'obesidad_g3').value).toBe(77.5);
  });
});
