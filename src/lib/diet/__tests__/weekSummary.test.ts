import { describe, it, expect } from 'vitest';
import {
  calcPlanTotals,
  describeMeals,
  macroSplit,
  mealCountLabel,
  mealNames,
  summarizeWeek,
} from '../weekSummary';
import type { DietPlan } from '@/components/patient/patientDietTypes';

// Lo que se juega aquí es un número que el nutricionista compara con el
// objetivo del paciente. Si el promedio se calcula mal, la decisión clínica
// que salga de mirarlo también estará mal.

const plan = (id: string, meals: DietPlan['meals']): DietPlan => ({ id, meals });

// Un día de 1 000 kcal repartidas 100 g CHO / 50 g prot / 44,4 g grasa.
const dia1000 = plan('d1', [
  {
    name: 'Desayuno',
    items: [{ name: 'Avena', calories: 400, carbs: 60, protein: 20, fat: 10, quantity: 1 }],
  },
  {
    name: 'Almuerzo',
    items: [{ name: 'Pollo con arroz', calories: 600, carbs: 40, protein: 30, fat: 20, quantity: 1 }],
  },
]);

describe('calcPlanTotals', () => {
  it('multiplica por la cantidad de cada ítem', () => {
    const doble = plan('x', [
      { name: 'Desayuno', items: [{ name: 'Pan', calories: 100, carbs: 20, protein: 3, fat: 1, quantity: 3 }] },
    ]);
    expect(calcPlanTotals(doble)).toEqual({ cal: 300, prot: 9, carbs: 60, fat: 3 });
  });

  it('trata la cantidad ausente como 1, no como 0', () => {
    // Sin esto, un ítem sin cantidad desaparecería del total y la dieta
    // parecería tener menos calorías de las que tiene.
    const sinCantidad = plan('x', [
      { name: 'Cena', items: [{ name: 'Sopa', calories: 250, carbs: 30, protein: 10, fat: 5 }] },
    ]);
    expect(calcPlanTotals(sinCantidad).cal).toBe(250);
  });

  it('aguanta planes vacíos, sin comidas o nulos', () => {
    expect(calcPlanTotals(null)).toEqual({ cal: 0, prot: 0, carbs: 0, fat: 0 });
    expect(calcPlanTotals(plan('x', []))).toEqual({ cal: 0, prot: 0, carbs: 0, fat: 0 });
    expect(calcPlanTotals(plan('x', [{ name: 'Vacía' }]))).toEqual({ cal: 0, prot: 0, carbs: 0, fat: 0 });
  });
});

describe('macroSplit', () => {
  it('reparte sobre las kcal de los macros (4/4/9)', () => {
    // 100 g CHO = 400 kcal, 50 g prot = 200, 44 g grasa = 396 → 996 kcal de macros.
    // 400/996 = 40,2 % → 40 %.
    const split = macroSplit({ cal: 1000, carbs: 100, prot: 50, fat: 44 });
    expect(split.carbPct).toBe(40);
    expect(split.protPct).toBe(20);
    expect(split.fatPct).toBe(40);
  });

  it('ignora las kcal declaradas del plan y usa solo los macros', () => {
    // El mismo reparto aunque `cal` venga inflado: si un alimento trae kcal
    // pero no macros, el porcentaje seguiría sumando 100 en vez de quedarse
    // corto sin explicación.
    const conMacros = macroSplit({ cal: 1000, carbs: 100, prot: 50, fat: 44 });
    const calInflado = macroSplit({ cal: 9999, carbs: 100, prot: 50, fat: 44 });
    expect(calInflado).toEqual(conMacros);
  });

  it('devuelve ceros sin dividir entre cero cuando no hay macros', () => {
    expect(macroSplit({ cal: 500, carbs: 0, prot: 0, fat: 0 })).toEqual({ carbPct: 0, protPct: 0, fatPct: 0 });
  });
});

describe('summarizeWeek — la regla del promedio', () => {
  const semana = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];

  it('divide entre los días CON dieta, no entre siete', () => {
    // ESTA ES LA REGLA. Con 2 días de 1 000 kcal, entre siete daría 286 kcal/día
    // -que se lee como desnutrición- cuando lo cierto es que se planificaron dos
    // días de 1 000. El promedio tiene que ser comparable con el objetivo.
    const resumen = summarizeWeek(
      { '2026-08-11': [dia1000], '2026-08-14': [dia1000] },
      semana,
    );

    expect(resumen).not.toBeNull();
    expect(resumen?.daysWithPlan).toBe(2);
    expect(resumen?.total.cal).toBe(2000);
    expect(resumen?.average.cal).toBe(1000);
    expect(resumen?.average.cal).not.toBe(Math.round(2000 / 7));
  });

  it('devuelve null cuando la semana no tiene ninguna dieta', () => {
    // No devuelve ceros: «no hay dietas» y «comió 0 kcal» son cosas distintas y
    // en una pantalla clínica no pueden verse igual.
    expect(summarizeWeek({}, semana)).toBeNull();
    expect(summarizeWeek({ '2026-09-01': [dia1000] }, semana)).toBeNull();
  });

  it('un día con dos dietas cuenta como UN día, sumando las dos', () => {
    const resumen = summarizeWeek({ '2026-08-11': [dia1000, dia1000] }, semana);
    expect(resumen?.daysWithPlan).toBe(1);
    expect(resumen?.total.cal).toBe(2000);
    expect(resumen?.average.cal).toBe(2000);
  });

  it('ignora las dietas fuera de la semana pedida', () => {
    const resumen = summarizeWeek(
      { '2026-08-11': [dia1000], '2026-08-30': [dia1000] },
      semana,
    );
    expect(resumen?.daysWithPlan).toBe(1);
    expect(resumen?.total.cal).toBe(1000);
  });

  it('un día con lista de dietas vacía no cuenta como día con dieta', () => {
    expect(summarizeWeek({ '2026-08-11': [] }, semana)).toBeNull();
  });

  it('el reparto de macros se calcula sobre el promedio, no sobre el total', () => {
    // Si se calculara sobre el total, el porcentaje sería el mismo — pero lo que
    // se enseña junto al promedio deben ser los gramos del promedio.
    const resumen = summarizeWeek({ '2026-08-11': [dia1000], '2026-08-14': [dia1000] }, semana);
    expect(resumen?.average.carbs).toBe(100);
    expect(resumen?.split.carbPct).toBe(macroSplit(resumen!.average).carbPct);
  });
});

describe('mealNames / describeMeals / mealCountLabel', () => {
  it('descarta comidas sin nombre', () => {
    const p = plan('x', [{ name: 'Desayuno' }, { name: '   ' }, {}, { name: 'Cena' }]);
    expect(mealNames(p)).toEqual(['Desayuno', 'Cena']);
    expect(mealCountLabel(p)).toBe('2 comidas');
  });

  it('usa el singular con una sola comida', () => {
    expect(mealCountLabel(plan('x', [{ name: 'Desayuno' }]))).toBe('1 comida');
  });

  it('corta la lista larga con «+N» para que quepa en la tarjeta del día', () => {
    const p = plan('x', [
      { name: 'Desayuno' }, { name: 'Media mañana' }, { name: 'Almuerzo' },
      { name: 'Lonche' }, { name: 'Cena' }, { name: 'Antes de dormir' },
    ]);
    expect(describeMeals(p, 4)).toBe('Desayuno · Media mañana · Almuerzo · Lonche +2');
  });

  it('devuelve cadena vacía si no hay comidas', () => {
    expect(describeMeals(plan('x', []))).toBe('');
    expect(describeMeals(null)).toBe('');
  });
});
