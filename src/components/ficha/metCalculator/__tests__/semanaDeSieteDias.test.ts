import { describe, it, expect } from 'vitest';
import { applyWeekDaysChange, getMaxWeekDaysFor, MAX_WEEK_DAYS } from '../logic';
import type { MetDay } from '../types';

// LA SEMANA TIENE SIETE DÍAS.
//
// Cada perfil declara cuántos días de la semana representa, y con eso se pondera
// el NAF. El tope se aplicaba a cada perfil por separado (1–7), pero no a la
// SUMA: con siete perfiles se podía llegar a 49 días de semana. La pantalla ya
// avisaba ("15 / 7 días") pero dejaba hacerlo igual.
//
// El reparto ponderado se normaliza por el total, así que un total de 15 no da
// un número absurdo: da uno que NO corresponde a la semana que el nutricionista
// cree haber descrito. Si marca 3 días de "día activo" sobre un total de 15, ese
// perfil pesa el 20% en vez del 43% que él quiso.

const dia = (id: string, weekDays: number): MetDay => ({
  id,
  label: id,
  activities: [],
  weekDays,
});

describe('getMaxWeekDaysFor — nunca se pasa de siete', () => {
  it('con un solo perfil, puede ocupar la semana entera', () => {
    const dias = [dia('a', 1)];

    expect(getMaxWeekDaysFor(dias, 'a')).toBe(7);
  });

  it('descuenta lo que ya ocupan los demás perfiles', () => {
    // b y c ocupan 2 + 3 = 5; a a lo sumo puede llegar a 2.
    const dias = [dia('a', 1), dia('b', 2), dia('c', 3)];

    expect(getMaxWeekDaysFor(dias, 'a')).toBe(2);
  });

  it('con siete perfiles de un día, ninguno puede crecer', () => {
    const dias = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => dia(id, 1));

    for (const { id } of dias) {
      expect(getMaxWeekDaysFor(dias, id), id).toBe(1);
    }
  });

  it('el caso del informe: 1+3+4+4+1+1+1 = 15 no se puede volver a subir', () => {
    const dias = [
      dia('d1', 1), dia('d2', 3), dia('d3', 4), dia('d4', 4),
      dia('d5', 1), dia('d6', 1), dia('d7', 1),
    ];

    // Ya está pasado de la semana: el tope no deja crecer más a ninguno.
    for (const { id } of dias) {
      expect(getMaxWeekDaysFor(dias, id), id).toBe(1);
    }
  });

  it('nunca devuelve menos de un día', () => {
    const dias = [dia('a', 4), dia('b', 4), dia('c', 4)];

    expect(getMaxWeekDaysFor(dias, 'a')).toBeGreaterThanOrEqual(1);
  });

  it('un perfil que no existe no rompe el cálculo', () => {
    const dias = [dia('a', 2)];

    expect(getMaxWeekDaysFor(dias, 'inexistente')).toBeLessThanOrEqual(MAX_WEEK_DAYS);
  });
});

describe('applyWeekDaysChange — subir y bajar el reparto', () => {
  const semana = (dias: MetDay[]) => dias.reduce((suma, d) => suma + (d.weekDays ?? 1), 0);

  it('sube mientras quede sitio en la semana', () => {
    const dias = [dia('a', 1), dia('b', 1)];

    const despues = applyWeekDaysChange(dias, 'a', 1);

    expect(despues.find((d) => d.id === 'a')?.weekDays).toBe(2);
    expect(semana(despues)).toBe(3);
  });

  it('NO sube si la semana ya está repartida', () => {
    // 6 + 1 = 7: no cabe nada más.
    const dias = [dia('a', 6), dia('b', 1)];

    const despues = applyWeekDaysChange(dias, 'a', 1);

    expect(despues.find((d) => d.id === 'a')?.weekDays).toBe(6);
    expect(semana(despues)).toBe(7);
  });

  it('nunca baja de un día', () => {
    const dias = [dia('a', 1), dia('b', 3)];

    expect(applyWeekDaysChange(dias, 'a', -1).find((d) => d.id === 'a')?.weekDays).toBe(1);
  });

  // Datos guardados antes del arreglo pueden venir pasados de siete. Se deben
  // poder corregir de a poco, no saltar de golpe a 1.
  it('unos datos ya pasados de siete se bajan de uno en uno', () => {
    const dias = [dia('a', 4), dia('b', 4), dia('c', 4)]; // 12 días

    const despues = applyWeekDaysChange(dias, 'a', -1);

    expect(despues.find((d) => d.id === 'a')?.weekDays).toBe(3);
    expect(semana(despues)).toBe(11);
  });

  it('no toca los demás perfiles', () => {
    const dias = [dia('a', 1), dia('b', 2)];

    const despues = applyWeekDaysChange(dias, 'a', 1);

    expect(despues.find((d) => d.id === 'b')?.weekDays).toBe(2);
  });
});
