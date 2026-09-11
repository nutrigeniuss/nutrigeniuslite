import { useState } from "react";
import { Trash2, Clock, X, Pencil, Check, Search } from "lucide-react";
import { getMealEmoji, MEAL_EMOJI_OPTIONS } from "@/components/diet/mealEmojis";
import MealItemsList from "@/components/diet/MealItemsList";

// Tarjeta del tiempo de comida activo: cabecera (emoji + nombre editable +
// hora + kcal + eliminar), lista de alimentos y estado vacío con launchpad.
//
// El estado de edición (nombre y selector de emoji) es puramente de UI y vive
// dentro del componente. La página monta esta tarjeta con `key={meal.id}` para
// que ese estado se reinicie al cambiar de tiempo de comida (mismo
// comportamiento que cuando el estado vivía en DietCreator).
export default function ActiveMealCard({
  meal,
  mealCalories,
  onUpdateMeal,
  onDeleteMeal,
  onInspect,
  onOpenFoodSearch,
  readOnly = false,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(meal.name);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const commitName = () => {
    onUpdateMeal({ ...meal, name: nameInput });
    setEditingName(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

      {/* Encabezado: emoji + nombre + subtítulo | hora + kcal + eliminar */}
      {/* Fila que se parte en dos líneas cuando no cabe. Sin `flex-wrap` el
          grupo derecho (hora + kcal + papelera, unos 236 px) más el título
          desbordaban los 335 px útiles de un celular, y la papelera quedaba
          fuera de la pantalla: no se podía borrar una comida desde el móvil. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Emoji clickeable: abre/cierra el selector. El emoji
                elegido se guarda en `meal.icon` del propio plan,
                así que persiste al guardar la dieta. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setEmojiPickerOpen((prev) => !prev)}
                disabled={readOnly}
                className="text-xl leading-none rounded-lg p-1 hover:bg-slate-100 transition disabled:cursor-default disabled:hover:bg-transparent"
                title="Cambiar icono"
                aria-label="Cambiar icono del tiempo de comida"
              >
                {getMealEmoji(meal)}
              </button>
              {emojiPickerOpen ? (
                <>
                  {/* Backdrop para cerrar al hacer clic fuera */}
                  <button
                    type="button"
                    aria-label="Cerrar selector de icono"
                    onClick={() => setEmojiPickerOpen(false)}
                    className="fixed inset-0 z-30 cursor-default"
                  />
                  <div className="absolute left-0 top-full mt-2 z-40 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                    <div className="grid grid-cols-8 gap-1 max-h-56 overflow-y-auto">
                      {MEAL_EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onUpdateMeal({ ...meal, icon: emoji });
                            setEmojiPickerOpen(false);
                          }}
                          className={`h-8 w-8 flex items-center justify-center rounded text-lg transition hover:bg-slate-100 ${
                            getMealEmoji(meal) === emoji ? "bg-amber-50 ring-1 ring-amber-300" : ""
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitName();
                    }
                  }}
                  className="border-b-2 border-brand-500 bg-transparent text-base font-bold text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={commitName}
                  className="text-brand-500"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setEditingName(false)} className="text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-base font-bold text-slate-800">{meal.name}</h2>
                {!readOnly ? (
                  <button
                    type="button"
                    onClick={() => { setNameInput(meal.name); setEditingName(true); }}
                    className="text-slate-300 hover:text-brand-500 transition"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 ml-8">
            {meal.items.length} alimento{meal.items.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Hora editable: pill con borde para que se vea claramente como input.
              Hover y foco intensifican el estilo. El picker nativo se abre al hacer clic. */}
          <label
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 cursor-pointer transition hover:border-sky-300 hover:bg-sky-50 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-200"
            title="Editar hora del tiempo de comida"
          >
            <Clock className="w-4 h-4 text-slate-400" />
            <input
              type="time"
              value={meal.time || ""}
              onChange={(e) => onUpdateMeal({ ...meal, time: e.target.value })}
              readOnly={readOnly}
              className="text-sm font-medium text-slate-700 outline-none w-[68px] bg-transparent cursor-pointer"
            />
          </label>
          <span className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5 text-sm font-bold text-amber-600">
            {mealCalories} kcal
          </span>
          {!readOnly ? (
            <button
              type="button"
              onClick={() => onDeleteMeal(meal.id)}
              className="p-1.5 text-slate-300 hover:text-red-400 transition rounded-lg hover:bg-red-50"
              aria-label="Eliminar tiempo de comida"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Tabla de alimentos agregados (siempre visible) */}
      <MealItemsList
        meal={meal}
        onUpdate={onUpdateMeal}
        onInspect={onInspect}
        readOnly={readOnly}
      />

      {/* Estado vacío como punto de partida: en vez de un mensaje
          muerto, ofrece accesos rápidos para cargar la comida. */}
      {meal.items.length === 0 && (
        <div className="px-5 py-8">
          <div className="mx-auto max-w-md rounded-[1.75rem] border border-brand-500/10 bg-gradient-to-b from-white to-brand-50/50 px-6 py-10 text-center shadow-[0_16px_40px_rgba(59,95,235,0.08)]">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-[0_12px_28px_rgba(59,95,235,0.32)]">
              <Search className="h-6 w-6" strokeWidth={2.1} />
            </div>
            <p className="text-[15px] font-bold tracking-tight text-slate-900">Empieza a armar {meal.name}</p>
            <p className="mt-1.5 text-sm text-slate-500">
              {readOnly ? "Este tiempo de comida no tiene alimentos." : "Busca un alimento para empezar."}
            </p>
            {!readOnly ? (
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={onOpenFoodSearch}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(59,95,235,0.32)] transition hover:opacity-95"
                >
                  <Search className="h-4 w-4" />
                  Buscar alimento
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Tip del tiempo de comida: recomendación libre del nutricionista que se
          imprime bajo la comida en el PDF ("Nota: ..."). Se guarda en
          `meal.notes`, campo que ya existía en el tipo y en DietPrintView pero
          que hasta ahora no tenía dónde escribirse.
          Aparece recién cuando la comida tiene al menos un alimento o bebida:
          en una comida vacía el foco debe estar en cargarla, y además el PDF
          omite las comidas sin alimentos, así que ese tip no se imprimiría.
          Si ya hay un tip escrito se muestra igual, para que un dato existente
          nunca quede inaccesible. En solo lectura (inspección Pro+) solo se ve
          con contenido: un campo vacío que no se puede llenar es ruido. */}
      {(meal.items.length > 0 && !readOnly) || meal.notes ? (
        <div className="border-t border-slate-100 px-5 py-3">
          {/* Sin etiqueta: el placeholder ya dice qué es y que se imprime. */}
          <textarea
            aria-label={`Tip o recomendación para ${meal.name}`}
            rows={2}
            value={meal.notes || ""}
            onChange={(e) => onUpdateMeal({ ...meal, notes: e.target.value })}
            readOnly={readOnly}
            placeholder={`Tip para ${meal.name} — se imprime en la dieta del paciente`}
            className="w-full resize-y rounded-[12px] border border-slate-200 bg-[#fbfcff] px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 read-only:cursor-default read-only:bg-slate-50"
          />
        </div>
      ) : null}
    </div>
  );
}
