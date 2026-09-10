import { describe, expect, it } from 'vitest';
import { classifyZScore, evaluatePediatricIndicator } from '../classification';

describe('clasificación clínica pediátrica (cortes OMS/MINSA)', () => {
  it('Peso/talla (<5): criterio MINSA — normal de −2 a +2 DE', () => {
    expect(classifyZScore('wfl', -3.5).label).toBe('Desnutrido severo');
    expect(classifyZScore('wfl', -2.5).label).toBe('Desnutrido');
    expect(classifyZScore('wfl', 0).label).toBe('Normal');
    expect(classifyZScore('wfl', 1.5).label).toBe('Normal');
    expect(classifyZScore('wfl', 2.5).label).toBe('Sobrepeso');
    expect(classifyZScore('wfl', 3.5).label).toBe('Obesidad');
  });

  it('IMC/edad (5-19): delgadez, sobrepeso y obesidad', () => {
    expect(classifyZScore('bmi', -3.5).label).toBe('Delgadez severa');
    expect(classifyZScore('bmi', -2.5).label).toBe('Delgadez');
    expect(classifyZScore('bmi', 0).label).toBe('Normal');
    expect(classifyZScore('bmi', 1.5).label).toBe('Sobrepeso');
    expect(classifyZScore('bmi', 2.5).label).toBe('Obesidad');
  });

  it('Talla/edad: desnutrición crónica', () => {
    expect(classifyZScore('lhfa', -3.5).tone).toBe('critical');
    expect(classifyZScore('lhfa', -2.5).label).toBe('Talla baja (desnutrición crónica)');
    expect(classifyZScore('hfa', 0).label).toBe('Talla adecuada');
  });

  it('respeta la convención de bordes (el corte va a la banda menos severa)', () => {
    // z = -2 es NORMAL (no desnutrición); z = -3 es moderada (no severa).
    expect(classifyZScore('bmi', -2).label).toBe('Normal');
    expect(classifyZScore('bmi', -3).label).toBe('Delgadez');
    expect(classifyZScore('wfl', 1).label).toBe('Normal');
    expect(classifyZScore('wfl', 2).label).toBe('Normal');
    expect(classifyZScore('wfl', 2.01).label).toBe('Sobrepeso');
  });

  it('Perímetro cefálico: micro / normal / macro', () => {
    expect(classifyZScore('hcfa', -2.5).label).toBe('Microcefalia');
    expect(classifyZScore('hcfa', 0).label).toBe('Normal');
    expect(classifyZScore('hcfa', 2.5).label).toBe('Macrocefalia');
  });

  it('Perímetro braquial (MUAC): interpretación binaria OMS 1997', () => {
    expect(classifyZScore('acfa', -2.5).label).toBe('Desnutrición');
    expect(classifyZScore('acfa', -1.5).label).toBe('Sin desnutrición');
    expect(classifyZScore('acfa', 0).label).toBe('Sin desnutrición');
  });

  it('Pliegues (tricipital/subescapular)', () => {
    expect(classifyZScore('tsfa', -2.5).label).toBe('Desnutrición');
    expect(classifyZScore('ssfa', 0).label).toBe('Normal');
    expect(classifyZScore('ssfa', 2.5).label).toBe('Riesgo de obesidad');
  });

  it('perímetro del brazo: ejemplos oficiales OMS (validación)', () => {
    // Niña 1a2m (14 meses), brazo 11.9 cm → esperado: Desnutrición (< -2 DE)
    const a = evaluatePediatricIndicator('acfa', 'girls', 14, 11.9);
    // Niña 4a8m (56 meses), brazo 14.1 cm → esperado: Sin desnutrición (≈ -1 DE)
    const b = evaluatePediatricIndicator('acfa', 'girls', 56, 14.1);
    // eslint-disable-next-line no-console
    console.log(`  brazo niña 14m 11.9cm → z=${a?.zScore?.toFixed(2)} · ${a?.classification.label}`);
    // eslint-disable-next-line no-console
    console.log(`  brazo niña 56m 14.1cm → z=${b?.zScore?.toFixed(2)} · ${b?.classification.label}`);
    expect(a?.classification.label).toBe('Desnutrición');
    expect(b?.classification.label).toBe('Sin desnutrición');
  });

  it('evaluación end-to-end coincide con los ejemplos clínicos verificados', () => {
    // Niña 12 años (144m), IMC 26 → z ≈ +2.19 → Obesidad
    const obese = evaluatePediatricIndicator('bmi', 'girls', 144, 26);
    expect(obese?.classification.label).toBe('Obesidad');
    expect(obese?.zScore).toBeGreaterThan(2);

    // Niño 24 meses, 12.0 kg → z ≈ -0.11 → Peso adecuado
    const normal = evaluatePediatricIndicator('wfa', 'boys', 24, 12.0);
    expect(normal?.classification.label).toBe('Peso adecuado');

    // Niño 8 años (96m), IMC 17 → z ≈ +0.77 → Normal
    const ok = evaluatePediatricIndicator('bmi', 'boys', 96, 17);
    expect(ok?.classification.label).toBe('Normal');
  });
});
