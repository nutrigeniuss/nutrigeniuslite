import { scaleFoodNutrientsForPlan, getFoodMacroValue } from "@/lib/foodNutrients";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros para construir y manipular "items de plan de dieta": un alimento
// del catálogo con su cantidad, unidad (gramos o medida casera) y nutrientes
// escalados. Extraídos de DietCreator para reutilizarlos sin duplicar lógica en
// el buscador de alimentos, la lista de comidas y la página principal.
//
// Convención clave: el item guarda macros/nutrientes en base "por unidad" (por
// gramo o por medida casera) con PRECISIÓN COMPLETA; el redondeo se hace solo al
// renderizar. Redondear aquí acumularía error al multiplicar por la cantidad
// (p. ej. 3.02 kcal/g → 3.0 → −2 kcal por cada 100 g).
// ─────────────────────────────────────────────────────────────────────────────

const asArray = (value) => (Array.isArray(value) ? value : []);

// Redondeo de presentación (1 decimal) para valores nutricionales.
export const roundNutritionValue = (value) => Math.round((Number(value) || 0) * 10) / 10;

// Normaliza y deduplica las medidas caseras de un alimento (nombre + gramos).
export const normalizeHouseholdMeasuresForDiet = (measures) => {
  const seen = new Set();

  return asArray(measures).filter((measure) => {
    const name = String(measure?.name || "").trim();
    const grams = Number(measure?.weight_grams);

    if (!name || !Number.isFinite(grams) || grams <= 0) {
      return false;
    }

    const key = `${name.toLowerCase()}::${grams}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const normalizeFoodUnitOptions = (options) => asArray(options)
  .map((option) => ({
    label: String(option?.label || "").trim(),
    grams: Number(option?.grams),
    isHousehold: Boolean(option?.isHousehold),
  }))
  .filter((option) => option.label && Number.isFinite(option.grams) && option.grams > 0);

// Opciones de unidad de un alimento: "gramos" + sus medidas caseras válidas.
export const buildFoodUnitOptions = (food) => {
  const base = [{ label: "gramos", grams: 1, isHousehold: false }];

  normalizeHouseholdMeasuresForDiet(food?.household_measures).forEach((measure) => {
    base.push({
      label: measure.name,
      grams: Number(measure.weight_grams),
      isHousehold: true,
    });
  });

  return base;
};

const formatFoodUnitLabel = (unit, quantity) => {
  const safeQuantity = Number.isFinite(Number(quantity)) && Number(quantity) > 0 ? Number(quantity) : 1;

  if (!unit?.isHousehold) {
    return `${safeQuantity} gramos`;
  }

  const totalGrams = roundNutritionValue(safeQuantity * unit.grams);
  return `${safeQuantity} ${unit.label} (${totalGrams}g)`;
};

export const getDefaultQuantityForUnit = (unit) => (unit?.isHousehold ? 1 : 100);

// Conversión inversa del campo "gramos equivalentes": el usuario escribe los
// GRAMOS y hay que devolver cuántas medidas caseras son.
//
// Ejemplo: la unidad "Unidad" pesa 30 g. Si escribe 45 g, la cantidad pasa a
// 1.5 unidades.
//
// Devuelve `null` cuando la conversión no aplica (gramos negativos o una unidad
// sin peso), para que quien llama NO toque el estado: escribir un número
// inválido debe dejar la fila como estaba, no ponerla en cero.
//
// El redondeo a 6 decimales evita que el ida y vuelta gramos → cantidad →
// gramos acumule basura de coma flotante (1.0000000000000002 medidas). El piso
// de 0.000001 evita la cantidad 0, que dejaría el alimento en la dieta con todo
// a cero en lugar de quitarlo.
export const gramsToQuantity = (nextGrams, unitGrams) => {
  const grams = Number(nextGrams);
  const perUnit = Number(unitGrams) || 0;

  if (!Number.isFinite(grams) || grams < 0) return null;
  if (perUnit <= 0) return null;

  const rawQuantity = grams / perUnit;
  const rounded = Math.round(rawQuantity * 1e6) / 1e6;

  return rounded > 0 ? rounded : 0.000001;
};

// Al cambiar de unidad: conserva la cantidad si ambas son caseras; si no, usa el
// default de la nueva unidad (1 medida casera o 100 g).
export const resolveQuantityForUnitChange = (currentQuantity, currentUnit, nextUnit) => {
  if (currentUnit?.isHousehold && nextUnit?.isHousehold) {
    const numericQuantity = Number(currentQuantity);
    return Number.isFinite(numericQuantity) && numericQuantity > 0 ? numericQuantity : 1;
  }

  return getDefaultQuantityForUnit(nextUnit);
};

// Construye el item de plan a partir de un alimento del catálogo, su cantidad y
// la unidad elegida. Conserva `reference_food` para poder re-escalar al editar
// cantidad/unidad más adelante.
export const buildFoodPlanItem = (food, quantity, unitIndex = 0, previousItem = {}) => {
  const referenceFood = previousItem.reference_food || food;
  const unitOptions = normalizeFoodUnitOptions(previousItem.unit_options?.length ? previousItem.unit_options : buildFoodUnitOptions(referenceFood));
  const selectedUnitIndex = unitOptions[unitIndex] ? unitIndex : 0;
  const selectedUnit = unitOptions[selectedUnitIndex] || unitOptions[0] || { label: "gramos", grams: 1, isHousehold: false };
  const numericQuantity = Number(quantity);
  const safeQuantity = Number.isFinite(numericQuantity) && numericQuantity > 0
    ? numericQuantity
    : (selectedUnit.isHousehold ? 1 : 100);
  const portionGrams = Number(referenceFood?.portion_grams) || 100;
  const perUnitFactor = selectedUnit.isHousehold ? selectedUnit.grams / portionGrams : 1 / portionGrams;
  // Precisión completa a propósito (ver nota de cabecera): el redondeo es al render.
  const nutrientPayload = scaleFoodNutrientsForPlan(referenceFood, perUnitFactor, { round: false });
  const macro = (key) => (getFoodMacroValue(referenceFood, key) ?? 0) * perUnitFactor;

  return {
    ...previousItem,
    name: previousItem.name || referenceFood.name,
    quantity: safeQuantity,
    unit: formatFoodUnitLabel(selectedUnit, safeQuantity),
    calories: macro("calories"),
    protein: macro("protein"),
    carbs: macro("carbs"),
    fat: macro("fat"),
    ...nutrientPayload,
    unit_options: unitOptions,
    selected_unit_index: selectedUnitIndex,
    reference_food: referenceFood,
  };
};
