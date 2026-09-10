import { describe, it, expect } from 'vitest';
import { buildPatientScenarios, describeFoodMeasure, summarizeScenarioGroups } from '../patientPlan';

// Esto es lo que el paciente lee en su celular para saber qué comer. Los tres
// riesgos que se fijan aquí:
//
//   · Que le aparezca una comida vacía ("Media tarde: nada"), que no es una
//     indicación sino ruido de la tabla de edición del nutricionista.
//   · Que le aparezcan alimentos que su nutricionista NO le dejó marcados.
//   · Que le abra un escenario que no es el que su nutricionista considera el
//     habitual.

const planConDosEscenarios = {
  active_scenario_key: 's2',
  scenarios: [
    {
      key: 's1',
      name: 'Días de descanso',
      active_group_keys: ['cereales_tuberculos', 'frutas'],
      food_list_selections: {},
      meals: [
        { name: 'Desayuno', time: '08:00', exchanges: { cereales_tuberculos: 2, frutas: 1 } },
        { name: 'Media mañana', time: '10:30', exchanges: { cereales_tuberculos: 0, frutas: 0 } },
      ],
    },
    {
      key: 's2',
      name: 'Días de entrenamiento',
      active_group_keys: ['cereales_tuberculos'],
      food_list_selections: {},
      meals: [{ name: 'Desayuno', time: '07:00', exchanges: { cereales_tuberculos: 3 } }],
    },
  ],
};

describe('buildPatientScenarios', () => {
  it('abre por el escenario que el nutricionista marcó como activo', () => {
    // Si abriera por el primero de la lista, el paciente seguiría el plan
    // equivocado sin enterarse.
    const escenarios = buildPatientScenarios(planConDosEscenarios);
    expect(escenarios[0].key).toBe('s2');
    expect(escenarios[0].label).toBe('Días de entrenamiento');
    expect(escenarios).toHaveLength(2);
  });

  it('numera las opciones sin nombre en el orden en que se ven', () => {
    // El activo se pone primero. Si se numerara antes de ordenar, un plan con
    // el tercero marcado como activo le saldría al paciente como
    // «Opción 3, Opción 1, Opción 2» — que es justo lo que pasaba.
    const comida = { name: 'Desayuno', exchanges: { frutas: 1 } };
    const escenarios = buildPatientScenarios({
      active_scenario_key: 'c',
      scenarios: [
        { key: 'a', active_group_keys: ['frutas'], meals: [comida] },
        { key: 'b', active_group_keys: ['frutas'], meals: [comida] },
        { key: 'c', active_group_keys: ['frutas'], meals: [comida] },
      ],
    });

    expect(escenarios.map((e) => e.key)).toEqual(['c', 'a', 'b']);
    expect(escenarios.map((e) => e.label)).toEqual(['Opción 1', 'Opción 2', 'Opción 3']);
  });

  it('usa el nombre de la tabla, y si no lo hay, «Opción N»', () => {
    const escenarios = buildPatientScenarios({
      scenarios: [{
        key: 'a',
        active_group_keys: ['frutas'],
        meals: [{ name: 'Desayuno', exchanges: { frutas: 1 } }],
      }],
    });
    expect(escenarios[0].label).toBe('Opción 1');
  });

  it('descarta las comidas sin ningún intercambio', () => {
    // "Media tarde" existe en la tabla del nutricionista con todo en cero. Al
    // paciente decirle "Media tarde: nada" no le indica nada.
    const escenarios = buildPatientScenarios(planConDosEscenarios);
    const descanso = escenarios.find((s) => s.key === 's1');
    expect(descanso?.meals.map((m) => m.name)).toEqual(['Desayuno']);
  });

  it('descarta los grupos que están en cero dentro de una comida', () => {
    const escenarios = buildPatientScenarios({
      scenarios: [{
        key: 'a',
        active_group_keys: ['cereales_tuberculos', 'frutas', 'verduras'],
        meals: [{ name: 'Cena', exchanges: { cereales_tuberculos: 2, frutas: 0 } }],
      }],
    });
    expect(escenarios[0].meals[0].groups.map((g) => g.key)).toEqual(['cereales_tuberculos']);
  });

  it('respeta los alimentos que el nutricionista dejó marcados', () => {
    // Enseñarle un alimento que su nutricionista quitó a propósito es darle una
    // indicación que nadie le dio.
    const escenarios = buildPatientScenarios({
      scenarios: [{
        key: 'a',
        active_group_keys: ['cereales_tuberculos'],
        food_list_selections: { cereales_tuberculos: ['ct1'] },
        meals: [{ name: 'Desayuno', exchanges: { cereales_tuberculos: 2 } }],
      }],
    });

    const grupo = escenarios[0].meals[0].groups[0];
    expect(grupo.foods).toHaveLength(1);
    expect(grupo.foods[0].name).toBe('Arroz blanco');
  });

  it('sin selección guardada ofrece todos los del grupo', () => {
    const escenarios = buildPatientScenarios({
      scenarios: [{
        key: 'a',
        active_group_keys: ['cereales_tuberculos'],
        meals: [{ name: 'Desayuno', exchanges: { cereales_tuberculos: 1 } }],
      }],
    });
    expect(escenarios[0].meals[0].groups[0].foods.length).toBeGreaterThan(5);
  });

  it('entiende los planes viejos, sin escenarios', () => {
    // Los planes de antes de que existieran las tablas guardan sus comidas
    // sueltas. Si no se contemplaran, esos pacientes verían la pantalla vacía.
    const escenarios = buildPatientScenarios({
      active_group_keys: ['frutas'],
      meals: [{ name: 'Desayuno', exchanges: { frutas: 2 } }],
    });
    expect(escenarios).toHaveLength(1);
    expect(escenarios[0].meals[0].groups[0].count).toBe(2);
  });

  it('devuelve lista vacía cuando no hay nada que enseñar', () => {
    expect(buildPatientScenarios(null)).toEqual([]);
    expect(buildPatientScenarios({})).toEqual([]);
    expect(buildPatientScenarios({ scenarios: [] })).toEqual([]);
    expect(buildPatientScenarios({
      scenarios: [{ key: 'a', active_group_keys: ['frutas'], meals: [{ name: 'Cena', exchanges: { frutas: 0 } }] }],
    })).toEqual([]);
  });

  it('suma las calorías de la comida y del día', () => {
    const escenarios = buildPatientScenarios({
      scenarios: [{
        key: 'a',
        active_group_keys: ['cereales_tuberculos'],
        meals: [
          { name: 'Desayuno', exchanges: { cereales_tuberculos: 2 } },
          { name: 'Cena', exchanges: { cereales_tuberculos: 1 } },
        ],
      }],
    });
    // Cereales y tubérculos son 77 kcal por intercambio.
    expect(escenarios[0].meals[0].kcal).toBe(154);
    expect(escenarios[0].kcal).toBe(231);
  });

  it('acepta medios intercambios', () => {
    // El editor permite 0,5 y es habitual en desayunos.
    const escenarios = buildPatientScenarios({
      scenarios: [{
        key: 'a',
        active_group_keys: ['frutas'],
        meals: [{ name: 'Desayuno', exchanges: { frutas: 0.5 } }],
      }],
    });
    expect(escenarios[0].meals[0].groups[0].count).toBe(0.5);
  });
});

