import { useState } from "react";
import { Info, Trash2 } from "lucide-react";
import { buildFoodPlanItem, resolveQuantityForUnitChange, roundNutritionValue } from "@/lib/dietPlanItem";
import { groupItemsByRecipe, sumGroupCalories } from "@/components/diet/groupItemsByRecipe";
import RecipeGroupHeader from "@/components/diet/RecipeGroupHeader";
import { DeferredNumberInput, UnitSelect } from "@/components/diet/FoodQuantityInputs";

// Tabla de alimentos agregados a un tiempo de comida, con soporte para
// agrupar ingredientes por receta. Extraída de DietCreator para aislar la
// edición de filas (cantidad/unidad/eliminar) del resto del editor.

// Single ingredient row. Used both for standalone items and for ingredients
// inside a recipe group; `indented` adds left padding so the hierarchy is
// visually obvious inside a group.
//
// Carbs/prot/fat columns were removed in favor of a single kcal column +
// info button that opens the Nutrient Inspector. Rationale: the macro/micro
// breakdown is one click away (less visual noise), while kcal stays inline
// because nutritionists scan it constantly to spot "the heavy item" when
// adjusting quantities against the daily target.
function MealItemRow({ item, indented, mealTotalKcal, onUpdateQty, onUpdateUnit, onRemove, onInspect, readOnly = false }) {
  const selectedUnit = Array.isArray(item.unit_options)
    ? item.unit_options[item.selected_unit_index ?? 0]
    : null;
  const equivalentGrams = selectedUnit?.isHousehold
    ? roundNutritionValue((Number(item.quantity) || 0) * selectedUnit.grams)
    : null;

  const itemKcal = (item.calories || 0) * (item.quantity || 1);
  // Highlight items that dominate the meal — helps the nutritionist spot
  // "the heavy item" when correcting a meal that's over target.
  const isHeavyContributor = mealTotalKcal > 0 && itemKcal / mealTotalKcal > 0.4;

  return (
    <tr className="hover:bg-slate-50/70 transition group">
      <td className={`${indented ? "pl-4 pr-2 sm:pl-8 sm:pr-4" : "px-2 sm:px-4"} py-3 text-center`}>
        {readOnly ? (
          <span className="text-sm font-bold text-slate-700 tabular-nums">{item.quantity || 1}</span>
        ) : (
          <DeferredNumberInput
            min={0.01}
            step={0.1}
            value={item.quantity || 1}
            displayPrecision={2}
            onCommit={(v) => onUpdateQty(item.id, v > 0 ? v : 0.01)}
            className="w-14 rounded-lg border border-slate-200 bg-white p-1.5 text-center text-sm font-bold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 hover:border-slate-300"
          />
        )}
      </td>

      <td className="px-2 py-3 sm:px-4">
        <p className="text-sm font-semibold text-slate-800 leading-tight">{item.name}</p>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {Array.isArray(item.unit_options) && item.unit_options.length > 1 ? (
            readOnly ? (
              <span className="text-[11px] font-medium text-slate-500">{selectedUnit?.label || ""}</span>
            ) : (
              <UnitSelect
                options={item.unit_options}
                value={item.selected_unit_index ?? 0}
                onChange={(index) => onUpdateUnit(item.id, index)}
                ariaLabel={`Unidad de ${item.name}`}
              />
            )
          ) : null}
          {equivalentGrams != null ? (
            <>
              <span className="text-[11px] text-slate-400">≈</span>
              <div className="inline-flex items-center gap-0.5 rounded-md border border-transparent px-1 py-0.5 transition focus-within:border-sky-400 focus-within:bg-sky-50 focus-within:ring-2 focus-within:ring-sky-200">
                {readOnly ? (
                  <span className="text-[11px] font-semibold text-sky-600 tabular-nums">{equivalentGrams}</span>
                ) : (
                  <DeferredNumberInput
                    min={0}
                    step={1}
                    value={equivalentGrams}
                    displayPrecision={1}
                    onCommit={(nextGrams) => {
                      if (nextGrams < 0) return;
                      const perUnit = Number(selectedUnit?.grams) || 0;
                      if (perUnit <= 0) return;
                      const rawQuantity = nextGrams / perUnit;
                      const nextQuantity = Math.round(rawQuantity * 1e6) / 1e6;
                      onUpdateQty(item.id, nextQuantity > 0 ? nextQuantity : 0.000001);
                    }}
                    className="with-spinners w-12 border-0 bg-transparent text-[11px] font-semibold text-sky-600 text-center p-0 outline-none cursor-pointer underline decoration-dotted decoration-sky-400 underline-offset-2 hover:text-sky-700 focus:no-underline focus:cursor-text focus:font-bold focus:text-sky-700"
                    title="Gramos equivalentes. Haz clic para editar."
                  />
                )}
                <span className="text-[11px] font-semibold text-sky-600">g</span>
              </div>
            </>
          ) : null}
        </div>
      </td>

      <td className="px-2 py-3 text-center sm:px-3">
        <span
          className={`text-sm tabular-nums ${
            isHeavyContributor ? "font-bold text-amber-600" : "font-medium text-slate-500"
          }`}
          title={isHeavyContributor ? "Este alimento aporta más del 40% del meal" : undefined}
        >
          {Math.round(itemKcal)}
          <span className="text-[10px] text-slate-400 ml-0.5">kcal</span>
        </span>
      </td>

      <td className="px-2 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => onInspect?.({ kind: "item", itemId: item.id })}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-md text-slate-400 transition hover:bg-sky-50 hover:text-sky-600 sm:h-7 sm:w-7"
            aria-label="Ver detalle nutricional"
            title="Ver macros y micronutrientes"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-md text-slate-400 opacity-100 transition hover:bg-rose-50 hover:text-rose-500 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Eliminar alimento"
              title="Eliminar alimento"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

// Columns: Cant. · Alimento · Kcal · Actions (info + delete)
const MEAL_TABLE_COL_COUNT = 4;

export default function MealItemsList({ meal, onUpdate, onInspect, readOnly = false }) {
  // Collapsed-group state lives here so it survives qty/unit edits.
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const removeItem = (itemId) => onUpdate({ ...meal, items: meal.items.filter(i => i.id !== itemId) });

  // Removes every ingredient that shares the same recipe instance — the
  // "delete recipe as a whole" action invoked from the group header.
  const removeRecipeGroup = (instanceId) => onUpdate({
    ...meal,
    items: meal.items.filter(i => i.recipe_group?.instance_id !== instanceId),
  });

  const updateFoodItemSelection = (itemId, nextQuantity, nextUnitIndex) => onUpdate({
    ...meal,
    items: meal.items.map((item) => {
      if (item.id !== itemId) return item;
      if (item.reference_food && Array.isArray(item.unit_options)) {
        const rebuilt = buildFoodPlanItem(
          item.reference_food,
          nextQuantity ?? item.quantity,
          nextUnitIndex ?? item.selected_unit_index ?? 0,
          item,
        );
        // Preserve recipe_group through unit/qty edits — buildFoodPlanItem
        // doesn't know about it.
        return item.recipe_group ? { ...rebuilt, recipe_group: item.recipe_group } : rebuilt;
      }
      return { ...item, quantity: parseFloat(nextQuantity) || 1 };
    }),
  });

  const updateQty  = (itemId, qty) => updateFoodItemSelection(itemId, qty, undefined);
  const updateUnit = (itemId, unitIndex) => {
    const item = meal.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const parsedUnitIndex = parseInt(unitIndex, 10);
    const currentUnit = Array.isArray(item.unit_options) ? item.unit_options[item.selected_unit_index ?? 0] : null;
    const nextUnit    = Array.isArray(item.unit_options) ? item.unit_options[parsedUnitIndex] : null;
    const nextQty     = resolveQuantityForUnitChange(item.quantity, currentUnit, nextUnit);
    updateFoodItemSelection(itemId, nextQty, parsedUnitIndex);
  };

  if (meal.items.length === 0) return null;

  const blocks = groupItemsByRecipe(meal.items);
  // Used by MealItemRow to flag items that dominate the meal's kcal.
  const mealTotalKcal = sumGroupCalories(meal.items);

  return (
    // El desplazamiento lateral vive AQUÍ, no en la página: sin este
    // envoltorio las tres columnas de ancho fijo (256 px en total) desbordaban
    // la tarjeta en un celular y hacían que se moviera de lado el documento
    // entero. Los anchos se aprietan en pantalla chica para que, en la práctica,
    // casi nunca haga falta desplazarse.
    <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.08em] border-b border-slate-100">
          <th className="px-2 py-2.5 w-16 text-center sm:px-4 sm:w-20">Cant.</th>
          <th className="px-2 py-2.5 sm:px-4">Alimento</th>
          <th className="px-2 py-2.5 text-center w-16 sm:px-3 sm:w-24">Kcal</th>
          <th className="px-2 py-2.5 w-16 sm:w-20"></th>
        </tr>
      </thead>

      {blocks.map((block, blockIdx) => {
        if (block.kind === 'recipe') {
          const instanceId = block.group.instance_id;
          const isCollapsed = !!collapsedGroups[instanceId];
          return (
            <tbody
              key={instanceId}
              className="border-l-[3px] border-[#93a7ff] bg-brand-50/20"
            >
              <RecipeGroupHeader
                group={block.group}
                totalKcal={sumGroupCalories(block.items)}
                ingredientCount={block.items.length}
                collapsed={isCollapsed}
                onToggleCollapse={() => setCollapsedGroups((c) => ({ ...c, [instanceId]: !c[instanceId] }))}
                onRemoveGroup={readOnly ? undefined : () => removeRecipeGroup(instanceId)}
                onInspect={() => onInspect?.({ kind: "recipe", instanceId, mealId: meal.id })}
                colSpan={MEAL_TABLE_COL_COUNT}
              />
              {!isCollapsed && block.items.map((item) => (
                <MealItemRow
                  key={item.id}
                  item={item}
                  indented
                  mealTotalKcal={mealTotalKcal}
                  onUpdateQty={updateQty}
                  onUpdateUnit={updateUnit}
                  onRemove={removeItem}
                  onInspect={(payload) => onInspect?.({ ...payload, mealId: meal.id })}
                  readOnly={readOnly}
                />
              ))}
            </tbody>
          );
        }
        return (
          <tbody key={block.item.id || `single-${blockIdx}`} className="divide-y divide-slate-50">
            <MealItemRow
              item={block.item}
              indented={false}
              mealTotalKcal={mealTotalKcal}
              onUpdateQty={updateQty}
              onUpdateUnit={updateUnit}
              onRemove={removeItem}
              onInspect={(payload) => onInspect?.({ ...payload, mealId: meal.id })}
              readOnly={readOnly}
            />
          </tbody>
        );
      })}
    </table>
    </div>
  );
}
