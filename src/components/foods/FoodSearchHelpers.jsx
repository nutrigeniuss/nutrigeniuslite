/**
 * Helpers compartidos por los buscadores de alimentos (creador de dietas,
 * recordatorio 24 h y editor de recetas).
 *
 * Este archivo YA NO define nada que exista en otro sitio: `DeferredNumberInput`
 * y `UnitSelect` eran copias línea por línea de `@/components/diet/FoodQuantityInputs`
 * (solo cambiaban los comentarios), y `roundNutritionValue` /
 * `getDefaultQuantityForUnit` eran copias de `@/lib/dietPlanItem`. Ahora se
 * reexportan desde su fuente única, para que un arreglo valga para todos.
 *
 * Lo único propio de este módulo es la presentación de la BÚSQUEDA: resaltar la
 * coincidencia y puntuar la relevancia.
 */
import React from "react";
import { normalizeSearchText } from "@/lib/searchText";

// Reexportados desde su fuente canónica. Se mantienen aquí para no romper los
// imports existentes y para que "todo lo del buscador" siga entrando por un
// solo sitio.
export { DeferredNumberInput, UnitSelect } from "@/components/diet/FoodQuantityInputs";
export { getDefaultQuantityForUnit, roundNutritionValue } from "@/lib/dietPlanItem";

// Resaltado de coincidencias en el nombre. Divide el texto en tramos
// que coinciden con la búsqueda (insensible a mayúsculas) para envolverlos en <mark>.
export const highlightMatch = (text, query) => {
  if (!text) return text;
  const q = (query || "").trim();
  if (!q) return text;
  try {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    // `String(...)` porque algunos nombres llegan como número desde el catálogo
    // importado por Excel; sin esto `.split` reventaba la fila entera.
    const parts = String(text).split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} className="bg-amber-100 text-amber-900 rounded px-0.5">{part}</mark>
        : <React.Fragment key={i}>{part}</React.Fragment>
    );
  } catch {
    return text;
  }
};

// Orden por relevancia: prefijo (0) > palabra que empieza con (1) >
// inclusión (2) > resto (3).
//
// Normaliza sin tildes (igual que el filtro) para que "higado" puntúe alto en
// "Hígado". Antes usaba `toLowerCase()` a secas: el recordatorio de 24 h
// FILTRABA sin tildes pero ORDENABA con tildes, así que "Hígado" aparecía en
// la lista pero al final, como si no coincidiera. El creador de dietas ya lo
// hacía bien con una copia local; esta es esa copia, ahora compartida.
export const scoreByRelevance = (name, query) => {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const n = normalizeSearchText(name);
  if (n.startsWith(q)) return 0;
  if (new RegExp(`(^|\\s)${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(n)) return 1;
  if (n.includes(q)) return 2;
  return 3;
};
