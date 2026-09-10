import { describe, expect, it } from 'vitest';

import { computeSomatotype } from '../composition';
import { calcTMB } from '../../../components/patient/requerimiento/logic';

// La mesomorfia se calcula con los perímetros CORREGIDOS por el pliegue de la
// zona (brazo − tríceps/10, pantorrilla − pliegue de pantorrilla/10). Cuando el
// pliegue faltaba se usaba un cero: el perímetro entraba sin corregir, la
// mesomorfia salía más alta y nada lo indicaba. Un número creíble y equivocado
// es peor que un hueco, porque el hueco se ve y el número se firma.
describe('somatotipo: no se inventan pliegues que faltan', () => {
  const COMPLETO = {
    weight: 70, height: 175,
    skinfolds: { triceps: 15, subscapular: 12, supraspinal: 10, medial_calf: 10 },
    diameters: { humerus: 7, femur: 9.5 },
    perimeters: { arm_contracted: 33, calf: 37 },
  };

  it('con todo medido da la triada completa', () => {
    const r = computeSomatotype(COMPLETO as never);
    expect(r.meso).toBe(5.01);
    expect(r.triad).toBe('3.7 – 5.0 – 2.5');
    expect(r.classification).toBe('Endo-Mesomorfo');
  });

  it('sin el pliegue de pantorrilla no se da la mesomorfia', () => {
    const sinPliegue = { ...COMPLETO, skinfolds: { ...COMPLETO.skinfolds, medial_calf: null } };
    const r = computeSomatotype(sinPliegue as never);
    // Antes devolvía 5.17: 0.16 puntos de más, sin avisar.
    expect(r.meso).toBeNull();
    expect(r.triad).toBeNull();
    expect(r.classification).toBeNull();
  });

  it('sin el pliegue tricipital tampoco', () => {
    const sinTri = { ...COMPLETO, skinfolds: { subscapular: 12, supraspinal: 10, medial_calf: 10 } };
    expect(computeSomatotype(sinTri as never).meso).toBeNull();
  });

  it('la ectomorfia, que no depende de pliegues, se sigue dando', () => {
    const soloPesoTalla = { weight: 70, height: 175 };
    const r = computeSomatotype(soloPesoTalla as never);
    expect(r.ecto).toBe(2.5);
    expect(r.meso).toBeNull();
  });
});

// La TMB decide el plan de alimentación entero. Leía el sexo comparando con la
// cadena exacta 'Masculino', así que cualquier otra forma del mismo dato caía
// en la ecuación de mujer sin decir nada.
describe('requerimiento: el sexo se lee bien escrito como esté', () => {
  const medicion = { weight: 70, height: 175 } as never;
  const AL = new Date('2026-08-21');
  const paciente = (gender: string) => ({ birth_date: '1990-01-01', gender }) as never;

  it('todas las formas de "masculino" dan la ecuación de varón', () => {
    // Edad decimal: 36 años y 7 meses el 21-08-2026 (nacido el 01-01-1990).
    const esperado = 9.99 * 70 + 6.25 * 175 - 4.92 * (36 + 7 / 12) + 5;
    for (const g of ['Masculino', 'masculino', 'MASCULINO', 'Hombre', 'Varón', 'male']) {
      expect(calcTMB('Mifflin-St Jeor', paciente(g), medicion, AL), g).toBeCloseTo(esperado, 1);
    }
  });

  it('femenino da la de mujer, 166 kcal por debajo', () => {
    const varon = calcTMB('Mifflin-St Jeor', paciente('Masculino'), medicion, AL)!;
    const mujer = calcTMB('Mifflin-St Jeor', paciente('Femenino'), medicion, AL)!;
    expect(varon - mujer).toBeCloseTo(166, 1);
  });

  it('la TMB de una consulta vieja se calcula con la edad de entonces', () => {
    const enConsulta = calcTMB('Harris-Benedict', paciente('Masculino'), medicion, new Date('2021-06-01'))!;
    const hoy = calcTMB('Harris-Benedict', paciente('Masculino'), medicion, AL)!;
    expect(Math.round(enConsulta)).toBe(1688);
    expect(Math.round(hoy)).toBe(1658); // 30 kcal menos solo por el calendario
  });
});
