import { describe, expect, it } from 'vitest';

import { compute4Components, compute5Components, computeSomatotype } from '../composition';
import { calcBMI } from '../indicators/bmi';
import { calcWHtR } from '../indicators/circumferences';

// Las mediciones llegan de inputs HTML. Hoy se guardan como número (parseNum2
// las convierte al teclear), pero por la base pasan también fichas antiguas y
// datos importados, donde un "15" puede seguir siendo texto.
//
// El módulo entero convierte a la entrada... salvo un punto: la rama de Siri
// del generador de PDF pasaba los pliegues en crudo. Como Siri es la fórmula
// POR DEFECTO, el informe decía "faltan pliegues" mientras la pantalla mostraba
// el porcentaje del mismo paciente. Estas pruebas fijan que composición y
// somatotipo aguantan texto, que es el contrato que el resto asume.

describe('las mediciones guardadas como texto se calculan igual', () => {
  const comoTexto = {
    weight: '70', height: '175', height_sitting: '90', sex: 'Masculino', ageYears: 30,
    skinfolds: {
      biceps: '6', triceps: '15', subscapular: '12', iliac_crest: '14',
      supraspinal: '10', abdominal: '20', front_thigh: '18', medial_calf: '10',
    },
    diameters: {
      wrist_bistyloid: '5.5', femur: '9.5', humerus: '7',
      biacromial: '40', biiliocrestal: '28', thorax_anteroposterior: '20', thorax_transverse: '28',
    },
    perimeters: {
      waist: '85', arm_relaxed: '30', arm_contracted: '33', forearm: '27',
      thigh_mid: '55', calf: '37', mesosternal: '95', cephalic: '56',
    },
  };
  const comoNumero = JSON.parse(JSON.stringify(comoTexto), (_k, v) =>
    typeof v === 'string' && v !== 'Masculino' && Number.isFinite(Number(v)) ? Number(v) : v);

  it('4 componentes da lo mismo con texto que con números', () => {
    const texto = compute4Components(comoTexto as never).rows.map((r) => [r.name, r.kg]);
    const numero = compute4Components(comoNumero as never).rows.map((r) => [r.name, r.kg]);
    expect(texto).toEqual(numero);
    expect(texto.every(([, kg]) => kg !== null)).toBe(true);
  });

  it('5 componentes (Kerr) también', () => {
    const texto = compute5Components(comoTexto as never).rows.map((r) => [r.name, r.kg]);
    const numero = compute5Components(comoNumero as never).rows.map((r) => [r.name, r.kg]);
    expect(texto).toEqual(numero);
    expect(texto.every(([, kg]) => kg !== null)).toBe(true);
  });

  it('el somatotipo también', () => {
    expect(computeSomatotype(comoTexto as never)).toEqual(computeSomatotype(comoNumero as never));
    expect(computeSomatotype(comoTexto as never).triad).not.toBeNull();
  });

  it('los indicadores sueltos que reciben texto no inventan un número', () => {
    // Aquí el contrato es el contrario: `isNum` exige número de verdad, así que
    // el indicador se declara incompleto en vez de calcular con NaN.
    expect(calcBMI('70' as never, '175' as never).value).toBeNull();
    expect(calcWHtR('85' as never, '175' as never, 30).value).toBeNull();
  });
});
