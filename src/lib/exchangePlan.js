import { EXCHANGE_GROUPS, DEFAULT_GROUP_KEYS, createDefaultMeals } from "@/components/exchanges/exchangeData";

// Lógica pura del plan por intercambios (sin React/JSX): IDs, normalización de
// escenarios/selecciones, resolución de medición por fecha, snapshot para
// detectar cambios y presets visuales de los tiempos de comida. Extraído de
// ExchangeDietCreator para aislar la lógica de la UI y poder reusarla/testearla.

export const generateId = () => Math.random().toString(36).substring(2, 9);
export const MAX_SCENARIOS = 3;
export const DEFAULT_EXCHANGE_PLAN_TITLE = "Plan por Intercambios";

export const reorderItems = (items, sourceIndex, destinationIndex) => {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);

  nextItems.splice(destinationIndex, 0, movedItem);
  return nextItems;
};

const EXCHANGE_GROUPS_BY_KEY = EXCHANGE_GROUPS.reduce((acc, group) => {
  acc[group.key] = group;
  return acc;
}, {});

export const getOrderedGroups = (groupKeys = []) => groupKeys
  .map((groupKey) => EXCHANGE_GROUPS_BY_KEY[groupKey])
  .filter(Boolean);

// El buscador debe encontrar coincidencias aunque el usuario escriba sin tildes.
export const normalizeSearchValue = (value = "") => value
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLowerCase();

export const buildPatientDisplayName = (patient) => {
  if (!patient) return "";
  return patient.full_name || `${patient.first_name || patient.name || ""} ${patient.last_name || ""}`.trim();
};

export const buildDefaultSelections = () => (
  EXCHANGE_GROUPS.reduce((acc, group) => ({ ...acc, [group.key]: group.foods.map((food) => food.id) }), {})
);

export const cloneMeals = (sourceMeals = []) => sourceMeals.map((meal) => ({
  ...meal,
  exchanges: { ...(meal.exchanges || {}) },
  items: Array.isArray(meal.items) ? meal.items.map((item) => ({ ...item })) : meal.items,
}));

export const normalizeSelections = (sourceSelections) => {
  const defaults = buildDefaultSelections();

  return EXCHANGE_GROUPS.reduce((acc, group) => ({
    ...acc,
    [group.key]: Array.isArray(sourceSelections?.[group.key])
      ? [...sourceSelections[group.key]]
      : defaults[group.key],
  }), {});
};

// Largo máximo del nombre de una tabla. Cabe en la pestaña sin romper la barra
// y sigue permitiendo algo descriptivo ("Días de entrenamiento").
export const MAX_SCENARIO_NAME = 40;

export const normalizeScenario = (scenario = {}) => ({
  key: typeof scenario.key === "string" && scenario.key ? scenario.key : generateId(),
  // Nombre opcional de la tabla. Antes no existía: el editor las numeraba al
  // vuelo ("Tabla 1", "Tabla 2") y qué significaba cada una vivía solo en la
  // cabeza del nutricionista. Eso basta mientras solo lo mire él, pero no
  // cuando la dieta se le enseñe al paciente: tres tablas sin nombre no le
  // dicen cuál seguir hoy, y acabaría siguiendo siempre la primera.
  name: typeof scenario.name === "string" ? scenario.name.trim().slice(0, MAX_SCENARIO_NAME) : "",
  meals: Array.isArray(scenario.meals) && scenario.meals.length ? cloneMeals(scenario.meals) : createDefaultMeals(),
  active_group_keys: Array.isArray(scenario.active_group_keys) && scenario.active_group_keys.length
    ? [...scenario.active_group_keys]
    : [...DEFAULT_GROUP_KEYS],
  food_list_selections: normalizeSelections(scenario.food_list_selections),
});

/**
 * Cómo se llama una tabla allí donde se muestre.
 *
 * Si tiene nombre, manda el nombre. Si no, cae a un genérico numerado, y el
 * genérico depende de DÓNDE se lee: en el editor son pestañas ("Tabla 2"), en
 * el impreso son documentos ("Plan Alimenticio 2") y al paciente hay que
 * ofrecerle una elección ("Opción 2"). La misma palabra no sirve en los tres
 * sitios, y bajar el impreso a "Opción 2" empeoraría el PDF de quien no use
 * nombres — que hoy son todos.
 */
