import React from "react";
import { ChevronLeft, ChevronRight, GripVertical, Plus, Trash2, X } from "lucide-react";
import GroupPicker from "./GroupPicker";
import StepperCell from "./StepperCell";
import GroupFoodsPopover from "./GroupFoodsPopover";
import { getNutritionistGroupLabel } from "./exchangeData";
import { getMealVisualPreset } from "@/lib/exchangePlan";

// Tabla del editor por intercambios: cabecera con grupos (arrastrables/reordenables),
// filas por tiempo de comida con steppers de intercambios, fila para agregar comida
// y fila de totales por columna. Extraído de ExchangeDietCreator.jsx.
//
// EN MÓVIL cambia la estrategia de ancho. En escritorio la tabla es `table-fixed
// w-full`: reparte el ancho disponible entre las columnas. En un teléfono eso
// aplasta la matriz — con 5 grupos quedan ~40 px por columna y los steppers no
// se pueden pulsar. Así que en móvil se deja crecer la tabla y se desplaza en
// horizontal, con un ancho mínimo por columna.
//
// Y la primera columna (el tiempo de comida) queda FIJA al desplazarse. Sin eso
// el nutricionista pierde la referencia de qué fila está tocando en cuanto se
// mueve dos columnas a la derecha, que es justo cuando un error se paga caro.
// Primera columna fija en móvil. El fondo tiene que ser opaco: si fuera
// transparente, las celdas que pasan por debajo al desplazarse se verían a
// través. La sombra a la derecha marca el borde del área desplazable.
const columnaFija = (isMobile, capa) =>
  isMobile ? `sticky left-0 ${capa} shadow-[6px_0_8px_-6px_rgba(59, 95, 235,0.25)]` : '';

