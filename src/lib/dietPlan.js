// Helpers puros del plan de dieta por alimentos (sin React ni Supabase).
// Extraídos de src/pages/DietCreator.jsx para poder testearlos y reutilizarlos.
// Espeja el patrón de @/lib/exchangePlan para el editor por intercambios.

export const DEFAULT_DIET_PLAN_TITLE = "Plan Alimentario";

export const DEFAULT_MEALS = [
  { id: "m1", name: "Desayuno",    time: "08:00", items: [] },
  { id: "m2", name: "Almuerzo",    time: "13:00", items: [] },
  { id: "m3", name: "Merienda",    time: "16:00", items: [] },
  { id: "m4", name: "Cena",        time: "20:00", items: [] },
];

export const DEFAULT_MEAL_IDS = new Set(DEFAULT_MEALS.map((meal) => meal.id));

// Snapshot serializado del plan para detectar cambios sin guardar (dirty check).
export const buildDietPlanSnapshot = ({ title, date, macros, meals, patientId, patientName }) => JSON.stringify({
  title,
  date,
  macros,
  meals,
  patientId,
  patientName,
});

export const generateId = () => Math.random().toString(36).substring(2, 11);

// Mueve un tiempo de comida de una posición a otra (reordenar los tabs
// arrastrando). Devuelve el mismo array si el movimiento no cambia nada o si
// los índices están fuera de rango, para no disparar renders inútiles.
export const reorderMeals = (meals, fromIndex, toIndex) => {
  if (!Array.isArray(meals)) return meals;
  if (fromIndex === toIndex) return meals;
  if (fromIndex < 0 || fromIndex >= meals.length) return meals;
  if (toIndex   < 0 || toIndex   >= meals.length) return meals;
  const next = [...meals];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
};

export const buildPatientDisplayName = (patient) => {
  if (!patient) return "";
  return patient.full_name || `${patient.first_name || patient.name || ""} ${patient.last_name || ""}`.trim();
};

export const asMeasurementArray = (measurements) => Array.isArray(measurements) ? measurements : [];

// Devuelve la medición vigente para la fecha del plan: coincidencia exacta si
// existe; si no, la más reciente anterior o igual a la fecha; si no hay ninguna
// anterior, la más reciente disponible. Sin fecha objetivo → la más reciente.
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

// Objetivos de macros a partir del requerimiento del paciente/medición, con
// fallback por reparto estándar (P 15% / C 55% / G 30%) sobre las calorías.
export const buildMacroTargetsFromPatient = (patient, measurement, fallbackCalories) => {
  const requirement = measurement?.requirement || patient?.requirement || {};
  const calories = requirement.target_calories || patient?.target_calories || fallbackCalories;

  return {
    calories,
    protein: requirement.target_protein || patient?.target_protein || Math.round(calories * 0.15 / 4),
    carbs: requirement.target_carbs || patient?.target_carbs || Math.round(calories * 0.55 / 4),
    fat: requirement.target_fat || patient?.target_fat || Math.round(calories * 0.30 / 9),
  };
};
