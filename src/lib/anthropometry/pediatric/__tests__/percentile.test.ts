import { describe, expect, it } from 'vitest';
import {
  abdominalFieldRange,
  evaluateAbdominalPercentile,
  evaluateArmCircPercentile,
} from '../percentile';
import { evaluatePediatric, pediatricFieldRange } from '../index';
import percentileData from '../pediatricPercentiles.generated.json';

const DATA = percentileData as unknown as {
  percentiles: number[];
  armCirc: { boys: number[][]; girls: number[][] };
  abdominal: { boys: number[][]; girls: number[][] };
};

describe('percentiles pediátricos 5–18 (Frisancho / Fernández)', () => {
  it('perímetro braquial: el valor de un percentil publicado cae en ese percentil', () => {
    // Niño 5 años (5.5), brazo = P50 de la banda 5.0–5.9 → percentil ≈ 50, Normal.
    const row = DATA.armCirc.boys[0]; // [5, 5.9, P5..P95]
    const p50 = row[2 + 4]; // índice 4 = P50
    const r = evaluateArmCircPercentile('boys', 5.5, p50);
    expect(r).not.toBeNull();
    expect(Math.round(r!.percentile as number)).toBe(50);
    expect(r!.classification.label).toBe('Normal');
  });

  it('perímetro braquial: por debajo de P5 → Muy bajo', () => {
    const row = DATA.armCirc.boys[0];
    const p5 = row[2];
    const r = evaluateArmCircPercentile('boys', 5.5, p5 - 2);
    expect(r!.classification.label).toBe('Muy bajo');
    expect(r!.valueLabel).toBe('< P5');
  });

  it('abdominal (Fernández): riesgo por umbrales P75/P90', () => {
    const row = DATA.abdominal.boys.find((x) => x[0] === 10)!;
    // Formato de fila: [edad, P10, P75, P90]. El P10 se guarda para acotar el
    // rango del formulario, no para clasificar riesgo.
    const [, , p75, p90] = row;
    expect(evaluateAbdominalPercentile('boys', 10, p75 - 1)?.classification.label).toBe('Riesgo bajo');
    expect(evaluateAbdominalPercentile('boys', 10, p75 + 0.5)?.classification.label).toBe('Riesgo alto');
    expect(evaluateAbdominalPercentile('boys', 10, p90 + 1)?.classification.label).toBe('Riesgo muy alto');
  });

  // EL PERÍMETRO ABDOMINAL SE MIDE DESDE LOS 2 AÑOS.
  //
  // Fernández publica desde los 2 y el Excel del nutricionista trae esas filas,
  // pero dos recortes las dejaban fuera: el generador descartaba todo lo menor
  // de 5 años, y la evaluación solo corría en el grupo '5to19'. Resultado: un
  // niño de 2, 3 o 4 años con obesidad abdominal no recibía ningún aviso de
  // riesgo cardiovascular. No es que saliera mal — es que no se calculaba.
  describe('abdominal desde los 2 años', () => {
    it('la tabla cubre de 2 a 17 en ambos sexos', () => {
      for (const sex of ['boys', 'girls'] as const) {
        const edades = DATA.abdominal[sex].map((r) => r[0]);
        expect(edades).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
      }
    });

    it('clasifica riesgo a los 3 años', () => {
      const [, , p75, p90] = DATA.abdominal.boys.find((x) => x[0] === 3)!;
      expect(evaluateAbdominalPercentile('boys', 3, p75 - 1)?.classification.label).toBe('Riesgo bajo');
      expect(evaluateAbdominalPercentile('boys', 3, p90 + 1)?.classification.label).toBe('Riesgo muy alto');
    });

    it('la evaluación completa de un niño de 3 años incluye el riesgo abdominal', () => {
      const nino = evaluatePediatric({
        sex: 'boys', ageMonths: 42, weightKg: 17, heightCm: 97, abdominalCm: 56,
      });
      const dx = nino?.results.find((r) => r.indicator === 'abdominalP');
      expect(dx?.classification.label).toBe('Riesgo muy alto'); // P90 a los 3 = 54.2
    });

    it('a los 18 ya no usa la tabla infantil: manda el criterio de adulto', () => {
      // Son dos reglas distintas, no un tramo más de la misma. A los 18 el
      // riesgo se mide en centímetros absolutos (<94 / ≥94 / ≥102 en varón).
      expect(evaluateAbdominalPercentile('boys', 18, 90)).toBeNull();
    });
  });

  // EL RANGO DEL FORMULARIO ES OTRO PROBLEMA DISTINTO, Y ES EL QUE SE VEÍA.
  //
  // El resto de campos saca su rango de las tablas z de la OMS, que no publica
  // perímetro abdominal. Sin rango pediátrico, el formulario caía al de ADULTO
  // (plausible 60–140 cm) y pintaba en rojo "verifica la medición" en toda
  // cintura infantil real: la de un niño de 5 años ronda los 53 cm.
  describe('rango del formulario para la cintura de un niño', () => {
    it('una cintura normal de 2 años (47 cm) NO se marca como sospechosa', () => {
      const r = abdominalFieldRange('boys', 2)!;
      expect(r.plausibleMin).toBeLessThanOrEqual(47);
      expect(r.plausibleMax).toBeGreaterThanOrEqual(47);
    });

    it('el P50 publicado de cada edad cae dentro del rango plausible', () => {
      for (const sex of ['boys', 'girls'] as const) {
        for (const [edad, p10, , p90] of DATA.abdominal[sex]) {
          const r = abdominalFieldRange(sex, edad)!;
          expect(r.plausibleMin, `${sex} ${edad}a`).toBeLessThan(p10);
          expect(r.plausibleMax, `${sex} ${edad}a`).toBeGreaterThan(p90);
        }
      }
    });

    it('el formulario lo pide por la vía general, no solo la función suelta', () => {
      // Es la llamada real de ConsultDetail: clave de campo + edad en meses.
      const r = pediatricFieldRange('abdominal_per', 'boys', 36);
      expect(r).not.toBeNull();
      expect(r!.plausibleMin).toBeLessThan(50);
    });

    it('un número absurdo sí se marca', () => {
      const r = abdominalFieldRange('boys', 5)!;
      expect(r.min).toBeGreaterThan(10); // 5 cm no es una cintura
      expect(150).toBeGreaterThan(r.max); // ni 150 en un niño de 5 años
    });
  });

  it('solo aplican en 5–18 (no en <5 ni en adulto)', () => {
    // Niño 3 años (36 meses): grupo 2to5 → NO incluye indicadores por percentiles.
    const under5 = evaluatePediatric({ sex: 'boys', ageMonths: 36, weightKg: 14, heightCm: 95, armCircCm: 16 });
    expect(under5?.results.some((r) => r.indicator === 'armCircP')).toBe(false);
    // Niño 10 años (120 meses) con brazo → SÍ incluye armCircP (percentil).
    const child = evaluatePediatric({ sex: 'boys', ageMonths: 120, weightKg: 32, heightCm: 138, armCircCm: 20 });
    expect(child?.results.some((r) => r.indicator === 'armCircP')).toBe(true);
    const arm = child?.results.find((r) => r.indicator === 'armCircP');
    expect(typeof arm?.percentile).toBe('number');
    expect(arm?.valueLabel).toMatch(/^(P\d+|< P5|> P95)$/);
  });
});
