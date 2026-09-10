import React from "react";
import { Check, Search } from "lucide-react";
import { getPatientGroupLabel } from "./exchangeData";
import { normalizeSearchValue } from "@/lib/exchangePlan";

// Pestaña "Indicaciones de alimentos" del editor por intercambios: por cada grupo
// usado en el plan, permite buscar y seleccionar los alimentos que irán en la
// prescripción impresa. Extraído de ExchangeDietCreator.jsx.
export default function ExchangeFoodIndications({
  allUsedFoodGroups,
  mergedFoodSelections,
  foodSearchByGroup,
  updateFoodSearch,
  updateFoodSelectionsForUsedGroups,
}) {
  return (
    <div className="flex-1 overflow-auto bg-transparent p-4 lg:p-5">
      <div className="rounded-[30px] border border-[#e9e5fb] bg-white/92 p-5 shadow-[0_28px_60px_-45px_rgba(40, 67, 214,0.9)] backdrop-blur">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#ece8fb] bg-[linear-gradient(180deg,#fcfbff_0%,#f7f5ff_100%)] px-4 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#655dc3]">Indicaciones de alimentos</p>
            <p className="mt-1 text-sm text-slate-500">Selecciona los alimentos de los grupos usados en el total del plan para la prescripción impresa.</p>
          </div>
          <div className="rounded-full bg-[#f1efff] px-3 py-1.5 text-xs font-semibold text-[#4d41f1]">
            {allUsedFoodGroups.length} grupos en uso
          </div>
        </div>

        {allUsedFoodGroups.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-[#e7e3fb] bg-[#fcfbff] px-4 py-8 text-center text-sm text-slate-400">No hay grupos usados todavía en las tablas de intercambios.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {allUsedFoodGroups.map(group => {
              const sel = mergedFoodSelections[group.key] || [];
              const foodSearch = foodSearchByGroup[group.key] || "";
              const normalizedFoodSearch = normalizeSearchValue(foodSearch);
              const visibleFoods = group.foods.filter((food) => {
                if (!normalizedFoodSearch) return true;

                const searchableText = normalizeSearchValue([
                  food.name,
                  food.measure,
                  food.grams_raw ? `${food.grams_raw}g crudo` : "",
                  food.grams_cooked ? `${food.grams_cooked}g cocido` : "",
                ].filter(Boolean).join(" "));

                return searchableText.includes(normalizedFoodSearch);
              });

              return (
                <div key={group.key} className="overflow-hidden rounded-[24px] border border-[#ece8fb] bg-white shadow-sm shadow-slate-200/30">
                  <div className={`border-b border-white/70 px-4 py-4 ${group.headerBg}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${group.color}`}>{getPatientGroupLabel(group)}</span>
                        <p className="mt-2 text-sm font-semibold text-slate-800">{getPatientGroupLabel(group)}</p>
                      </div>
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-600">{sel.length}/{group.foods.length}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-slate-500">{group.kcal} kcal · P:{group.protein}g C:{group.carbs}g G:{group.fat}g</p>
                      <div className="flex gap-1">
                        <button onClick={() => updateFoodSelectionsForUsedGroups(group.key, group.foods.map((food) => food.id))}
                          className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-white">Todo</button>
                        <button onClick={() => updateFoodSelectionsForUsedGroups(group.key, [])}
                          className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-white">Ninguno</button>
                      </div>
                    </div>
                    <div className="mt-3 rounded-[16px] border border-white/70 bg-white/80 px-3 py-2.5 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Search className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                        <input
                          type="text"
                          value={foodSearch}
                          onChange={(event) => updateFoodSearch(group.key, event.target.value)}
                          placeholder="Buscar alimento..."
                          className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 outline-none"
                        />
                        {foodSearch ? (
                          <button
                            type="button"
                            onClick={() => updateFoodSearch(group.key, "")}
                            className="text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-600"
                          >
                            Limpiar
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {visibleFoods.length} resultado{visibleFoods.length === 1 ? "" : "s"} visible{visibleFoods.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="max-h-[22rem] divide-y divide-slate-50 overflow-y-auto">
                    {visibleFoods.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs font-medium text-slate-500">No hay coincidencias</p>
                        <p className="mt-1 text-[11px] text-slate-400">Prueba con otro nombre o limpia el filtro.</p>
                      </div>
                    ) : visibleFoods.map(food => {
                      const isOn = sel.includes(food.id);
                      return (
                        <label key={food.id} className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50/80">
                          <button type="button" onClick={() => updateFoodSelectionsForUsedGroups(group.key, (currentGroup) => currentGroup.includes(food.id)
                            ? currentGroup.filter((id) => id !== food.id)
                            : [...currentGroup, food.id])}
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border-2 transition-colors ${isOn ? "border-[#4d41f1] bg-[#4d41f1]" : "border-slate-300"}`}>
                            {isOn && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-700">{food.name}</p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              {food.grams_raw ? `${food.grams_raw}g crudo` : food.grams_cooked ? `${food.grams_cooked}g cocido` : ""} · {food.measure}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
