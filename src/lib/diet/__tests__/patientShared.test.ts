import { describe, it, expect } from 'vitest';
import {
  describeRelativeDay,
  normalizeSharedDiet,
  pickClosestPlanIndex,
  recipesByMeal,
} from '../patientPlan';

// Tres reglas que deciden qué come el paciente hoy:
//
//   · Que la pantalla no se quede vacía mientras el SQL y el despliegue no
//     coinciden en el tiempo.
//   · Que abra por la fecha correcta. Abrir por la de mañana le haría comer
//     hoy lo de mañana.
//   · Que la foto que ve junto a una comida sea la de SU receta.

describe('describeRelativeDay', () => {
  it('nombra hoy, mañana y ayer', () => {
    expect(describeRelativeDay('2026-08-08', '2026-08-08')).toBe('Hoy');
    expect(describeRelativeDay('2026-08-09', '2026-08-08')).toBe('Mañana');
    expect(describeRelativeDay('2026-08-07', '2026-08-08')).toBe('Ayer');
  });

  it('calla en cuanto se aleja: «hace 23 días» no le sirve para nada', () => {
    expect(describeRelativeDay('2026-08-10', '2026-08-08')).toBe('');
    expect(describeRelativeDay('2026-07-16', '2026-08-08')).toBe('');
  });

  it('cruza el cambio de mes y de año sin equivocarse', () => {
    expect(describeRelativeDay('2026-09-01', '2026-08-31')).toBe('Mañana');
    expect(describeRelativeDay('2026-12-31', '2027-01-01')).toBe('Ayer');
  });

  it('sin fecha no inventa nada', () => {
    expect(describeRelativeDay(null, '2026-08-08')).toBe('');
    expect(describeRelativeDay('no-es-fecha', '2026-08-08')).toBe('');
  });
});

describe('normalizeSharedDiet', () => {
  it('entiende la forma nueva, con listas', () => {
    const d = normalizeSharedDiet({
      first_name: 'María',
      exchange_plans: [{ date: '2026-08-10' }, { date: '2026-08-03' }],
      food_plans: [{ date: '2026-08-11' }],
      recipes: [{ id: 'r1', image_url: 'x.jpg' }],
    });

    expect(d.firstName).toBe('María');
    expect(d.exchangePlans).toHaveLength(2);
    expect(d.foodPlans).toHaveLength(1);
    expect(d.recipes).toHaveLength(1);
  });

  it('entiende la forma vieja, con un solo plan', () => {
    // El SQL y el despliegue no se aplican en el mismo instante. Sin esto,
    // quien abriera su dieta en ese rato vería la pantalla vacía.
    const d = normalizeSharedDiet({
      first_name: 'Luis',
      exchange_plan: { date: '2026-08-10' },
      food_plan: { date: '2026-08-10' },
    });

    expect(d.exchangePlans).toHaveLength(1);
    expect(d.foodPlans).toHaveLength(1);
  });

  it('sin planes deja listas vacías, no undefined', () => {
    const d = normalizeSharedDiet({ first_name: 'Ana' });
    expect(d.exchangePlans).toEqual([]);
    expect(d.foodPlans).toEqual([]);
    expect(d.recipes).toEqual([]);
  });

  it('las calorías se ocultan solo si el servidor dice que no', () => {
    expect(normalizeSharedDiet({}).showCalories).toBe(true);
    expect(normalizeSharedDiet({ show_calories: false }).showCalories).toBe(false);
  });

  it('aguanta una respuesta nula sin romperse', () => {
    expect(normalizeSharedDiet(null).firstName).toBe('');
  });
});

describe('pickClosestPlanIndex', () => {
  const planes = [
    { date: '2026-08-21' },
    { date: '2026-08-14' },
    { date: '2026-08-07' },
  ];

  it('abre por la fecha exacta de hoy si existe', () => {
    expect(pickClosestPlanIndex(planes, '2026-08-14')).toBe(1);
  });

  it('elige la más cercana, no la más reciente', () => {
    // Con planes futuros ya cargados, abrir por el más reciente le haría comer
    // hoy lo de dentro de una semana.
    expect(pickClosestPlanIndex(planes, '2026-08-08')).toBe(2);
    expect(pickClosestPlanIndex(planes, '2026-08-13')).toBe(1);
  });

  it('pasada la última fecha se queda en ella', () => {
    expect(pickClosestPlanIndex(planes, '2026-09-30')).toBe(0);
  });

  it('antes de la primera se queda en la primera que llega', () => {
    expect(pickClosestPlanIndex(planes, '2026-01-01')).toBe(2);
  });

  it('un plan sin fecha no le gana a uno fechado', () => {
    expect(pickClosestPlanIndex([{ date: null }, { date: '2026-08-14' }], '2026-08-14')).toBe(1);
  });

  it('sin planes devuelve 0 en vez de romper', () => {
    expect(pickClosestPlanIndex([], '2026-08-14')).toBe(0);
  });
});

describe('recipesByMeal', () => {
  const recetas = [
    { id: 'r1', name: 'Lomo saltado', image_url: 'lomo.jpg' },
    { id: 'r2', name: 'Quinua', image_url: 'quinua.jpg' },
  ];

  it('asocia cada receta a la comida donde aparece', () => {
    const mapa = recipesByMeal([
      { items: [{ name: 'Arroz' }, { recipe_group: { recipe_id: 'r1' } }] },
      { items: [{ recipe_group: { recipe_id: 'r2' } }] },
    ], recetas);

    expect(mapa.get(0)?.[0].name).toBe('Lomo saltado');
    expect(mapa.get(1)?.[0].name).toBe('Quinua');
  });

  it('no repite la receta aunque tenga varios ingredientes en la misma comida', () => {
    // Al insertar una receta, cada ingrediente queda como un alimento con el
    // mismo marcador. Sin deduplicar, la foto saldría cinco veces.
    const mapa = recipesByMeal([
      { items: [
        { recipe_group: { recipe_id: 'r1' } },
        { recipe_group: { recipe_id: 'r1' } },
        { recipe_group: { recipe_id: 'r1' } },
      ] },
    ], recetas);

    expect(mapa.get(0)).toHaveLength(1);
  });

  it('ignora las recetas que el servidor no devolvió', () => {
    // El servidor solo manda las que tienen foto. Un marcador sin receta
    // correspondiente no debe dejar un hueco roto.
    const mapa = recipesByMeal([{ items: [{ recipe_group: { recipe_id: 'no-existe' } }] }], recetas);
    expect(mapa.size).toBe(0);
  });

  it('una comida sin recetas no aparece en el mapa', () => {
    const mapa = recipesByMeal([{ items: [{ name: 'Arroz' }] }], recetas);
    expect(mapa.has(0)).toBe(false);
  });

  it('aguanta comidas sin items y listas vacías', () => {
    expect(recipesByMeal([{}], recetas).size).toBe(0);
    expect(recipesByMeal(null, recetas).size).toBe(0);
    expect(recipesByMeal([{ items: [{ recipe_group: { recipe_id: 'r1' } }] }], []).size).toBe(0);
  });
});
