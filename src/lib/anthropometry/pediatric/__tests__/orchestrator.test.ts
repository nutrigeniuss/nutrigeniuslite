import { describe, expect, it } from 'vitest';
import {
  ageInMonths,
  assessPatientMeasurement,
  evaluatePediatric,
  isPediatric,
  parseSex,
  resolveAgeGroup,
} from '../index';

describe('orquestador pediátrico', () => {
  it('parseSex normaliza los valores del paciente', () => {
    expect(parseSex('Masculino')).toBe('boys');
    expect(parseSex('masculino')).toBe('boys');
    expect(parseSex('Niño')).toBe('boys');
    expect(parseSex('Hombre')).toBe('boys');
    expect(parseSex('Varón')).toBe('boys');
    expect(parseSex('Femenino')).toBe('girls');
    expect(parseSex('mujer')).toBe('girls');
    expect(parseSex('Niña')).toBe('girls');
    expect(parseSex('F')).toBe('girls');
    expect(parseSex('')).toBeNull();
    expect(parseSex(null)).toBeNull();
  });

  // M masculino, F femenino, igual que en el panel de adulto y en laboratorio.
  // Este módulo ya leía así la "M"; el de adulto la leía como MUJER, y por eso
  // el mismo paciente podía salir de un sexo en una pestaña y del otro en la de
  // al lado. Ahora los dos usan el mismo parser (lib/patients/sex.js).
  it('la inicial sola: M masculino, F femenino', () => {
    expect(parseSex('M')).toBe('boys');
    expect(parseSex('m')).toBe('boys');
    expect(parseSex('F')).toBe('girls');
    // Y la palabra manda sobre la inicial: "Mujer" empieza por eme.
    expect(parseSex('Mujer')).toBe('girls');
  });

  it('ageInMonths calcula la edad entre fechas', () => {
    expect(ageInMonths('2020-01-01', '2022-01-01')).toBeCloseTo(24, 0);
    expect(ageInMonths('2020-01-01', '2020-07-01')).toBeCloseTo(6, 0);
    expect(ageInMonths(null, '2022-01-01')).toBeNull();
    expect(ageInMonths('2022-01-01', '2020-01-01')).toBeNull(); // medición antes de nacer
  });

  it('resolveAgeGroup e isPediatric segmentan por tramo', () => {
    expect(resolveAgeGroup(12)).toBe('under2');
    expect(resolveAgeGroup(24)).toBe('2to5');
    expect(resolveAgeGroup(60)).toBe('5to19');
    expect(resolveAgeGroup(228)).toBe('5to19');
    expect(resolveAgeGroup(240)).toBeNull(); // 20 años → adulto
    expect(isPediatric(120)).toBe(true);
    expect(isPediatric(300)).toBe(false);
    expect(isPediatric(null)).toBe(false);
  });

  it('<2 años: usa peso/edad, talla/edad, peso/longitud y perímetro cefálico', () => {
    const a = evaluatePediatric({ sex: 'boys', ageMonths: 12, weightKg: 9.6, heightCm: 75, headCircCm: 46 });
    expect(a).not.toBeNull();
    expect(a?.ageGroup).toBe('under2');
    const inds = a?.results.map((r) => r.indicator).sort();
    expect(inds).toEqual(['hcfa', 'lhfa', 'wfa', 'wfl']);
    // Todos deben traer z-score y clasificación
    for (const r of a?.results ?? []) expect(typeof r.zScore).toBe('number');
  });

  it('5-19 años: usa IMC/edad y talla/edad', () => {
    const a = evaluatePediatric({ sex: 'girls', ageMonths: 144, weightKg: 55, heightCm: 150 });
    expect(a?.ageGroup).toBe('5to19');
    const inds = a?.results.map((r) => r.indicator).sort();
    expect(inds).toEqual(['bmi', 'hfa']);
    // IMC = 55 / 1.5^2 = 24.4 → en una niña de 12 años es sobrepeso/obesidad
    const bmi = a?.results.find((r) => r.indicator === 'bmi');
    expect(bmi?.zScore).toBeGreaterThan(1);
  });

  it('assessPatientMeasurement funciona desde los datos crudos del paciente', () => {
    const a = assessPatientMeasurement({
      gender: 'Masculino',
      birthDate: '2022-01-01',
      measurementDate: '2024-01-01', // 24 meses → 2to5
      weightKg: 12.0,
      heightCm: 87,
    });
    expect(a?.ageGroup).toBe('2to5');
    expect(a?.results.some((r) => r.indicator === 'wfh')).toBe(true); // peso/talla por talla
    const peso = a?.results.find((r) => r.indicator === 'wfa');
    expect(peso?.classification.label).toBe('Peso adecuado'); // 12 kg a 24m ≈ z -0.1
  });

  it('borde de 5 años [60, 61) meses: sigue evaluando (no deja el panel vacío)', () => {
    // Las tablas OMS por edad terminan en 60 m (0–5a) y arrancan en 61 m (5–19a),
    // sin solaparse. Un niño de 5 años exactos caía en un hueco → results vacío.
    for (const ageMonths of [60, 60.5, 60.9]) {
      const a = evaluatePediatric({ sex: 'boys', ageMonths, weightKg: 18, heightCm: 110 });
      expect(a).not.toBeNull();
      const inds = a?.results.map((r) => r.indicator).sort();
      expect(inds).toEqual(['bmi', 'hfa']); // ambos indicadores del tramo 5–19a
      for (const r of a?.results ?? []) expect(Number.isFinite(r.zScore)).toBe(true);
    }
  });

  it('adulto (≥19 años) devuelve null', () => {
    expect(evaluatePediatric({ sex: 'boys', ageMonths: 240, weightKg: 70, heightCm: 175 })).toBeNull();
    expect(assessPatientMeasurement({ gender: 'F', birthDate: '2000-01-01', measurementDate: '2026-01-01', weightKg: 60, heightCm: 165 })).toBeNull();
  });
});
