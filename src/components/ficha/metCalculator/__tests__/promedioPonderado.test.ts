// El NAF que se aplica al requerimiento sale de PROMEDIAR los perfiles de día.
// Era un promedio simple, y eso afirmaba sin decirlo que el paciente vive la
// misma cantidad de días en cada perfil: un sábado de gimnasio pesaba igual que
// los cinco días de oficina. Ahora cada perfil declara cuántos días de la
// semana representa (`weekDays`) y el promedio es ponderado.
//
// Las dos pruebas que de verdad importan son las dos primeras: que el reparto
// por defecto NO cambie ningún número ya guardado, y que ponderar arregle el
// caso del paciente que entrena dos días.
import { describe, expect, it } from 'vitest';

import { ACTIVITY_GROUPS, buildAverageCalculation, buildCalculation, getActivityGroup, getWeekDays } from '../logic';
import type { NafCalculation } from '../types';

const calc = (naf: number, totalMetHours = naf * 24): NafCalculation => ({
  naf,
  factor: 1,
  totalMetHours,
});

describe('promedio ponderado de los perfiles de día', () => {
  it('sin tocar el reparto da exactamente el promedio simple de antes', () => {
    // Los tres días tipo de las plantillas rápidas.
    const entries = [calc(1.21), calc(1.43), calc(1.77)].map((calculation) => ({ calculation, weekDays: 1 }));
    // (1.21 + 1.43 + 1.77) / 3 = 1.47
    expect(buildAverageCalculation(entries).naf).toBe(1.47);
  });

  it('pondera por los días que representa cada perfil', () => {
    // Paciente que entrena martes y jueves: 2 días de entreno, 5 normales.
    const entrena = { calculation: calc(2.1), weekDays: 2 };
    const normal = { calculation: calc(1.3), weekDays: 5 };

    // Sin ponderar salía 1.70, como si entrenara tres días y medio.
    expect(buildAverageCalculation([
      { ...entrena, weekDays: 1 },
      { ...normal, weekDays: 1 },
    ]).naf).toBe(1.7);

    // Ponderado: (2×2.10 + 5×1.30) / 7 = 1.5285…
    expect(buildAverageCalculation([entrena, normal]).naf).toBe(1.53);
  });

  it('la diferencia son calorías reales en el plan', () => {
    const basalKcal = 1701;
    const perfiles = [
      { calculation: calc(2.1), weekDays: 2 },
      { calculation: calc(1.3), weekDays: 5 },
    ];

    const simple = Math.round(basalKcal * buildAverageCalculation(perfiles.map((p) => ({ ...p, weekDays: 1 }))).naf);
    const ponderado = Math.round(basalKcal * buildAverageCalculation(perfiles).naf);

    expect(simple).toBe(2892);
    expect(ponderado).toBe(2603);
    expect(simple - ponderado).toBe(289);
  });

  it('un solo perfil no se ve afectado por su reparto', () => {
    const solo = buildCalculation(34.4);
    expect(buildAverageCalculation([{ calculation: solo, weekDays: 1 }]).naf).toBe(solo.naf);
    expect(buildAverageCalculation([{ calculation: solo, weekDays: 5 }]).naf).toBe(solo.naf);
  });

  it('sin perfiles no hay NAF', () => {
    expect(buildAverageCalculation([]).naf).toBe(0);
  });

  it('promedia también las MET·h con el mismo peso', () => {
    const entries = [
      { calculation: calc(1.5, 36), weekDays: 5 },
      { calculation: calc(2, 48), weekDays: 2 },
    ];
    // (5×36 + 2×48) / 7 = 39.43
    expect(buildAverageCalculation(entries).totalMetHours).toBe(39.4);
  });
});

describe('getWeekDays', () => {
  it('un perfil guardado antes del campo cuenta como un día', () => {
    // Es lo que hace compatible el cambio: los requerimientos ya guardados no
    // traen `weekDays` y deben seguir dando el mismo NAF.
    expect(getWeekDays({})).toBe(1);
    expect(getWeekDays({ weekDays: undefined })).toBe(1);
  });

  it('acota el reparto a la semana (1 a 7)', () => {
    expect(getWeekDays({ weekDays: 0 })).toBe(1);
    expect(getWeekDays({ weekDays: -3 })).toBe(1);
    expect(getWeekDays({ weekDays: 9 })).toBe(7);
    expect(getWeekDays({ weekDays: 3 })).toBe(3);
  });

  it('ignora valores que no son números', () => {
    expect(getWeekDays({ weekDays: Number.NaN })).toBe(1);
  });
});

// La barra de 24 h se colorea por TIPO de actividad, no por intensidad: el día
// de una persona normal es entero de menos de 3 MET y por intensidad salía de
// un solo color. Este mapa es el que reparte las 22 categorías del compendio en
// los seis tipos que tienen color.
describe('getActivityGroup', () => {
  it('reparte las categorías del compendio en los seis tipos', () => {
    expect(getActivityGroup('Inactividad').id).toBe('descanso');
    expect(getActivityGroup('Ocupación').id).toBe('trabajo');
    expect(getActivityGroup('Actividades en casa').id).toBe('casa');
    expect(getActivityGroup('Cuidados personales').id).toBe('casa');
    expect(getActivityGroup('Transporte').id).toBe('traslados');
    expect(getActivityGroup('Ciclismo').id).toBe('ejercicio');
    expect(getActivityGroup('Caminando').id).toBe('ejercicio');
    expect(getActivityGroup('Ejercicio de acondicionamiento').id).toBe('ejercicio');
  });

  it('lo que no está clasificado cae en ocio, nunca sin color', () => {
    expect(getActivityGroup('Misceláneas').id).toBe('ocio');
    expect(getActivityGroup('Juegos de vídeo').id).toBe('ocio');
    expect(getActivityGroup('Una categoría que no existe').id).toBe('ocio');
  });

  it('cada tipo tiene un color propio', () => {
    const colores = ACTIVITY_GROUPS.map((group) => group.color);
    expect(new Set(colores).size).toBe(ACTIVITY_GROUPS.length);
  });
});
