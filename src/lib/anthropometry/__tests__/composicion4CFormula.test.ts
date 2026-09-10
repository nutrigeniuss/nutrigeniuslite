import { describe, it, expect } from 'vitest';
import { compute4Components } from '../composition';

// Paciente completo: todas las medidas que piden las cuatro formulas, para que
// el unico motivo por el que cambie un numero sea la formula elegida.
const PACIENTE = {
  weight: 70,
  height: 175,
  sex: 'Masculino', // como lo guarda la ficha; la "M" suelta es ambigua a propósito
  ageYears: 30,
  skinfolds: {
    biceps: 8, triceps: 12, subscapular: 14, iliac_crest: 16,
    supraspinal: 10, abdominal: 18, front_thigh: 15, medial_calf: 12,
  },
  diameters: { wrist_bistyloid: 5.8, femur: 9.5 },
  perimeters: { waist: 90 },
} as const;

const masaGrasaDe = (r: ReturnType<typeof compute4Components>) =>
  r.rows.find((x) => x.name === 'Masa grasa');

describe('compute4Components respeta la formula de grasa elegida', () => {
  it('por defecto usa Siri, como se calculo siempre', () => {
    const fila = masaGrasaDe(compute4Components({ ...PACIENTE }));
    expect(fila?.autor).toBe('Siri');
  });

  it('cada formula da una masa grasa distinta', () => {
    const masas = (['siri', 'yuhasz', 'faulkner', 'rfm'] as const).map((formulaGrasa) => {
      const fila = masaGrasaDe(compute4Components({ ...PACIENTE, formulaGrasa }));
      expect(fila?.kg, `${formulaGrasa} no calculo nada`).not.toBeNull();
      return fila?.kg;
    });
    expect(new Set(masas).size).toBeGreaterThan(1);
  });

  it('nombra al autor elegido, que es lo que se cita en el informe', () => {
    expect(masaGrasaDe(compute4Components({ ...PACIENTE, formulaGrasa: 'yuhasz' }))?.autor).toBe('Yuhasz');
    expect(masaGrasaDe(compute4Components({ ...PACIENTE, formulaGrasa: 'rfm' }))?.autor).toBe('RFM');
  });

  // La masa muscular sale por resta (peso - grasa - osea - residual), asi que
  // cambiar la formula de grasa la mueve tambien. Es la razon por la que la
  // eleccion no puede quedarse solo en la pantalla.
  it('cambiar la formula mueve tambien la masa muscular', () => {
    const conSiri = compute4Components({ ...PACIENTE, formulaGrasa: 'siri' });
    const conRfm = compute4Components({ ...PACIENTE, formulaGrasa: 'rfm' });

    const musculoSiri = conSiri.rows.find((r) => r.name === 'Masa muscular')?.kg;
    const musculoRfm = conRfm.rows.find((r) => r.name === 'Masa muscular')?.kg;

    expect(musculoSiri).not.toBeNull();
    expect(musculoRfm).not.toBeNull();
    expect(musculoSiri).not.toBe(musculoRfm);
  });
});

// El informe impreso mostraba solo las filas que salian. Con dos de cuatro,
// quien lo leia no sabia si el componente no aplicaba o si faltaba una medida.
describe('cada componente dice que le falta', () => {
  it('la masa osea nombra los diametros que no estan', () => {
    const sinDiametros = compute4Components({ ...PACIENTE, diameters: {} });
    const osea = sinDiametros.rows.find((r) => r.name === 'Masa ósea');

    expect(osea?.kg).toBeNull();
    expect(osea?.missing).toContain('Bistiloideo de la muñeca');
    expect(osea?.missing).toContain('Fémur');
  });

  it('la masa muscular arrastra lo que les falta a las demas', () => {
    const sinDiametros = compute4Components({ ...PACIENTE, diameters: {} });
    const muscular = sinDiametros.rows.find((r) => r.name === 'Masa muscular');

    expect(muscular?.kg).toBeNull();
    expect(muscular?.missing).toContain('Bistiloideo de la muñeca');
  });

  it('lo que si se calcula no arrastra faltantes', () => {
    const completo = compute4Components({ ...PACIENTE });
    for (const fila of completo.rows) {
      expect(fila.kg, `${fila.name} deberia calcularse`).not.toBeNull();
      expect(fila.missing ?? []).toEqual([]);
    }
  });
});