export const scenarioLabel = (scenario, index, fallbackPrefix = "Tabla") => {
  const name = (scenario?.name || "").trim();
  return name || `${fallbackPrefix} ${index + 1}`;
};

export const buildLegacyScenario = ({ meals, active_group_keys, food_list_selections }) => normalizeScenario({
  meals,
  active_group_keys,
  food_list_selections,
});

export const normalizeLoadedScenarios = (rawScenarios, legacyPlan) => {
  if (Array.isArray(rawScenarios) && rawScenarios.length > 0) {
    return rawScenarios.slice(0, MAX_SCENARIOS).map((scenario) => normalizeScenario(scenario));
  }

  return [buildLegacyScenario(legacyPlan)];
};

const asMeasurementArray = (measurements) => Array.isArray(measurements) ? measurements : [];

export const resolveMeasurementForPlanDate = (measurements, targetDate) => {
  const datedMeasurements = asMeasurementArray(measurements)
    .filter((measurement) => measurement?.date)
    .sort((left, right) => new Date(`${right.date}T12:00:00`).getTime() - new Date(`${left.date}T12:00:00`).getTime());

  if (datedMeasurements.length === 0) {
    return null;
  }

  if (!targetDate) {
    return datedMeasurements[0] || null;
  }

  const exactMatch = datedMeasurements.find((measurement) => measurement.date === targetDate);
  if (exactMatch) {
    return exactMatch;
  }

  const targetTime = new Date(`${targetDate}T12:00:00`).getTime();
  const latestPrevious = datedMeasurements.find((measurement) => new Date(`${measurement.date}T12:00:00`).getTime() <= targetTime);

  return latestPrevious || datedMeasurements[0] || null;
};

export const buildPlanSnapshot = ({ title, date, scenarios, activeScenarioId }) => JSON.stringify({
  title: title || "",
  date: date || "",
  scenarios: (scenarios || []).map((scenario) => normalizeScenario(scenario)),
  activeScenarioId: activeScenarioId || "",
});

// Presets visuales por tiempo de comida (colores/badge) — se eligen por el
// nombre normalizado de la comida, con fallback rotando por índice.
export const MEAL_VISUAL_PRESETS = [
  {
    tokens: ["desayuno"],
    badge: "🌅",
    accent: "from-[#ffe49c] to-[#ffc85a]",
    text: "text-[#9b6810]",
    surface: "bg-[#fff9eb]",
    border: "border-[#ffe1a6]",
  },
  {
    tokens: ["media manana", "media mañana"],
    badge: "🍎",
    accent: "from-[#ffd9d6] to-[#ffb3a6]",
    text: "text-[#b85d48]",
    surface: "bg-[#fff6f4]",
    border: "border-[#ffd8ce]",
  },
  {
    tokens: ["almuerzo"],
    badge: "🍽️",
    accent: "from-[#d7f3e5] to-[#afe4c9]",
    text: "text-[#247c58]",
    surface: "bg-[#f4fcf7]",
    border: "border-[#cfe9dc]",
  },
  {
    tokens: ["media tarde"],
    badge: "🥤",
    accent: "from-[#ddebff] to-[#b4d7ff]",
    text: "text-[#366c9e]",
    surface: "bg-[#f5f9ff]",
    border: "border-[#d8e7fb]",
  },
  {
    tokens: ["cena"],
    badge: "🌙",
    accent: "from-[#e6ddff] to-[#c7c1ff]",
    text: "text-[#6352b6]",
    surface: "bg-[#f8f6ff]",
    border: "border-[#e5defb]",
  },
];

export const getMealVisualPreset = (mealName = "", index = 0) => {
  const normalizedMealName = normalizeSearchValue(mealName);
  const matchedPreset = MEAL_VISUAL_PRESETS.find((preset) => (
    preset.tokens.some((token) => normalizedMealName.includes(token))
  ));

  return matchedPreset || MEAL_VISUAL_PRESETS[index % MEAL_VISUAL_PRESETS.length];
};
