import { describe, expect, it } from 'vitest';
import { buildGrowthCurve, buildTrajectoryCurve } from '../growthCurves';
import { buildIndicatorTrajectory } from '../index';

// Unión de Talla/Edad (lhfa 0–60 m + hfa 61–228 m) para graficar trayectorias que
// cruzan los 5 años, SIN alterar el z-score (cada mes conserva su tabla oficial).
describe('Talla/Edad: unión lhfa + hfa para la curva', () => {
  it('no cruza los 5 años → muestra el tramo estándar (igual que antes)', () => {
    const young = buildTrajectoryCurve('lhfa', 'girls', [12, 24]);
    expect(young).not.toBeNull();
    expect(young!.points.every((p) => p.x <= 60)).toBe(true);
    expect(young!.points[0].x).toBe(0);
    expect(young!.points[young!.points.length - 1].x).toBe(60);

    const old = buildTrajectoryCurve('hfa', 'girls', [72, 120]);
    expect(old!.points.every((p) => p.x > 60)).toBe(true);
    expect(old!.points[0].x).toBe(61);
  });

  it('cruza los 5 años → curva continua acotada a la ventana de los puntos', () => {
    const merged = buildTrajectoryCurve('hfa', 'girls', [48, 72]);
    expect(merged).not.toBeNull();
    const xs = merged!.points.map((p) => p.x);
    // Incluye ambos lados del borde de 60 meses.
    expect(xs.some((x) => x <= 60)).toBe(true);
    expect(xs.some((x) => x > 60)).toBe(true);
    // Ventana ≈ [42, 78] (puntos ±6 m), monótona creciente y continua.
    expect(Math.min(...xs)).toBeLessThanOrEqual(48);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(72);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it('cada mes usa SU tabla en el borde (no se mezcla lhfa con hfa)', () => {
    const merged = buildTrajectoryCurve('hfa', 'girls', [55, 65]);
    const lhfa = buildGrowthCurve('lhfa', 'girls')!;
    const hfa = buildGrowthCurve('hfa', 'girls')!;
    const lhfa60 = lhfa.points.find((p) => p.x === 60)!;
    const hfa61 = hfa.points.find((p) => p.x === 61)!;
    const merged60 = merged!.points.find((p) => p.x === 60)!;
    const merged61 = merged!.points.find((p) => p.x === 61)!;
    // La mediana (sd0) a cada lado del borde es EXACTAMENTE la de su tabla oficial.
    expect(merged60.sd0).toBe(lhfa60.sd0);
    expect(merged61.sd0).toBe(hfa61.sd0);
    expect(merged60.sd3neg).toBe(lhfa60.sd3neg);
    expect(merged61.sd3).toBe(hfa61.sd3);
  });
});

describe('Talla/Edad: la trayectoria conserva los puntos al cruzar los 5 años', () => {
  it('un niño medido a los 4 y 6 años mantiene AMBOS puntos con indicador hfa', () => {
    const history = [
      { date: '2022-01-01', heightCm: 103 }, // 4 años
      { date: '2024-01-01', heightCm: 116 }, // 6 años
    ];
    const traj = buildIndicatorTrajectory('hfa', 'girls', '2018-01-01', history, '2024-01-01');
    expect(traj.length).toBe(2);
    // El punto de 4 años (48 m, fuera del dominio de hfa 61–228) ya NO se descarta.
    expect(traj.some((p) => p.x < 61)).toBe(true);
    expect(traj.some((p) => p.x > 61)).toBe(true);
    // La consulta actual (6 años) queda marcada.
    expect(traj.find((p) => p.isCurrent)?.x).toBeGreaterThan(61);
  });
});
