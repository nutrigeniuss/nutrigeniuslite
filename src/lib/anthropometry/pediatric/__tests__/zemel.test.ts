import { describe, expect, it } from 'vitest';
import { buildZemelCurve, evaluateZemel, hasDownSyndrome } from '../zemel';
import { assessPatientMeasurement, buildZemelTrajectory } from '../index';

// Datos de la tabla (girls): wfa 12m M=8.223; hfa 12m M=70.357; bmi 120m M=19.365.
describe('Zemel (síndrome de Down): percentil desde LMS', () => {
  it('la mediana cae en ~P50 y clasifica Normal', () => {
    const a = evaluateZemel({ sex: 'girls', ageMonths: 12, weightKg: 8.223, heightCm: 70.357 })!;
    const wfa = a.results.find((r) => r.indicator === 'wfa')!;
    expect(wfa.percentile).toBeGreaterThan(48);
    expect(wfa.percentile).toBeLessThan(52);
    expect(wfa.classification.label).toBe('Normal');
    const hfa = a.results.find((r) => r.indicator === 'hfa')!;
    expect(hfa.percentile).toBeGreaterThan(48);
    expect(hfa.percentile).toBeLessThan(52);
  });

  it('cortes de peso/edad ≤36m: <P5 desnutrición global, >P90 exceso', () => {
    // Peso muy bajo → percentil < 5.
    const low = evaluateZemel({ sex: 'girls', ageMonths: 12, weightKg: 5.5 })!;
    expect(low.results[0].classification.label).toBe('Desnutrición global');
    // Peso muy alto → percentil > 90.
    const high = evaluateZemel({ sex: 'girls', ageMonths: 12, weightKg: 12 })!;
    expect(high.results[0].classification.label).toBe('Exceso de peso');
  });

  it('tramo 2–20 años usa las tablas de niño (IMC/edad, talla/edad)', () => {
    const a = evaluateZemel({ sex: 'girls', ageMonths: 120, weightKg: 30, heightCm: 130 })!;
    expect(a.results.some((r) => r.indicator === 'bmi')).toBe(true);
    expect(a.results.some((r) => r.indicator === 'wfl')).toBe(false); // peso/longitud solo ≤36m
    expect(a.results.find((r) => r.indicator === 'hfa')!.indicatorLabel).toBe('Talla para la edad');
  });

  it('fuera de 0–20 años devuelve null', () => {
    expect(evaluateZemel({ sex: 'girls', ageMonths: 241, weightKg: 60, heightCm: 160 })).toBeNull();
  });

  it('recién nacido con Down (0 meses) recibe talla y perímetro cefálico', () => {
    // hfa_inf/hcfa_inf de Zemel empiezan en 1 mes; con la tolerancia de borde un
    // recién nacido igual se evalúa (clamp a la 1.ª fila), no se queda sin resultado.
    const a = evaluateZemel({ sex: 'boys', ageMonths: 0, weightKg: 3.4, heightCm: 49, headCircCm: 34 })!;
    expect(a.results.some((r) => r.indicator === 'hfa')).toBe(true);
    expect(a.results.some((r) => r.indicator === 'hcfa')).toBe(true);
  });
});

describe('Zemel: curva de percentiles y trayectoria', () => {
  it('la curva trae etiquetas de percentil y la mediana coincide con el P50 publicado', () => {
    const curve = buildZemelCurve('wfa', 'girls', [12])!;
    expect(curve.lineLabels).toEqual(['P5', 'P10', 'P50', 'P90', 'P95']);
    const at12 = curve.points.find((p) => p.x === 12)!;
    expect(at12.sd0).toBeCloseTo(8.223, 1); // M (=P50) publicado a 12 meses (niñas)
    // Las líneas están ordenadas P5 < P10 < P50 < P90 < P95.
    expect(at12.sd3neg).toBeLessThan(at12.sd2neg);
    expect(at12.sd2neg).toBeLessThan(at12.sd0);
    expect(at12.sd0).toBeLessThan(at12.sd2);
    expect(at12.sd2).toBeLessThan(at12.sd3);
  });

  it('la trayectoria Zemel conserva todas las consultas 0–20 años', () => {
    const history = [
      { date: '2021-01-01', weightKg: 8, heightCm: 70 }, // 1 año
      { date: '2025-01-01', weightKg: 16, heightCm: 100 }, // 5 años
    ];
    const traj = buildZemelTrajectory('wfa', 'girls', '2020-01-01', history, '2025-01-01');
    expect(traj.length).toBe(2);
    expect(traj.find((p) => p.isCurrent)?.x).toBeGreaterThan(36);
  });
});

describe('detección de síndrome de Down', () => {
  it('reconoce variantes de texto', () => {
    expect(hasDownSyndrome('Síndrome de Down')).toBe(true);
    expect(hasDownSyndrome('sindrome de down, hipotiroidismo')).toBe(true);
    expect(hasDownSyndrome(['Asma', 'Trisomía 21'])).toBe(true);
    expect(hasDownSyndrome('Down syndrome')).toBe(true);
    expect(hasDownSyndrome('down')).toBe(true); // tag suelto en el campo de diagnósticos
    expect(hasDownSyndrome('Asma')).toBe(false);
    expect(hasDownSyndrome(null)).toBe(false);
  });

  it('no confunde el uso coloquial de "down" (ánimo) con el síndrome', () => {
    expect(hasDownSyndrome('Paciente se siente down')).toBe(false);
    expect(hasDownSyndrome('ánimo down por duelo reciente')).toBe(false);
    expect(hasDownSyndrome('anda medio down')).toBe(false);
    // Pero si coexiste el diagnóstico real, sí lo detecta.
    expect(hasDownSyndrome('Trisomía 21; a veces se siente down')).toBe(true);
  });
});

describe('orquestador: enruta Down a Zemel y adulto tras 20 años', () => {
  const base = { gender: 'F', birthDate: '2020-01-01' };
  it('Down + 10 años → estándar zemel', () => {
    const a = assessPatientMeasurement({ ...base, measurementDate: '2030-01-01', weightKg: 30, heightCm: 130, pathologies: 'Síndrome de Down' });
    expect(a?.standard).toBe('zemel');
  });
  it('sin Down → estándar OMS (no zemel)', () => {
    const a = assessPatientMeasurement({ ...base, measurementDate: '2023-01-01', weightKg: 12, heightCm: 88, pathologies: 'Asma' });
    expect(a?.standard).not.toBe('zemel');
  });
  it('Down + 20 años y 1 día → null (usa panel de adulto)', () => {
    const a = assessPatientMeasurement({ gender: 'F', birthDate: '2000-01-01', measurementDate: '2020-01-02', weightKg: 60, heightCm: 150, pathologies: 'Síndrome de Down' });
    expect(a).toBeNull();
  });
});
