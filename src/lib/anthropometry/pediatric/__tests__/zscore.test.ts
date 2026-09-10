import { describe, expect, it } from 'vitest';
import { computeZScore, valueAtZ, type PediatricIndicator, type PediatricSex } from '../zscore';
import tables from '../whoLms.generated.json';

// Verificación del motor de z-score contra los datos OFICIALES de la OMS.
// Si el motor mapea correctamente los valores publicados a sus z-scores, tanto
// el parseo de las tablas como la fórmula LMS son correctos.

const INDICATORS: PediatricIndicator[] = ['wfa', 'lhfa', 'hcfa', 'bmi', 'hfa', 'wfl', 'wfh', 'acfa', 'tsfa', 'ssfa'];
const SEXES: PediatricSex[] = ['boys', 'girls'];
const T = tables as unknown as Record<string, { boys: number[][]; girls: number[][] }>;

describe('z-score pediátrico OMS (método LMS)', () => {
  it('la mediana (M) mapea a z ≈ 0 en TODAS las tablas y sexos', () => {
    for (const indicator of INDICATORS) {
      for (const sex of SEXES) {
        for (const [x, , M] of T[indicator][sex]) {
          const z = computeZScore({ indicator, sex, x, value: M });
          expect(z, `${indicator}/${sex}/x=${x}`).not.toBeNull();
          expect(Math.abs(z as number)).toBeLessThan(1e-6);
        }
      }
    }
  });

  // Verificación inversa: el motor debe REPRODUCIR las curvas SD publicadas por
  // la OMS. valueAtZ(z) debe coincidir con el valor de la columna SDx de la tabla
  // oficial (dentro del redondeo con que la OMS los publica).
  // [indicador, sexo, x, z, valor publicado por la OMS, tolerancia]
  const rowAt = (ind: PediatricIndicator, sex: PediatricSex, x: number): number[] => {
    const row = T[ind][sex].find((r) => r[0] === x);
    if (!row) throw new Error(`No hay fila x=${x} en ${ind}/${sex}`);
    return row;
  };

  const whoCurve: Array<[PediatricIndicator, PediatricSex, number, number, number, number]> = [
    // Peso/edad niños, mes 0 — cortes OMS a 1 decimal (tol 0.06):
    ['wfa', 'boys', 0, -3, 2.1, 0.06], ['wfa', 'boys', 0, -2, 2.5, 0.06],
    ['wfa', 'boys', 0, 0, 3.3, 0.06], ['wfa', 'boys', 0, 2, 4.4, 0.06],
    ['wfa', 'boys', 0, 3, 5.0, 0.06],
    // Peso/longitud niños, 45 cm — 1 decimal:
    ['wfl', 'boys', 45, -2, 2.0, 0.06], ['wfl', 'boys', 45, 0, 2.4, 0.06],
    ['wfl', 'boys', 45, 1, 2.7, 0.06], ['wfl', 'boys', 45, 2, 3.0, 0.06],
    // IMC/edad niños, mes 61 (5 años) — tabla WHO-2007 a 3 decimales (tol 0.002):
    ['bmi', 'boys', 61, -2, 13.031, 0.002], ['bmi', 'boys', 61, 0, 15.264, 0.002],
    ['bmi', 'boys', 61, 1, 16.645, 0.002], ['bmi', 'boys', 61, 2, 18.259, 0.002],
    ['bmi', 'boys', 61, 3, 20.166, 0.002],
    // Perímetro braquial niños, mes 3 (cm, 1 decimal):
    ['acfa', 'boys', 3, -2, 11.6, 0.06], ['acfa', 'boys', 3, 0, 13.5, 0.06], ['acfa', 'boys', 3, 2, 15.6, 0.06],
    // Pliegue tricipital niños, mes 3 (mm, 1 decimal):
    ['tsfa', 'boys', 3, -2, 7, 0.06], ['tsfa', 'boys', 3, 0, 9.8, 0.06], ['tsfa', 'boys', 3, 2, 13.6, 0.06],
    // Pliegue subescapular niños, mes 3 (mm, 1 decimal):
    ['ssfa', 'boys', 3, -2, 5.6, 0.06], ['ssfa', 'boys', 3, 0, 7.7, 0.06], ['ssfa', 'boys', 3, 2, 11, 0.06],
  ];

  it.each(whoCurve)(
    '%s/%s x=%d: valueAtZ(%d) ≈ %d (curva OMS)',
    (indicator, sex, x, z, published, tol) => {
      const [, L, M, S] = rowAt(indicator, sex, x);
      expect(Math.abs(valueAtZ(L, M, S, z) - published)).toBeLessThan(tol);
    },
  );

  it('interpola L,M,S entre meses de forma consistente', () => {
    // Media de las medianas de mes 0 y 1 debe dar z≈0 a la edad 0.5 meses.
    const m0 = T.wfa.boys[0][2];
    const m1 = T.wfa.boys[1][2];
    const z = computeZScore({ indicator: 'wfa', sex: 'boys', x: 0.5, value: (m0 + m1) / 2 });
    expect(Math.abs(z as number)).toBeLessThan(0.05);
  });

  it('ejemplos clínicos reales (se imprimen para inspección)', () => {
    const examples = [
      { label: 'Niño 24 meses, 12.0 kg (peso/edad)', z: computeZScore({ indicator: 'wfa', sex: 'boys', x: 24, value: 12.0 }) },
      { label: 'Niña 36 meses, 90 cm (talla/edad)', z: computeZScore({ indicator: 'lhfa', sex: 'girls', x: 36, value: 90 }) },
      { label: 'Niño 8 años (96m), IMC 17 (IMC/edad)', z: computeZScore({ indicator: 'bmi', sex: 'boys', x: 96, value: 17 }) },
      { label: 'Niña 12 años (144m), IMC 26 (IMC/edad)', z: computeZScore({ indicator: 'bmi', sex: 'girls', x: 144, value: 26 }) },
    ];
    for (const e of examples) {
      // eslint-disable-next-line no-console
      console.log(`  ${e.label}  →  z = ${(e.z as number).toFixed(2)}`);
      expect(e.z).not.toBeNull();
    }
  });
});
