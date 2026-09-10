// Traduce lo que guarda un plan por intercambios a lo que el paciente necesita
// leer en su celular. Función pura: sin React ni red, para poder fijar en
// pruebas las reglas que aquí importan.
//
// LA DIFERENCIA DE FONDO con la vista del nutricionista: él trabaja con una
// tabla de comidas × grupos donde la mayoría de las celdas están en cero. El
// paciente no tiene por qué ver esos ceros. Aquí se filtra todo lo que no
// aporta: comidas sin ningún intercambio y grupos con cero en esa comida.

import { EXCHANGE_GROUPS } from '@/components/exchanges/exchangeData';
import { scenarioLabel } from '@/lib/exchangePlan';
import { parseLocalDate } from '@/lib/weekRange';

type RawFood = { id: string; name: string; measure?: string | null; grams_raw?: number | null; grams_cooked?: number | null };
type RawGroup = { key: string; label: string; kcal: number; foods: RawFood[] };

const GROUPS_BY_KEY: Record<string, RawGroup> = (EXCHANGE_GROUPS as RawGroup[])
  .reduce((acc, group) => ({ ...acc, [group.key]: group }), {});

export type PatientFood = {
  id: string;
  name: string;
  /** La medida casera: «2 cdas llenas crudas o 1/3 taza cocida». */
  measure: string;
};

export type PatientGroup = {
  key: string;
  label: string;
  /** Cuántos intercambios de este grupo lleva la comida. */
  count: number;
  kcal: number;
  foods: PatientFood[];
};

export type PatientMeal = {
  name: string;
  time: string;
  groups: PatientGroup[];
  totalExchanges: number;
  kcal: number;
};

export type PatientScenario = {
  key: string;
  label: string;
  meals: PatientMeal[];
  kcal: number;
};

type RawScenario = {
  key?: string;
  name?: string;
  meals?: Array<{ name?: string; time?: string; exchanges?: Record<string, unknown> }>;
  active_group_keys?: string[];
  food_list_selections?: Record<string, string[]>;
};

export type RawExchangePlan = {
  title?: string | null;
  date?: string | null;
  scenarios?: RawScenario[] | null;
  active_scenario_key?: string | null;
  meals?: RawScenario['meals'];
  active_group_keys?: string[] | null;
  food_list_selections?: Record<string, string[]> | null;
};

const toCount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * La medida que se le enseña al paciente.
 *
 * Manda la medida casera —cucharadas, tazas— porque es la que puede usar en su
 * cocina. Los gramos van detrás y solo si existen: casi nadie tiene balanza,
 * pero a quien la tenga le sirven.
 */
export const describeFoodMeasure = (food: RawFood): string => {
  const casera = (food.measure || '').trim();
  const gramos = food.grams_raw
    ? `${food.grams_raw} g crudo`
    : food.grams_cooked
      ? `${food.grams_cooked} g cocido`
      : '';

  if (casera && gramos) return `${casera} (${gramos})`;
  return casera || gramos;
};

const buildGroups = (
  exchanges: Record<string, unknown>,
  activeGroupKeys: string[],
  selections: Record<string, string[]>,
): PatientGroup[] => activeGroupKeys
  .map((groupKey) => {
    const group = GROUPS_BY_KEY[groupKey];
    if (!group) return null;

    const count = toCount(exchanges?.[groupKey]);
    if (count <= 0) return null;

    // Solo los alimentos que el nutricionista dejó marcados para este paciente.
    // Sin selección guardada se muestran todos, que es como se comporta el
    // impreso: es mejor ofrecer de más que dejar un grupo vacío.
    const permitidos = selections?.[groupKey];
    const foods = (Array.isArray(permitidos) && permitidos.length > 0
      ? group.foods.filter((food) => permitidos.includes(food.id))
      : group.foods
    ).map((food) => ({ id: food.id, name: food.name, measure: describeFoodMeasure(food) }));

    return { key: group.key, label: group.label, count, kcal: Math.round(count * group.kcal), foods };
  })
  .filter((group): group is PatientGroup => group !== null);

