import { describe, expect, it } from 'vitest';
import {
  compute4Components,
  compute5Components,
  computeSomatotype,
  type CompositionInput,
} from '../composition';

// Input antropométrico completo de un adulto (varón) — sirve para ejercitar
// las ramas "todos los datos presentes" de los tres modelos. Las unidades son
// las que espera el módulo: peso kg, tallas cm, pliegues mm, diámetros cm,
// perímetros cm.
const FULL_MALE: CompositionInput = {
  weight: 75,
  height: 175,
  height_sitting: 92,
  sex: 'Masculino',
  ageYears: 30,
  skinfolds: {
    biceps: 4,
    triceps: 10,
    subscapular: 12,
    iliac_crest: 14,
    supraspinal: 10,
    abdominal: 18,
    front_thigh: 12,
    medial_calf: 8,
  },
  diameters: {
    wrist_bistyloid: 5.6,
    femur: 9.5,
    humerus: 7.0,
    biacromial: 40,
    biiliocrestal: 28,
    thorax_anteroposterior: 20,
    thorax_transverse: 28,
  },
  perimeters: {
    arm_relaxed: 30,
    arm_contracted: 32,
    forearm: 27,
    thigh_mid: 54,
    calf: 37,
    mesosternal: 95,
    cephalic: 57,
    waist: 82,
  },
};

describe('compute4Components', () => {
  it('devuelve las 4 filas en orden fijo con datos completos', () => {
    const { rows } = compute4Components(FULL_MALE);
    expect(rows.map((r) => r.name)).toEqual([
      'Masa ósea',
      'Masa grasa',
      'Masa muscular',
      'Masa residual',
    ]);
  });

  it('masa residual = peso × 0.241 en varón (Würch)', () => {
    const { rows } = compute4Components(FULL_MALE);
    const residual = rows.find((r) => r.name === 'Masa residual');
    // 75 × 0.241 = 18.0749… → 18.07 (toFixed redondea hacia abajo por el float)
    expect(residual?.kg).toBeCloseTo(18.07, 2);
    expect(residual?.pct).toBeCloseTo(24.1, 1);
  });

  it('masa residual = peso × 0.209 en mujer (Würch)', () => {
    const { rows } = compute4Components({ ...FULL_MALE, weight: 60, sex: 'Femenino' });
    const residual = rows.find((r) => r.name === 'Masa residual');
    // 60 × 0.209 = 12.54
    expect(residual?.kg).toBeCloseTo(12.54, 2);
  });

  it('masa ósea (Rocha) en rango esperado con talla/muñeca/fémur', () => {
    const { rows } = compute4Components(FULL_MALE);
    const osea = rows.find((r) => r.name === 'Masa ósea');
    // 3.02 · (1.75² · 0.056 · 0.095 · 400)^0.712 ≈ 11.5
    expect(osea?.kg).toBeCloseTo(11.5, 0);
  });

  it('masa muscular nunca es negativa (clamp Matiegka a 0)', () => {
    const { rows } = compute4Components(FULL_MALE);
    const muscular = rows.find((r) => r.name === 'Masa muscular');
    expect(muscular?.kg).not.toBeNull();
    expect(muscular!.kg!).toBeGreaterThanOrEqual(0);
  });

  it('sin peso → todas las masas que dependen del peso son null', () => {
    const { rows } = compute4Components({ ...FULL_MALE, weight: null });
    const residual = rows.find((r) => r.name === 'Masa residual');
    const grasa = rows.find((r) => r.name === 'Masa grasa');
    expect(residual?.kg).toBeNull();
    expect(grasa?.kg).toBeNull();
  });

  it('sin diámetros de muñeca/fémur → masa ósea null', () => {
    const { rows } = compute4Components({ ...FULL_MALE, diameters: {} });
    const osea = rows.find((r) => r.name === 'Masa ósea');
    expect(osea?.kg).toBeNull();
  });
});

