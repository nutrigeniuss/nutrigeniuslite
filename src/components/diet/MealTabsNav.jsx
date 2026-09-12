import { Plus, X, GripHorizontal } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { getMealEmoji } from "@/components/diet/mealEmojis";

// ── Meal Tabs Nav ────────────────────────────────────────────────────────────
// Barra horizontal de tiempos de comida: cada tab muestra emoji + nombre + kcal
// del tiempo, un punto verde si ya tiene alimentos, y una "x" para eliminar los
// tiempos personalizados (los que no están en `defaultMealIds`). Al final, el
// botón "Añadir comida".
//
// Los tabs se pueden arrastrar para reordenarlos: al añadir un tiempo nuevo
// (p. ej. una media tarde) éste nace al final, y sin reordenar quedaría después
// de la cena. Antes la única salida era borrar tiempos y volver a crearlos en
// orden. El orden del array `meals` es el que se guarda e imprime, así que
// mover un tab cambia el orden real del plan.
//
// Extraído de DietCreator sin cambio de comportamiento. Recibe el set de ids de
// comidas por defecto como prop para no acoplar el componente a la constante
// DEFAULT_MEALS de la página.
export default function MealTabsNav({
  meals,
  activeMealId,
  defaultMealIds,
  onSelectMeal,
  onDeleteMeal,
  onAddMeal,
  onReorderMeals,
  readOnly = false,
}) {
  const canReorder = !readOnly && typeof onReorderMeals === "function" && meals.length > 1;

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const from = result.source.index;
    const to   = result.destination.index;
    if (from === to) return;
    onReorderMeals(from, to);
  };

  const renderTab = (meal, dragProvided, isDragging) => {
    const mealCal  = Math.round(meal.items.reduce((s, i) => s + (i.calories || 0) * (i.quantity || 1), 0));
    const isActive = activeMealId === meal.id;
    const isCustom = !defaultMealIds.has(meal.id);
    const emoji    = getMealEmoji(meal);
    return (
      <div
        key={meal.id}
        ref={dragProvided?.innerRef}
        {...(dragProvided?.draggableProps || {})}
        {...(dragProvided?.dragHandleProps || {})}
        className={`group relative mx-0.5 flex items-stretch ${
          canReorder ? "cursor-grab active:cursor-grabbing" : ""
        } ${isDragging ? "z-10 rounded-2xl shadow-lg ring-2 ring-brand-500/25" : ""}`}
        title={canReorder ? `Arrastra para reordenar ${meal.name}` : undefined}
      >
        {/* Agarradera: sólo se ve al pasar el cursor o al enfocar con teclado,
            para no ensuciar la barra con un icono en cada tiempo. */}
        {canReorder ? (
          <span
            className="absolute left-1 top-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none"
            aria-hidden="true"
          >
            <GripHorizontal className="h-3 w-3" />
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onSelectMeal(meal.id)}
          className={`flex min-h-[4.25rem] min-w-[5.5rem] flex-col items-center justify-center rounded-2xl px-4 py-2.5 transition-all duration-200 touch-manipulation ${
            isActive
              ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-[0_12px_28px_-10px_rgba(59,95,235,0.55)] scale-[1.02]"
              : "bg-transparent text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm"
          }`}
        >
          <span className="mb-1 text-base leading-none">{emoji}</span>
          <span className={`whitespace-nowrap text-sm leading-none ${isActive ? "font-bold" : "font-semibold"}`}>
            {meal.name}
          </span>
          <span className={`mt-1 text-[11px] leading-none ${isActive ? "font-semibold text-white/85" : "text-slate-400"}`}>
            {mealCal} kcal
          </span>
          <span
            className={`mt-1.5 h-1.5 w-1.5 rounded-full transition-colors ${
              meal.items.length > 0
                ? isActive
                  ? "bg-white"
                  : "bg-emerald-400"
                : "bg-transparent"
            }`}
            aria-hidden="true"
          />
        </button>
        {isCustom && !readOnly ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onDeleteMeal(meal.id); }}
            className={`absolute -right-0.5 -top-0.5 flex h-7 w-7 items-center justify-center rounded-full transition ${
              isActive ? "bg-white/20 text-white hover:bg-white/30" : "bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
            }`}
            aria-label={`Eliminar ${meal.name}`}
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
    );
  };

  const addButton = !readOnly ? (
    <div className="flex items-center px-1.5">
      <button
        type="button"
        onClick={onAddMeal}
        className="flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3.5 py-2 text-sm font-semibold text-brand-500 transition hover:bg-white hover:shadow-sm"
      >
        <Plus className="h-4 w-4" /> Añadir
      </button>
    </div>
  ) : null;

  const navClass =
    "flex-shrink-0 flex items-stretch gap-1 overflow-x-auto border-b border-slate-200/80 bg-[#f7f8fc]/90 px-2 py-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]";

  // Modo sólo lectura (o un único tiempo): sin dnd, mismo marcado de antes.
  if (!canReorder) {
    return (
      <nav className={navClass} style={{ scrollbarWidth: "none" }}>
        {meals.map(meal => renderTab(meal, null, false))}
        {addButton}
      </nav>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <nav className={navClass} style={{ scrollbarWidth: "none" }}>
        <Droppable droppableId="meal-tabs" direction="horizontal">
          {(dropProvided) => (
            <div
              ref={dropProvided.innerRef}
              {...dropProvided.droppableProps}
              className="flex items-stretch"
            >
              {meals.map((meal, index) => (
                <Draggable
                  key={meal.id}
                  draggableId={String(meal.id)}
                  index={index}
                  // Todo el tab es la agarradera, y su contenido es un <button>.
                  // Por defecto dnd no arranca el arrastre sobre elementos
                  // interactivos, así que sólo se podría arrastrar del borde;
                  // con esto se arrastra desde cualquier punto del tab y el
                  // click de selección sigue funcionando (dnd lo anula sólo
                  // cuando hubo arrastre de verdad).
                  disableInteractiveElementBlocking
                >
                  {(dragProvided, dragSnapshot) => renderTab(meal, dragProvided, dragSnapshot.isDragging)}
                </Draggable>
              ))}
              {dropProvided.placeholder}
            </div>
          )}
        </Droppable>
        {addButton}
      </nav>
    </DragDropContext>
  );
}