export default function ExchangeTable({
  isMobile = false,
  firstColumnWidth,
  isCompactTable,
  isUltraCompactTable,
  showGroupPicker,
  setShowGroupPicker,
  activeGroupKeys,
  addGroup,
  activeGroups,
  draggedGroupKey,
  dragOverGroupKey,
  removeGroup,
  handleGroupDragEnter,
  handleGroupDragStart,
  clearGroupDragState,
  handleGroupDrop,
  handleMoveGroupClick,
  meals,
  updateActiveScenario,
  updateExchange,
  removeMeal,
  addMeal,
  groupColTotals,
}) {
  return (
    <div className="flex-1 overflow-auto bg-transparent p-3 lg:p-4">
        <div className="overflow-x-auto overflow-y-visible rounded-[26px] border-2 border-[#ddd9ff] bg-[linear-gradient(180deg,#ffffff_0%,#fbfaff_100%)] shadow-[0_24px_50px_-40px_rgba(59, 95, 235,0.18)] ring-1 ring-[#f0edff] backdrop-blur">
          <table className={`border-collapse text-sm ${isMobile ? "w-auto min-w-full" : "w-full table-fixed"}`}>
            <thead>
              <tr className="border-b border-[#e7e4ff] bg-[linear-gradient(180deg,#fcfcff_0%,#f5f4ff_100%)]">
                {/* Add Group button */}
                <th style={{ width: firstColumnWidth, minWidth: firstColumnWidth }} className={`border-r border-[#e7e4ff] bg-[linear-gradient(180deg,#fcfcff_0%,#f5f4ff_100%)] text-left align-top ${columnaFija(isMobile, "z-20")} ${isCompactTable ? "px-3 py-2.5" : "px-4 py-3"}`}>
                  <div className="flex min-h-[110px] flex-col items-center justify-center text-center">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setShowGroupPicker(p => !p)}
                        className={`flex items-center gap-1 rounded-full border border-[#e1deff] bg-[#f6f5ff] font-semibold text-brand-500 shadow-sm shadow-slate-200/20 transition-colors hover:bg-[#efedff] ${isCompactTable ? "h-5 px-2 text-[10px]" : "h-5 px-2 text-[11px]"}`}
                      >
                        <Plus className="h-3 w-3" /> {isUltraCompactTable ? "" : "Grupo"}
                      </button>
                      {showGroupPicker && (
                        <GroupPicker
                          activeKeys={activeGroupKeys}
                          onAdd={addGroup}
                          onClose={() => setShowGroupPicker(false)}
                        />
                      )}
                    </div>
                    {/* La pista de reordenar pide unos 160 px de ancho, que la
                        columna solo alcanza cuando la ventana pasa de ~530 px.
                        Por debajo se oculta con CSS —no con un interruptor de
                        JavaScript— para que aparezca justo cuando cabe, sea cual
                        sea el tamaño. Arrastrar con el dedo tampoco es práctico:
                        en estrecho quedan las flechas, que sí funcionan. */}
                    {isCompactTable ? (
                      <p className="mt-2 hidden text-center text-[10px] font-semibold text-[#9a90df] sm:block">Reordena arrastrando.</p>
                    ) : (
                      <p className="mt-3 hidden max-w-[10rem] text-center text-[10px] font-semibold leading-5 text-[#9a90df] sm:block">
                        Arrastra o usa las flechas para reordenarlos.
                      </p>
                    )}
                  </div>
                </th>

                {/* Group headers */}
                {activeGroups.map((g, index) => {
                  const isDragging = draggedGroupKey === g.key;
                  const isDropTarget = dragOverGroupKey === g.key && draggedGroupKey && draggedGroupKey !== g.key;
                  const canMoveLeft = index > 0;
                  const canMoveRight = index < activeGroups.length - 1;

                  // Ancho mínimo de cada grupo, también continuo: 16 % del ancho
                  // con suelo de 62 px y techo en los 78 de antes. En un celular
                  // de 393 px cada columna pide 63 en vez de 78, y eso son ~15 px
                  // ganados por columna: entra una columna más por pantallazo sin
                  // que el paso (− valor +) quede apretado.
                  return (
                <th key={g.key} style={isMobile ? { minWidth: "clamp(56px, 14.5vw, 78px)" } : undefined} className={`group/col relative px-0.5 py-2 text-center align-top transition-opacity sm:px-1 ${isDragging ? "opacity-60" : "opacity-100"}`}>
                    <button
                      onClick={() => removeGroup(g.key)}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-100 text-red-400 hover:bg-red-200 items-center justify-center hidden group-hover/col:flex z-10"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <div
                      onDragEnter={() => handleGroupDragEnter(g.key)}
                      onDragOver={(event) => {
                        if (!draggedGroupKey || draggedGroupKey === g.key) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleGroupDrop(g.key);
                      }}
                      className={`rounded-[18px] border px-1.5 py-2 transition-all ${isDropTarget ? "border-brand-500/25 bg-[#f5f3ff] shadow-sm" : "border-transparent hover:border-[#ebe8ff]"}`}
                    >
                      <div className="mb-1 flex items-center justify-center">
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => handleGroupDragStart(event, g.key)}
                          onDragEnd={clearGroupDragState}
                          className={`flex cursor-grab items-center justify-center rounded-full text-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-400 active:cursor-grabbing ${isUltraCompactTable ? "h-4 w-4" : "h-5 w-5"}`}
                          title="Arrastra para mover esta columna"
                          aria-label="Arrastra para mover esta columna"
                        >
                          <GripVertical className={`${isUltraCompactTable ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
                        </button>
                      </div>
                      <div className={`rounded-[14px] border border-white/60 px-2 py-2 shadow-sm ${g.headerBg}`}>
                        <div className={`mx-auto inline-flex max-w-full whitespace-normal rounded-lg text-center font-semibold leading-tight ${isCompactTable ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-1.5 text-[11px]"} ${g.color}`}>
                        {getNutritionistGroupLabel(g)}
                        </div>
                        {/* kcal por intercambio + acceso rápido a la lista de
                            alimentos del grupo (popover). El ícono ℹ️ siempre se
                            muestra, incluso en modo ultra-compacto. */}
                        <div className="mt-1.5 flex items-center justify-center gap-1">
                          {!isUltraCompactTable ? <span className="text-[9px] font-medium text-slate-500">{g.kcal} kcal</span> : null}
                          <GroupFoodsPopover group={g} title={getNutritionistGroupLabel(g)} compact={isCompactTable} />
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => handleMoveGroupClick(event, g.key, -1)}
                          disabled={!canMoveLeft}
                          className={`flex items-center justify-center rounded-[6px] border border-slate-200 bg-white text-slate-400 transition-colors hover:border-brand-500 hover:text-brand-500 hover:bg-[#f8f9ff] disabled:cursor-not-allowed disabled:opacity-25 ${isCompactTable ? "h-5 w-5" : "h-5 w-5"}`}
                          title="Mover a la izquierda"
                          aria-label="Mover a la izquierda"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => handleMoveGroupClick(event, g.key, 1)}
                          disabled={!canMoveRight}
                          className={`flex items-center justify-center rounded-[6px] border border-slate-200 bg-white text-slate-400 transition-colors hover:border-brand-500 hover:text-brand-500 hover:bg-[#f8f9ff] disabled:cursor-not-allowed disabled:opacity-25 ${isCompactTable ? "h-5 w-5" : "h-5 w-5"}`}
                          title="Mover a la derecha"
                          aria-label="Mover a la derecha"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                      </div>
                    </div>
                  </th>
                )})}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {meals.map((meal, mealIndex) => {
                const mealVisual = getMealVisualPreset(meal.name, mealIndex);
                return (
                <tr key={meal.id} className="border-b border-[#e9e8ff] transition-colors hover:bg-[#fcfbff]">
                  {/* Meal name + time */}
                  {/* Relleno continuo: en estrecho la celda y su tarjeta se
                      aprietan para que el ancho ganado vaya a las columnas de
                      alimentos, que es lo que el nutricionista viene a mirar.
                      El nombre y la hora siguen legibles porque solo cede el
                      aire de alrededor, no la letra. */}
                  <td style={{ width: firstColumnWidth, minWidth: firstColumnWidth }} className={`border-r border-[#e8e5ff] bg-[linear-gradient(180deg,#ffffff_0%,#fcfbff_100%)] px-[clamp(3px,1vw,10px)] ${columnaFija(isMobile, "z-10")} ${isCompactTable ? "py-1.25" : "py-1.75"}`}>
                    <div className={`rounded-[18px] border px-[clamp(6px,2vw,12px)] py-[clamp(5px,1.6vw,8px)] shadow-sm ${mealVisual.surface} ${mealVisual.border}`}>
                      <div className="min-w-0">
                          <input
                            value={meal.name}
                            onChange={e => updateActiveScenario((scenario) => ({
                              ...scenario,
                              meals: (scenario.meals || []).map((currentMeal) => currentMeal.id === meal.id ? { ...currentMeal, name: e.target.value } : currentMeal),
                            }))}
                            className={`w-full rounded bg-transparent px-1 py-0.5 font-semibold text-slate-700 outline-none focus:bg-white/70 ${isUltraCompactTable ? "text-[12px]" : isCompactTable ? "text-[13px]" : "text-[14px]"}`}
                          />
                          <div className="mt-1 flex items-center gap-1">
                            <input
                              type="time"
                              value={meal.time || ""}
                              onChange={e => updateActiveScenario((scenario) => ({
                                ...scenario,
                                meals: (scenario.meals || []).map((currentMeal) => currentMeal.id === meal.id ? { ...currentMeal, time: e.target.value } : currentMeal),
                              }))}
                              className={`w-full rounded bg-transparent px-1 font-medium text-slate-400 outline-none focus:bg-white/70 ${isUltraCompactTable ? "text-[9px]" : isCompactTable ? "text-[10px]" : "text-[11px]"}`}
                            />
                          </div>
                      </div>
                    </div>
                  </td>

                  {/* Exchange steppers */}
                  {activeGroups.map(g => {
                    const hasValue = (meal.exchanges?.[g.key] || 0) > 0;
                    return (
                    <td key={g.key} className={`border-r border-[#e8e5ff] px-2 py-1.75 text-center transition-colors ${hasValue ? "bg-gradient-to-b from-[#fffcf0] to-[#fff9e6]" : "bg-[linear-gradient(180deg,#ffffff_0%,#fcfbff_100%)]"}`}>
                      <StepperCell
                        value={meal.exchanges?.[g.key] || 0}
                        onChange={val => updateExchange(meal.id, g.key, val)}
                        compact={isCompactTable}
                      />
                    </td>
                    );
                  })}

                  {/* Delete */}
                  <td className="px-2 py-2">
                    {meals.length > 1 && (
                      <button onClick={() => removeMeal(meal.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )})}

              <tr className="border-b border-[#e9e8ff] bg-white/80">
                <td style={{ width: firstColumnWidth, minWidth: firstColumnWidth }} className={`border-r border-[#e8e5ff] bg-white ${columnaFija(isMobile, "z-10")} ${isCompactTable ? "px-2 py-1.5" : "px-2.5 py-2"}`}>
                  <button
                    type="button"
                    onClick={addMeal}
                    className={`flex items-center rounded-[18px] px-2 py-1.5 text-left text-brand-500 transition-colors hover:bg-[#f4f3ff] ${isCompactTable ? "gap-2" : "gap-2.5"}`}
                  >
                    <span className={`flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#5a56f3_0%,#7a84ff_100%)] text-white shadow-[0_14px_24px_-18px_rgba(59, 95, 235,0.8)] ${isCompactTable ? "h-6 w-6 text-xs" : "h-7 w-7 text-sm"}`}>
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                    <span className={`${isUltraCompactTable ? "text-[12px]" : isCompactTable ? "text-[13px]" : "text-[14px]"} font-semibold`}>Agregar tiempo de comida</span>
                  </button>
                </td>
                {activeGroups.map((group) => (
                  <td key={group.key} className="border-r border-[#e8e5ff] bg-[linear-gradient(180deg,#ffffff_0%,#fcfbff_100%)] px-2 py-2 text-center text-slate-200">—</td>
                ))}
                <td />
              </tr>

              {/* Totals row */}
              <tr className="border-t-2 border-[#dedbff] bg-gradient-to-r from-[#f6f5ff] via-[#f1efff] to-[#efeeff]">
                <td style={{ width: firstColumnWidth, minWidth: firstColumnWidth }} className={`border-r border-[#dedbff] bg-[#f6f5ff] ${columnaFija(isMobile, "z-10")} ${isCompactTable ? "px-2 py-2.5" : "px-2.5 py-3"}`}>
                  <div className="rounded-[18px] bg-gradient-to-br from-[#5a56f3] to-[#6c72ff] px-3 py-2 shadow-[0_8px_24px_-12px_rgba(59, 95, 235,0.35)]">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white">Total día</p>
                  </div>
                </td>
                {groupColTotals.map(({ group, total }) => (
                  <td key={group.key} className="border-r border-[#dedbff] px-2 py-3 text-center">
                    <span className={`inline-flex min-w-[2.75rem] items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold transition-all ${total > 0 ? "border border-[#d9e2ff] bg-gradient-to-b from-white to-[#f8fbff] text-[#4566e8] shadow-[0_6px_16px_-4px_rgba(69,102,232,0.25)]" : "border border-[#e8ebf5] bg-[#f5f7fc] text-slate-300"}`}>
                      {total > 0 ? total : "—"}
                    </span>
                  </td>
                ))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
    </div>
  );
}
