import React from "react";
import { MACRO_ORDER, MACRO_STYLES } from "@/lib/macroColors";
import { logger } from "@/lib/logger";

// Aviso de red: si una celda de macro se queda otra vez sin su número, que se
// entere alguien. El candado de verdad es la regla de lint (no-restricted-syntax
// en eslint.config.js) y las pruebas que miran el CONTENIDO de la celda; esto
// cubre el caso que ninguna de las dos ve: un `value` que existe en el código
// pero llega vacío en tiempo de ejecución.
//
// Se avisa una sola vez por macro: el aviso vive dentro del render de una tabla
// con decenas de filas y repetirlo en cada una solo taparía el primero.
const macrosYaAvisados = new Set();

function avisarValorAusente(macro, value) {
  if (macrosYaAvisados.has(macro)) return;
  macrosYaAvisados.add(macro);
  logger.warn("Celda de macro sin valor numérico: la tabla mostrará 0", {
    macro,
    recibido: value === undefined ? "undefined" : String(value),
  });
}

/**
 * Cabecera de la tabla de resultados de los buscadores de alimentos.
 *
 * Estaba escrita tres veces (creador de dietas, recordatorio de 24 h y editor
 * de recetas) y los colores de PRO y GRA habían quedado distintos en cada una.
 * Ahora salen todos de `@/lib/macroColors`.
 *
 * @param {string} quantityLabel
 *        Rótulo de la primera columna. El recordatorio y el creador de dietas
 *        muestran "Porciones" en la pestaña de recetas; el editor de recetas
 *        siempre dice "Cant.".
 * @param {boolean} compactOnMobile
 *        Variante del creador de dietas: en celular esconde las columnas de
 *        macros y aprieta el espaciado. Con siete columnas visibles, la última
 *        —el botón de agregar— se salía de la pantalla y no se podía escoger un
 *        alimento desde el teléfono. Los macros son dato secundario al elegir;
 *        el botón, no.
 */
export function FoodResultsTableHead({ quantityLabel = "Cant.", compactOnMobile = false }) {
  const quantityCell = compactOnMobile ? "w-16 p-2 text-center sm:w-24 sm:p-3" : "p-3 w-24 text-center";
  const nameCell = compactOnMobile ? "p-2 sm:p-3" : "p-3";
  const kcalCell = compactOnMobile ? "p-2 text-center sm:p-3" : "p-3 text-center";
  const macroCell = compactOnMobile ? "hidden p-3 text-center md:table-cell" : "p-3 text-center";
  const actionCell = compactOnMobile ? "w-12 p-2 sm:w-16 sm:p-3" : "p-3 w-16";

  return (
    <thead className="sticky top-0 z-10 bg-white">
      <tr className="bg-slate-50/60 text-slate-400 text-[10px] font-bold uppercase tracking-[0.08em] border-b border-slate-200">
        <th className={quantityCell}>{quantityLabel}</th>
        <th className={nameCell}>Alimento</th>
        <th className={kcalCell}>Kcal</th>
        {MACRO_ORDER.map((macro) => (
          <th key={macro} className={macroCell}>
            <span className="inline-flex items-center gap-1 justify-center">
              <span className={`w-1.5 h-1.5 rounded-full ${MACRO_STYLES[macro].dot}`} />
              {MACRO_STYLES[macro].label}
            </span>
          </th>
        ))}
        <th className={actionCell}></th>
      </tr>
    </thead>
  );
}

export default FoodResultsTableHead;

/**
 * Celda con el valor de un macronutriente en la tabla de resultados.
 *
 * El color sale de `@/lib/macroColors`, igual que el punto de la cabecera. Antes
 * cada celda traía su color escrito a mano y habían dejado de coincidir con su
 * propia cabecera: en el recordatorio de 24 h el punto de PRO era rojo y los
 * números de esa columna, azules.
 *
 * El valor va en la prop `value`, NO como contenido del elemento. Cuando la
 * celda lo recibía como `children` los cinco buscadores se quedaron con
 * `<MacroValueCell macro="carbs"></MacroValueCell>` —sin número— y la pantalla
 * mostró solo la "g" durante semanas: un children que falta no rompe nada, se
 * limita a no pintar. Con `value` explícito, olvidarlo pinta un 0 visible.
 *
 * El redondeo a un decimal se hace AQUÍ, y no en cada llamada, porque antes
 * convivían tres formas de escribir el mismo redondeo y la tabla mostraba
 * distinta precisión según la pestaña.
 *
 * @param {'carbs'|'protein'|'fat'} macro
 * @param {number} value Gramos del macronutriente, sin redondear.
 * @param {boolean} hideOnMobile
 *        En el creador de dietas los macros se esconden en celular para que el
 *        botón de agregar no se salga de la pantalla. Debe ir en las celdas
 *        SIEMPRE que vaya en la cabecera, o las columnas se desalinean.
 */
export function MacroValueCell({ macro, value, hideOnMobile = false }) {
  const style = MACRO_STYLES[macro];
  const visibility = hideOnMobile ? "hidden md:table-cell " : "";
  const numero = Number(value);
  const mostrado = Number.isFinite(numero) ? Math.round(numero * 10) / 10 : 0;

  if (!Number.isFinite(numero)) avisarValorAusente(macro, value);

  return (
    <td className={`${visibility}p-3 text-center text-sm font-semibold ${style.value} tabular-nums`}>
      {mostrado}
      <span className={`text-[10px] ${style.unit} ml-0.5`}>g</span>
    </td>
  );
}
