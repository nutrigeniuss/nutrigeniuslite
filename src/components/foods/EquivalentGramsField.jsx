import React from "react";
import { DeferredNumberInput } from "@/components/diet/FoodQuantityInputs";
import { gramsToQuantity } from "@/lib/dietPlanItem";

/**
 * El "≈ 45 g" editable que aparece bajo el nombre del alimento cuando la unidad
 * elegida es casera (1 taza, 1 cucharada…).
 *
 * Sirve para las dos direcciones: el nutricionista puede pensar en medidas
 * ("2 cucharadas") o en gramos ("30 g"), y escribir en cualquiera de los dos
 * campos mueve el otro.
 *
 * Estaba copiado tal cual en las cuatro tablas de búsqueda (creador de dietas
 * ×2, recordatorio de 24 h y editor de recetas), incluida la aritmética de
 * conversión escrita a mano cada vez. Ahora esa aritmética vive probada en
 * `gramsToQuantity` y el marcado, aquí.
 *
 * NO cubre las filas de comida ya agregada (MealItemsList, EditableMealItemRow,
 * IngredientRow): esas versiones tienen modo de solo lectura y otros callbacks,
 * y unificarlas cambiaría su comportamiento.
 *
 * @param {number|null} grams  Gramos equivalentes a mostrar. Si es null no pinta nada.
 * @param {number} unitGrams   Cuánto pesa una medida de la unidad elegida.
 * @param {(quantity: number) => void} onQuantityChange
 *        Recibe la NUEVA CANTIDAD en medidas caseras. No se llama si lo escrito
 *        no es convertible, para que la fila quede como estaba.
 */
export function EquivalentGramsField({ grams, unitGrams, onQuantityChange }) {
  if (grams == null) return null;

  return (
    <>
      <span className="text-[11px] text-slate-400">≈</span>
      <div className="inline-flex items-center gap-0.5 rounded-md border border-transparent px-1 py-0.5 transition focus-within:border-sky-400 focus-within:bg-sky-50 focus-within:ring-2 focus-within:ring-sky-200">
        <DeferredNumberInput
          min={0}
          step={1}
          value={grams}
          displayPrecision={1}
          onCommit={(nextGrams) => {
            const nextQuantity = gramsToQuantity(nextGrams, unitGrams);
            if (nextQuantity == null) return;
            onQuantityChange(nextQuantity);
          }}
          className="with-spinners w-12 border-0 bg-transparent text-[11px] font-semibold text-sky-600 text-center p-0 outline-none cursor-pointer underline decoration-dotted decoration-sky-400 underline-offset-2 hover:text-sky-700 focus:no-underline focus:cursor-text focus:font-bold focus:text-sky-700"
          title="Gramos equivalentes. Haz clic para editar."
        />
        <span className="text-[11px] font-semibold text-sky-600">g</span>
      </div>
    </>
  );
}

export default EquivalentGramsField;
