import { describe, expect, it } from 'vitest';
import { buildIndicatorTrajectory, type PediatricMeasurementRecord } from '../index';

describe('trayectoria pediátrica (progresión en el tiempo)', () => {
  const birth = '2020-01-01';
  const history: PediatricMeasurementRecord[] = [
    { date: '2021-01-01', weightKg: 9.6, heightCm: 76 },   // 12 meses
    { date: '2022-01-01', weightKg: 12.2, heightCm: 87 },  // 24 meses
    { date: '2023-01-01', weightKg: 14.3, heightCm: 96 },  // 36 meses
  ];

  it('mapea cada medición a un punto (x=edad, valor=peso) ordenado por edad', () => {
    const traj = buildIndicatorTrajectory('wfa', 'boys', birth, history, '2023-01-01');
    expect(traj).toHaveLength(3);
    expect(traj.map((p) => Math.round(p.x))).toEqual([12, 24, 36]);
    expect(traj.map((p) => p.value)).toEqual([9.6, 12.2, 14.3]);
    // La última (2023) es la actual.
    expect(traj[2].isCurrent).toBe(true);
    expect(traj[0].isCurrent).toBe(false);
  });

  it('peso/talla usa la talla como eje x', () => {
    const traj = buildIndicatorTrajectory('wfh', 'boys', birth, history, '2023-01-01');
    // Solo las mediciones con talla dentro del dominio (65–120 cm) de wfh.
    expect(traj.every((p) => p.x >= 65 && p.x <= 120)).toBe(true);
    expect(traj.map((p) => p.value)).toContain(14.3);
  });

  it('descarta mediciones fuera del dominio del indicador', () => {
    // wfa cubre 0–60 meses; una medición a los 7 años (84m) queda fuera.
    const withOld: PediatricMeasurementRecord[] = [
      ...history,
      { date: '2027-01-01', weightKg: 24, heightCm: 122 }, // 84 meses → fuera de wfa
    ];
    const traj = buildIndicatorTrajectory('wfa', 'boys', birth, withOld, '2027-01-01');
    expect(traj).toHaveLength(3); // la de 84m se descarta
  });

  it('indicador sin curva LMS devuelve vacío', () => {
    expect(buildIndicatorTrajectory('armCircP' as never, 'boys', birth, history)).toEqual([]);
  });
});
