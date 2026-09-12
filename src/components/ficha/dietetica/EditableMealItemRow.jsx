import React from "react";
import { X } from "lucide-react";
import { getFoodUnits } from "@/lib/foodDisplay";
import { DeferredNumberInput, UnitSelect, getDefaultQuantityForUnit, roundNutritionValue } from "@/components/foods/FoodSearchHelpers";
import { computeFoodItemFields, computeRecipeItemFields } from "./recallItemFields";

// ── Fila editable de un item ya añadido a la comida ────────────────────────────
// Permite ajustar medida casera + gramos (alimentos) o porciones (recetas)
// directamente, recalculando macros/micros en vivo. Los items "legacy" (sin
// `source`/base, de recordatorios guardados antes) caen a modo solo lectura.
// Extraído de Recall24hEditor.jsx.
export default function EditableMealItemRow({ item, onChange, onRemove }) {
  const qty = item.quantity || 1;
  const kcal = Math.round((item.calories || 0) * qty);
  const cho = Math.round((item.carbs || 0) * qty * 10) / 10;
  const pro = Math.round((item.protein || 0) * qty * 10) / 10;
  const gra = Math.round((item.fat || 0) * qty * 10) / 10;

  const isFood = item.source === "food" && item.food;
  const isRecipe = item.source === "recipe" && item.recipe;

  const qtyInputClass =
    "w-16 rounded-lg border border-slate-200 bg-white p-1.5 text-center text-sm font-bold text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 hover:border-slate-300";

  let quantityCell = <span className="text-xs text-slate-300">—</span>;
  let detailCell = <p className="text-[10px] text-slate-400">{item.unit}</p>;

  if (isFood) {
    const units = getFoodUnits(item.food);
    const unitIndex = units[item.unitIndex] ? item.unitIndex : 0;
    const currentUnit = units[unitIndex] || units[0];
    const unitQuantity = item.unitQuantity ?? 1;
    const equivalentGrams = currentUnit?.isHousehold
      ? roundNutritionValue((Number(unitQuantity) || 0) * currentUnit.grams)
      : null;

    quantityCell = (
      <DeferredNumberInput
        min={0}
        step={currentUnit.isHousehold ? 0.5 : 10}
        value={unitQuantity}
        displayPrecision={2}
        onCommit={(v) => onChange(computeFoodItemFields(item.food, unitIndex, v))}
        className={qtyInputClass}
      />
    );

    detailCell = (
      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
        {units.length > 1 ? (
          <UnitSelect
            options={units}
            value={unitIndex}
            onChange={(nextIdx) =>
              onChange(computeFoodItemFields(item.food, nextIdx, getDefaultQuantityForUnit(units[nextIdx] || units[0])))
            }
            ariaLabel={`Unidad de ${item.name}`}
          />
        ) : (
          <span className="text-[11px] text-slate-400">gramos</span>
        )}
        {equivalentGrams != null ? (
          <>
            <span className="text-[11px] text-slate-400">≈</span>
            <div className="inline-flex items-center gap-0.5 rounded-md border border-transparent px-1 py-0.5 transition focus-within:border-sky-400 focus-within:bg-sky-50 focus-within:ring-2 focus-within:ring-sky-200">
              <DeferredNumberInput
                min={0}
                step={1}
                value={equivalentGrams}
                displayPrecision={1}
                onCommit={(nextGrams) => {
                  const perUnit = Number(currentUnit?.grams) || 0;
                  if (nextGrams < 0 || perUnit <= 0) return;
                  onChange(computeFoodItemFields(item.food, unitIndex, nextGrams / perUnit));
                }}
                className="with-spinners w-12 border-0 bg-transparent text-[11px] font-semibold text-sky-600 text-center p-0 outline-none cursor-pointer underline decoration-dotted decoration-sky-400 underline-offset-2 hover:text-sky-700 focus:no-underline focus:cursor-text focus:font-bold focus:text-sky-700"
                title="Gramos equivalentes. Haz clic para editar."
              />
              <span className="text-[11px] font-semibold text-sky-600">g</span>
            </div>
          </>
        ) : null}
      </div>
    );
  } else if (isRecipe) {
    const servings = item.servings ?? 1;
    quantityCell = (
      <DeferredNumberInput
        min={0}
        step={0.5}
        value={servings}
        displayPrecision={2}
        onCommit={(v) => onChange(computeRecipeItemFields(item.recipe, v))}
        className={qtyInputClass}
      />
    );
    detailCell = (
      <span className="text-[11px] text-slate-400">{Number(servings) === 1 ? "porción" : "porciones"}</span>
    );
  }

  return (
    <tr className="group hover:bg-slate-50 transition">
      <td className="px-3 py-2 text-center align-top">{quantityCell}</td>
      <td className="px-3 py-2">
        <p className="text-xs font-semibold text-slate-700 leading-tight">{item.name}</p>
        {detailCell}
      </td>
      <td className="px-3 py-2 text-center text-xs font-bold text-orange-500 tabular-nums align-top">{kcal}</td>
      <td className="px-3 py-2 text-center text-xs font-bold text-teal-500 tabular-nums align-top">{cho}g</td>
      <td className="px-3 py-2 text-center text-xs font-bold text-indigo-500 tabular-nums align-top">{pro}g</td>
      <td className="px-3 py-2 text-center text-xs font-bold text-amber-500 tabular-nums align-top">{gra}g</td>
      <td className="px-3 py-2 align-top">
        <button
          onClick={onRemove}
          aria-label={`Quitar ${item.name}`}
          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