describe('describeFoodMeasure', () => {
  it('la medida casera va primero y los gramos entre paréntesis', () => {
    // El paciente cocina con tazas y cucharas, no con balanza.
    expect(describeFoodMeasure({ id: 'x', name: 'Arroz', measure: '1/3 taza cocida', grams_raw: 20 }))
      .toBe('1/3 taza cocida (20 g crudo)');
  });

  it('sin gramos deja solo la medida casera', () => {
    expect(describeFoodMeasure({ id: 'x', name: 'Arroz', measure: '1 taza' })).toBe('1 taza');
  });

  it('sin medida casera cae a los gramos', () => {
    expect(describeFoodMeasure({ id: 'x', name: 'Arroz', grams_cooked: 150 })).toBe('150 g cocido');
  });

  it('sin nada devuelve cadena vacía en vez de basura', () => {
    expect(describeFoodMeasure({ id: 'x', name: 'Arroz' })).toBe('');
  });
});

describe('summarizeScenarioGroups', () => {
  it('junta el mismo grupo de varias comidas en un total del día', () => {
    const escenarios = buildPatientScenarios({
      scenarios: [{
        key: 'a',
        active_group_keys: ['cereales_tuberculos', 'frutas'],
        meals: [
          { name: 'Desayuno', exchanges: { cereales_tuberculos: 2, frutas: 1 } },
          { name: 'Almuerzo', exchanges: { cereales_tuberculos: 3 } },
        ],
      }],
    });

    const total = summarizeScenarioGroups(escenarios[0]);
    expect(total.find((g) => g.key === 'cereales_tuberculos')?.count).toBe(5);
    expect(total.find((g) => g.key === 'frutas')?.count).toBe(1);
  });

  it('sin escenario devuelve lista vacía', () => {
    expect(summarizeScenarioGroups(null)).toEqual([]);
  });
});
