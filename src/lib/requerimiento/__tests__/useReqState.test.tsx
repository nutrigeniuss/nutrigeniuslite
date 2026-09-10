import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReqState } from '../useReqState';

// EL FACTOR APLICADO SE PERDIA AL VOLVER A LA PANTALLA.
//
// El nutricionista dejaba "Factor directo 1.29" (el NAF del panel MET), se iba
// a la dieta por intercambios y al volver encontraba "Sedentario x1.2" con un
// total distinto: 1784 kcal se convertian en 1682. Y ese total equivocado se
// guardaba, asi que las dietas lo adoptaban despues.
//
// Habia DOS sitios que lo forzaban a false, y arreglar solo uno no bastaba:
//   1. el valor inicial del useState
//   2. el efecto que rehidrata al cambiar de consulta o al remontar
//
// Estas pruebas cubren los dos.

const CONSULTA_CON_FACTOR_MANUAL = {
  date: '2026-08-02',
  weight: 48.3,
  height: 152,
  requirement: {
    activity_level: 'Sedentario',
    activity_factor: 1.29,
    use_custom_factor: true,
    calorie_adjustment: 330,
    selected_formula: 'Mifflin-St Jeor',
    target_calories: 1784,
  },
};

const PACIENTE = { id: 'p1', measurements: [CONSULTA_CON_FACTOR_MANUAL] };

describe('useReqState conserva el factor aplicado', () => {
  it('arranca usando el factor manual guardado', () => {
    const { result } = renderHook(() => useReqState(CONSULTA_CON_FACTOR_MANUAL, PACIENTE));

    expect(result.current.useCustomFactor).toBe(true);
    expect(result.current.customFactor).toBe(1.29);
  });

  // Este es el que fallaba: el efecto de rehidratacion ya corrio y no debe
  // haberlo apagado.
  it('sigue usandolo despues de rehidratar', () => {
    const { result, rerender } = renderHook(() => useReqState(CONSULTA_CON_FACTOR_MANUAL, PACIENTE));

    rerender();

    expect(result.current.useCustomFactor, 'el factor manual se apago solo').toBe(true);
    expect(result.current.customFactor).toBe(1.29);
  });

  it('al cambiar de consulta toma lo de la nueva, no lo de la anterior', () => {
    const otraConsulta = {
      date: '2026-07-01',
      requirement: { activity_level: 'Moderado', use_custom_factor: false },
    };

    const { result, rerender } = renderHook(
      ({ consulta }) => useReqState(consulta, PACIENTE),
      { initialProps: { consulta: CONSULTA_CON_FACTOR_MANUAL as typeof otraConsulta } },
    );

    expect(result.current.useCustomFactor).toBe(true);

    rerender({ consulta: otraConsulta });

    expect(result.current.useCustomFactor).toBe(false);
    expect(result.current.actLevel).toBe('Moderado');
  });

  it('sin nada guardado no inventa un factor manual', () => {
    const sinRequerimiento = { date: '2026-08-02' };
    const { result } = renderHook(() => useReqState(sinRequerimiento, { id: 'p2' }));

    expect(result.current.useCustomFactor).toBe(false);
    expect(result.current.actLevel).toBe('Sedentario');
  });
});
