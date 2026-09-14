// Recálculo de items editables del recordatorio 24h (sin React).
// Los items guardan sus macros/micros como TOTAL de la porción elegida y dejan
// `quantity` en 1. Estas funciones recalculan ese total a partir de la "base"
// editable (alimento/receta + unidad + cantidad). Extraído de Recall24hEditor.jsx.
import { scaleFoodNutrientsForPlan, getFoodMacroValue } from "@/lib/foodNutrients";
import { getFoodUnits } from "@/lib/foodDisplay";
import { roundNutritionValue } from "@/components/foods/FoodSearchHelpers";

export const generateId = () => Math.random().toString(36).substring(2, 11);

export const computeFoodItemFields = (food, unitIndex, unitQuantity) => {
  const units = getFoodUnits(food);
  const idx = units[unitIndex] ? unitIndex : 0;
  const unit = units[idx] || units[0];
  const qty = Math.max(0, Number(unitQuantity) || 0);
  const totalGrams = unit.isHousehold ? qty * unit.grams : qty;
  const factor = totalGrams / (food.portion_grams || 100);
  const nutrientPayload = scaleFoodNutrientsForPlan(food, factor);
  const unitLabel = unit.isHousehold
    ? `${roundNutritionValue(qty)} ${unit.label} (${Math.round(totalGrams)}g)`
    : `${Math.round(totalGrams)}g`;
  const macro = (key) => Math.round((getFoodMacroValue(food, key) ?? 0) * factor * 10) / 10;
  return {
    unitIndex: idx,
    unitQuantity: qty,
    totalGrams,
    unit: unitLabel,
    calories: macro("calories"),
    protein: macro("protein"),
    carbs: macro("carbs"),
    fat: macro("fat"),
    ...nutrientPayload,
  };
};

// Macros/micros de UNA porción de la receta. Si la receta tiene ingredientes,
// los sumamos (cada ingrediente está expresado por porción); si no, usamos los
// valores `*_per_serving` guardados. Así editar las porciones reescala todo.
export const getRecipePerServingBasis = (recipe) => {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  if (ingredients.length > 0) {
    const base = { calories: 0, protein: 0, carbs: 0, fat: 0, nutrients: {} };
    ingredients.forEach((ing) => {
      base.calories += Number(ing.calories) || 0;
      base.protein += Number(ing.protein) || 0;
      base.carbs += Number(ing.carbs) || 0;
      base.fat += Number(ing.fat) || 0;
      Object.entries(ing.nutrients || {}).forEach(([key, value]) => {
        base.nutrients[key] = (base.nutrients[key] || 0) + (Number(value) || 0);
      });
    });
    return base;
  }
  return {
    calories: Number(recipe.calories_per_serving) || 0,
    protein: Number(recipe.protein_per_serving) || 0,
    carbs: Number(recipe.carbs_per_serving) || 0,
    fat: Number(recipe.fat_per_serving) || 0,
    nutrients: recipe.nutrients || {},
  };
};

export const computeRecipeItemFields = (recipe, servings) => {
  const s = Math.max(0, Number(servings) || 0);
  const basis = getRecipePerServingBasis(recipe);
  const nutrients = {};
  Object.entries(basis.nutrients || {}).forEach(([key, value]) => {
    nutrients[key] = Math.round((Number(value) || 0) * s * 10) / 10;
  });
  return {
    servings: s,
    unit: `${roundNutritionValue(s)} ${s === 1 ? "porción" : "porciones"}`,
    calories: Math.round(basis.calories * s * 10) / 10,
    protein: Math.round(basis.protein * s * 10) / 10,
    carbs: Math.round(basis.carbs * s * 10) / 10,
    fat: Math.round(basis.fat * s * 10) / 10,
    nutrients,
    ...nutrients,
  };
};
