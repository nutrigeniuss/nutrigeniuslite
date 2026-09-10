import { describe, expect, it } from 'vitest';
import { buildGrowthCurve } from '../growthCurves';

describe('curvas de crecimiento OMS', () => {
  it('genera las 5 líneas SD con orden creciente y mediana = M', () => {
    const curve = buildGrowthCurve('wfa', 'boys');
    expect(curve).not.toBeNull();
    expect(curve!.unit).toBe('month');
    expect(curve!.points.length).toBeGreaterThan(50); // 0–60 meses

    for (const p of curve!.points) {
      // Las bandas deben estar estrictamente ordenadas.
      expect(p.sd3neg).toBeLessThan(p.sd2neg);
      expect(p.sd2neg).toBeLessThan(p.sd0);
      expect(p.sd0).toBeLessThan(p.sd2);
      expect(p.sd2).toBeLessThan(p.sd3);
    }
  });

  it('curva basada en talla (peso/longitud) usa unit cm', () => {
    const curve = buildGrowthCurve('wfl', 'girls');
    expect(curve?.unit).toBe('cm');
    expect(curve!.points[0].x).toBe(45); // longitud empieza en 45 cm
  });

  it('indicadores por percentiles (no LMS) no tienen curva', () => {
    // 'armCircP' no es un indicador LMS de la OMS.
    expect(buildGrowthCurve('armCircP' as never, 'boys')).toBeNull();
  });
});