const buildMeals = (scenario: RawScenario): PatientMeal[] => {
  const activeGroupKeys = scenario.active_group_keys || [];
  const selections = scenario.food_list_selections || {};

  return (scenario.meals || [])
    .map((meal) => {
      const groups = buildGroups(meal.exchanges || {}, activeGroupKeys, selections);
      return {
        name: (meal.name || '').trim() || 'Comida',
        time: (meal.time || '').trim(),
        groups,
        totalExchanges: groups.reduce((sum, group) => sum + group.count, 0),
        kcal: groups.reduce((sum, group) => sum + group.kcal, 0),
      };
    })
    // Una comida sin ningún intercambio no se le enseña: en la tabla del
    // nutricionista esas filas existen por comodidad de edición, pero al
    // paciente le dirían "Media tarde: nada", que no es una indicación.
    .filter((meal) => meal.groups.length > 0);
};

/**
 * Los escenarios del plan, listos para pintar.
 *
 * Devuelve lista vacía si no hay nada que enseñar. El orden respeta el del
 * plan, salvo que el escenario marcado como activo por el nutricionista se
 * pone PRIMERO: es el que él considera el habitual.
 */
export const buildPatientScenarios = (plan: RawExchangePlan | null | undefined): PatientScenario[] => {
  if (!plan) return [];

  const raw: RawScenario[] = Array.isArray(plan.scenarios) && plan.scenarios.length > 0
    ? plan.scenarios
    // Planes antiguos, de antes de que existieran los escenarios: sus comidas
    // viven sueltas en el plan.
    : [{ key: 'unico', meals: plan.meals, active_group_keys: plan.active_group_keys || [], food_list_selections: plan.food_list_selections || {} }];

  const scenarios = raw
    .map((scenario, index) => ({
      key: scenario.key || `s${index}`,
      raw: scenario,
      meals: buildMeals(scenario),
    }))
    .filter((scenario) => scenario.meals.length > 0);

  const activeKey = plan.active_scenario_key;
  const activo = activeKey ? scenarios.filter((scenario) => scenario.key === activeKey) : [];
  const ordenados = activo.length > 0
    ? [...activo, ...scenarios.filter((scenario) => scenario.key !== activeKey)]
    : scenarios;

  // El nombre se pone DESPUÉS de ordenar. Cuando el nutricionista deja los
  // escenarios sin nombre, la etiqueta cae en «Opción N»; numerando antes, un
  // plan con el tercero marcado como activo le salía al paciente como
  // «Opción 3, Opción 1, Opción 2».
  return ordenados.map((scenario, posicion) => ({
    key: scenario.key,
    label: scenarioLabel(scenario.raw, posicion, 'Opción'),
    meals: scenario.meals,
    kcal: scenario.meals.reduce((sum, meal) => sum + meal.kcal, 0),
  }));
};

export type DatedPlan = { id?: string; title?: string | null; date?: string | null };

export type SharedRecipe = {
  id: string;
  name?: string | null;
  image_url?: string | null;
  prep_time?: string | null;
  servings?: number | null;
};

