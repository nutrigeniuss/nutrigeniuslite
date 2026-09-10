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
        className={`group relative flex items-stretch bg-white ${
          canReorder ? "cursor-grab active:cursor-grabbing" : ""
        } ${isDragging ? "rounded-lg shadow-lg ring-1 ring-brand-500/30 z-10" : ""}`}
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
          className={`flex flex-col items-center justify-center px-5 py-3 min-w-[90px] transition border-b-2 ${
            isActive
              ? "border-amber-500 text-slate-800"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
          }`}
        >
          <span className="text-base leading-none mb-1">{emoji}</span>
          <span className={`text-sm leading-none whitespace-nowrap ${isActive ? "font-bold" : "font-semibold"}`}>
            {meal.name}
          </span>
          <span className={`text-[11px] leading-none mt-1 ${isActive ? "text-amber-500 font-semibold" : "text-slate-400"}`}>
            {mealCal} kcal
          </span>
          {/* Punto verde = la comida ya tiene alimentos cargados */}
          <span
            className={`mt-1 h-1.5 w-1.5 rounded-full transition-colors ${meal.items.length > 0 ? "bg-emerald-400" : "bg-transparent"}`}
            aria-hidden="true"
          />
        </button>
        {isCustom && !readOnly ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onDeleteMeal(meal.id); }}
            className="absolute right-0.5 top-1 h-4 w-4 flex items-center justify-center rounded-full text-slate-300 hover:text-red-400 hover:bg-red-50 transition"
            aria-label={`Eliminar ${meal.name}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        ) : null}
      </div>
    );
  };

  const addButton = !readOnly ? (
    <div className="flex items-center px-2 border-l border-slate-100">
      <button
        type="button"
        onClick={onAddMeal}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-50 transition"
      >
        <Plus className="w-4 h-4" /> Añadir comida
      </button>
    </div>
  ) : null;

  const navClass = "flex-shrink-0 flex items-stretch border-b border-slate-200 bg-white overflow-x-auto";

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
