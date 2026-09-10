import { describe, it, expect } from 'vitest';
import { bodyFatYuhasz, bodyFatRFM, bodyFatFaulkner, bodyFatDurninSiri } from '../indicators';

describe('bodyFatYuhasz', () => {
  // ♂ %G = Σ6 × 0.1051 + 2.585 · ♀ %G = Σ6 × 0.1548 + 3.580
  it('aplica la constante que corresponde al sexo', () => {
    // Seis pliegues de 10 mm -> Σ = 60.
    const varon = bodyFatYuhasz(10, 10, 10, 10, 10, 10, 'M');
    const mujer = bodyFatYuhasz(10, 10, 10, 10, 10, 10, 'F');

    expect(varon.value).toBeCloseTo(60 * 0.1051 + 2.585, 2);
    expect(mujer.value).toBeCloseTo(60 * 0.1548 + 3.580, 2);
    // Con los mismos pliegues, la mujer da mas: son constantes distintas y
    // usar la equivocada falsea el resultado.
    expect(mujer.value).toBeGreaterThan(varon.value as number);
  });

  it('nombra los seis pliegues que le faltan', () => {
    const r = bodyFatYuhasz(10, null, 10, null, null, 10, 'M');
    expect(r.value).toBeNull();
    expect(r.missing).toContain('Subescapular');
    expect(r.missing).toContain('Abdominal');
    expect(r.missing).toContain('Muslo frontal');
    expect(r.missing).not.toContain('Tríceps');
  });

  it('sin sexo no elige constante al azar', () => {
    expect(bodyFatYuhasz(10, 10, 10, 10, 10, 10, null).value).toBeNull();
    expect(bodyFatYuhasz(10, 10, 10, 10, 10, 10, null).missing).toContain('Sexo');
  });
});

describe('bodyFatRFM', () => {
  // RFM = 64 − (20 × talla/cintura) + (12 si mujer)
  it('calcula con talla y cintura, sin pliegues', () => {
    const varon = bodyFatRFM(175, 90, 'M');
    expect(varon.value).toBeCloseTo(64 - 20 * (175 / 90), 2);

    const mujer = bodyFatRFM(175, 90, 'F');
    expect(mujer.value).toBeCloseTo(64 - 20 * (175 / 90) + 12, 2);
  });

  it('a mas cintura, mas grasa estimada', () => {
    const delgado = bodyFatRFM(175, 75, 'M').value as number;
    const ancho = bodyFatRFM(175, 105, 'M').value as number;
    expect(ancho).toBeGreaterThan(delgado);
  });

  it('una cintura de cero dividiria por cero', () => {
    expect(bodyFatRFM(175, 0, 'M').value).toBeNull();
  });

  it('dice que falta la cintura y no la inventa', () => {
    expect(bodyFatRFM(175, null, 'M').missing).toContain('Cintura');
    expect(bodyFatRFM(null, 90, 'M').missing).toContain('Talla');
  });
});

// Las cuatro formulas se ofrecen a elegir precisamente porque NO coinciden:
// cada una se valida en una poblacion distinta. Si dieran lo mismo, elegir no
// tendria sentido.
describe('las cuatro formulas dan resultados distintos', () => {
  it('sobre el mismo paciente', () => {
    const siri = bodyFatDurninSiri(8, 12, 14, 16, 30, 'M').value;
    const faulkner = bodyFatFaulkner(12, 14, 10, 18).value;
    const yuhasz = bodyFatYuhasz(12, 14, 10, 18, 15, 12, 'M').value;
    const rfm = bodyFatRFM(175, 90, 'M').value;

    for (const valor of [siri, faulkner, yuhasz, rfm]) {
      expect(valor).not.toBeNull();
      expect(valor as number).toBeGreaterThan(0);
      expect(valor as number).toBeLessThan(70);
    }

    expect(new Set([siri, faulkner, yuhasz, rfm]).size).toBeGreaterThan(1);
  });
});