export type NormalizedSharedDiet = {
  firstName: string;
  showCalories: boolean;
  brandName: string | null;
  brandLogoUrl: string | null;
  exchangePlans: RawExchangePlan[];
  foodPlans: Array<DatedPlan & { meals?: unknown[] }>;
  recipes: SharedRecipe[];
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Normaliza lo que devuelve el servidor.
 *
 * Aguanta DOS formas a propósito: la primera versión devolvía un solo plan de
 * cada tipo (`exchange_plan`, `food_plan`) y la actual devuelve listas
 * (`exchange_plans`, `food_plans`). El SQL y el despliegue no se aplican en el
 * mismo instante, así que durante ese rato conviven; sin esto, quien abriera su
 * dieta en medio vería la pantalla vacía.
 */
export const normalizeSharedDiet = (raw: Record<string, unknown> | null | undefined): NormalizedSharedDiet => {
  const data = raw || {};

  const exchangePlans = asArray<RawExchangePlan>(data.exchange_plans);
  const foodPlans = asArray<DatedPlan & { meals?: unknown[] }>(data.food_plans);

  return {
    firstName: String(data.first_name || '').trim(),
    showCalories: data.show_calories !== false,
    brandName: (data.brand_name as string) || null,
    brandLogoUrl: (data.brand_logo_url as string) || null,
    exchangePlans: exchangePlans.length > 0
      ? exchangePlans
      : data.exchange_plan ? [data.exchange_plan as RawExchangePlan] : [],
    foodPlans: foodPlans.length > 0
      ? foodPlans
      : data.food_plan ? [data.food_plan as DatedPlan & { meals?: unknown[] }] : [],
    recipes: asArray<SharedRecipe>(data.recipes),
  };
};

/**
 * Cuál de las fechas se abre primero: la MÁS CERCANA A HOY.
 *
 * No la más reciente. El nutricionista prepara varias fechas por adelantado, y
 * si el plan de mañana ya está cargado, abrir por él le haría comer hoy lo de
 * mañana. Y al revés: pasada la última fecha, se queda en ella en vez de dejar
 * la pantalla vacía.
 */
export const pickClosestPlanIndex = (
  plans: ReadonlyArray<{ date?: string | null }>,
  today: string,
): number => {
  if (plans.length === 0) return 0;

  const hoy = Date.parse(`${today}T12:00:00`);
  let mejor = 0;
  let mejorDistancia = Number.POSITIVE_INFINITY;

  plans.forEach((plan, index) => {
    const fecha = plan?.date ? Date.parse(`${plan.date}T12:00:00`) : Number.NaN;
    // Un plan sin fecha no puede ganarle a uno fechado, pero sirve de último
    // recurso si ninguno la tiene.
    const distancia = Number.isNaN(fecha) ? Number.MAX_SAFE_INTEGER : Math.abs(fecha - hoy);
    if (distancia < mejorDistancia) {
      mejorDistancia = distancia;
      mejor = index;
    }
  });

  return mejor;
};

/**
 * «Hoy», «Mañana», «Ayer» — y nada más.
 *
 * El paciente reconoce esas tres palabras antes que cualquier fecha, y son las
 * únicas que le sirven para decidir qué come. «Hace 23 días» no le aporta nada
 * y llenaría la lista de ruido.
 */
export const describeRelativeDay = (
  dateStr: string | null | undefined,
  todayStr: string,
): string => {
  const fecha = parseLocalDate(dateStr);
  const hoy = parseLocalDate(todayStr);
  if (!fecha || !hoy) return '';

  // Se redondea porque entre dos medianoches puede haber 23 o 25 horas si en
  // medio cambió el horario de verano.
  const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return '';
};

/** Las recetas de un plan, por id, para pintarlas junto a su comida. */
export const recipesByMeal = (
  meals: ReadonlyArray<{ items?: ReadonlyArray<Record<string, unknown>> }> | null | undefined,
  recipes: ReadonlyArray<SharedRecipe>,
): Map<number, SharedRecipe[]> => {
  const porComida = new Map<number, SharedRecipe[]>();
  if (!Array.isArray(meals) || recipes.length === 0) return porComida;

  const porId = new Map(recipes.map((recipe) => [String(recipe.id), recipe]));

  meals.forEach((meal, index) => {
    const vistas = new Set<string>();
    const encontradas: SharedRecipe[] = [];

    for (const item of meal?.items || []) {
      const marcador = item?.recipe_group as { recipe_id?: string } | undefined;
      const id = marcador?.recipe_id ? String(marcador.recipe_id) : '';
      if (!id || vistas.has(id)) continue;

      const receta = porId.get(id);
      if (!receta) continue;

      vistas.add(id);
      encontradas.push(receta);
    }

    if (encontradas.length > 0) porComida.set(index, encontradas);
  });

  return porComida;
};

/** Todos los grupos del día con su total, para la pestaña de resumen. */
export const summarizeScenarioGroups = (scenario: PatientScenario | null | undefined): PatientGroup[] => {
  if (!scenario) return [];

  const porGrupo = new Map<string, PatientGroup>();
  for (const meal of scenario.meals) {
    for (const group of meal.groups) {
      const previo = porGrupo.get(group.key);
      if (previo) {
        previo.count += group.count;
        previo.kcal += group.kcal;
      } else {
        porGrupo.set(group.key, { ...group });
      }
    }
  }

  return [...porGrupo.values()];
};
