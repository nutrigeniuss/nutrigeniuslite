import { describe, it, expect } from 'vitest';
import { percentIdealWeight, idealWeightWest, idealWeightHamwi, idealWeightByBmi } from '../indicators';

describe('percentIdealWeight', () => {
  it('calcula el porcentaje del peso ideal', () => {
    expect(percentIdealWeight(70, 70).value).toBe(100);
    expect(percentIdealWeight(66.46, 66.46).value).toBe(100);
    expect(percentIdealWeight(80, 100).value).toBe(80);
    expect(percentIdealWeight(130, 100).value).toBe(130);
  });

  it('clasifica segun los cortes clinicos', () => {
    expect(percentIdealWeight(100, 100).label).toBe('Normal');
    expect(percentIdealWeight(115, 100).label).toBe('Sobrepeso');
    expect(percentIdealWeight(130, 100).label).toBe('Obesidad');
    expect(percentIdealWeight(85, 100).label).toBe('Desnutrición leve');
    expect(percentIdealWeight(75, 100).label).toBe('Desnutrición moderada');
    expect(percentIdealWeight(60, 100).label).toBe('Desnutrición severa');
  });

  // Los tramos se escriben "90-110 normal, 110-120 sobrepeso" y asi leidos
  // dejan huecos en los bordes. Cada valor tiene que caer en uno y solo uno.
  it('los limites exactos no quedan en tierra de nadie', () => {
    expect(percentIdealWeight(70, 100).label).toBe('Desnutrición moderada');
    expect(percentIdealWeight(80, 100).label).toBe('Desnutrición leve');
    expect(percentIdealWeight(90, 100).label).toBe('Normal');
    // 110 cuenta como normal: el tramo es 90-110 ambos incluidos.
    expect(percentIdealWeight(110, 100).label).toBe('Normal');
    expect(percentIdealWeight(110.1, 100).label).toBe('Sobrepeso');
    expect(percentIdealWeight(120, 100).label).toBe('Obesidad');
  });

  it('sin peso o sin talla dice que falta, no inventa', () => {
    expect(percentIdealWeight(null, 70).value).toBeNull();
    expect(percentIdealWeight(70, null).value).toBeNull();
    expect(percentIdealWeight(null, 70).missing).toContain('Peso');
    expect(percentIdealWeight(70, null).missing).toContain('Talla');
    // Un ideal de 0 dividiria por cero.
    expect(percentIdealWeight(70, 0).value).toBeNull();
  });

  // EL CASO QUE MOTIVO EL CAMBIO. Paciente real: varon de 1.75 m y 70.1 kg,
  // IMC 22.9 (normal). El criterio anterior marcaba "Adecuado" por West y por
  // Hamwi pero "Por encima" por IMC objetivo, porque este ultimo se pasaba de
  // los 3 kg de tolerancia por setecientos gramos. Tres etiquetas distintas
  // para el mismo paciente sano.
  it('no se contradice entre formulas para un paciente de IMC normal', () => {
    const tallaCm = 175;
    const pesoKg = 70.1;

    const ideales = [
      idealWeightWest(tallaCm, 'M').value,
      idealWeightHamwi(tallaCm, 'M').value,
      idealWeightByBmi(tallaCm, 30).value,
    ];

    const etiquetas = ideales.map((ideal) => percentIdealWeight(pesoKg, ideal).label);

    expect(etiquetas).toEqual(['Normal', 'Normal', 'Normal']);
  });
});