describe('compute5Components', () => {
  it('con datos completos calcula peso predictivo y factor de ajuste', () => {
    const res = compute5Components(FULL_MALE);
    expect(res.pesoPredictivo).not.toBeNull();
    expect(res.pesoPredictivo!).toBeGreaterThan(0);
    expect(res.factorAjuste).not.toBeNull();
    expect(res.factorAjuste!).toBeGreaterThan(0);
    expect(res.rows).toHaveLength(5);
    expect(res.rows.map((r) => r.name)).toEqual([
      'Masa Piel',
      'Masa Adiposa',
      'Masa Muscular',
      'Masa Ósea',
      'Masa Residual',
    ]);
  });

  it('cada masa ajustada ≈ masa cruda × factor de ajuste', () => {
    const res = compute5Components(FULL_MALE);
    const factor = res.factorAjuste!;
    for (const row of res.rows) {
      if (row.kg !== null && row.kgAdj !== null) {
        expect(row.kgAdj).toBeCloseTo(row.kg * factor, 1);
      }
    }
  });

  it('deltaPct refleja (pesoPredictivo − peso)/peso × 100', () => {
    const res = compute5Components(FULL_MALE);
    const expected = ((res.pesoPredictivo! - 75) / 75) * 100;
    expect(res.deltaPct).toBeCloseTo(expected, 1);
  });

  it('faltando height_sitting → masa residual null y modelo incompleto', () => {
    const res = compute5Components({ ...FULL_MALE, height_sitting: null });
    const residual = res.rows.find((r) => r.name === 'Masa Residual');
    expect(residual?.kg).toBeNull();
    expect(res.pesoPredictivo).toBeNull();
    expect(res.factorAjuste).toBeNull();
  });

  it('sin perímetros ni diámetros → todas las masas Phantom null', () => {
    const res = compute5Components({
      weight: 75,
      height: 175,
      height_sitting: 92,
      sex: 'Masculino',
    });
    // Solo la piel (DuBois) depende de peso+talla; el resto necesita pliegues/diámetros.
    const adiposa = res.rows.find((r) => r.name === 'Masa Adiposa');
    const muscular = res.rows.find((r) => r.name === 'Masa Muscular');
    expect(adiposa?.kg).toBeNull();
    expect(muscular?.kg).toBeNull();
    expect(res.pesoPredictivo).toBeNull();
  });
});

describe('computeSomatotype', () => {
  it('ectomorfia (banda alta) usa 0.732·IPP − 28.58', () => {
    // IPP = 175 / cbrt(75) ≈ 41.50 ≥ 40.75
    const res = computeSomatotype({ weight: 75, height: 175 });
    expect(res.ecto).toBeCloseTo(1.8, 1);
  });

  it('ectomorfia mínima = 0.1 cuando el IPP es bajo', () => {
    // IPP = 160 / cbrt(80) ≈ 37.13 ≤ 38.25 → piso 0.1
    const res = computeSomatotype({ weight: 80, height: 160 });
    expect(res.ecto).toBe(0.1);
  });

  it('con datos completos entrega triada, ejes X/Y y clasificación', () => {
    const res = computeSomatotype(FULL_MALE);
    expect(res.endo).not.toBeNull();
    expect(res.meso).not.toBeNull();
    expect(res.ecto).not.toBeNull();
    expect(res.triad).toMatch(/^\d+\.\d – \d+\.\d – \d+\.\d$/);
    // Eje X = ecto − endo, Eje Y = 2·meso − (endo + ecto)
    expect(res.x).toBeCloseTo(res.ecto! - res.endo!, 2);
    expect(res.y).toBeCloseTo(2 * res.meso! - (res.endo! + res.ecto!), 2);
    expect(typeof res.classification).toBe('string');
  });

  it('sin pliegues → endomorfia y clasificación null', () => {
    const res = computeSomatotype({ weight: 75, height: 175 });
    expect(res.endo).toBeNull();
    expect(res.classification).toBeNull();
    expect(res.triad).toBeNull();
  });
});
