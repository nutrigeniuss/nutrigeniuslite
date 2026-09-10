import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { getNutritionistGroupLabel } from "./exchangeData";
import { getMealVisualPreset } from "@/lib/exchangePlan";
import { MACRO_HEX, MACRO_ORDER, MACRO_STYLES } from "@/lib/macroColors";

// Panel lateral izquierdo "Resumen del Día": progreso calórico, macros y desglose por tiempo de comida.
export default function ResumenPanel({ totals, targetKcal, macroTargets: macroTargetsProp, groupColTotals, meals, collapsed = false, onToggleCollapse }) {
  const [viewMode, setViewMode] = useState("general");
  const calPct = targetKcal > 0 ? Math.round((totals.kcal / targetKcal) * 100) : 0;
  const displayCalPct = Math.max(0, calPct);
  const displayProgress = Math.min(displayCalPct, 100);
  const totalExchanges = groupColTotals.reduce((sum, groupEntry) => sum + groupEntry.total, 0);
  const activeGroups = groupColTotals.map(({ group }) => group);

  // Objetivos de macros: usamos la distribución REAL del paciente (target_carbs
  // /protein/fat guardados en su requerimiento) cuando el padre la pasa. Solo si
  // no llega, caemos a un reparto 55/15/30 del objetivo calórico como referencia.
  // Antes SIEMPRE se usaba el 55/15/30 fijo, así que el panel ignoraba los macros
  // que el nutricionista establecía o editaba.
  const macroTargets = macroTargetsProp && (macroTargetsProp.carbs || macroTargetsProp.protein || macroTargetsProp.fat)
    ? macroTargetsProp
    : {
        carbs: targetKcal * 0.55 / 4,
        protein: targetKcal * 0.15 / 4,
        fat: targetKcal * 0.30 / 9,
      };

  // Colores desde @/lib/macroColors, los mismos del panel de dietas por
  // alimentos y de la ficha del paciente.
  const macros = MACRO_ORDER.map((key) => ({
    key,
    label: MACRO_STYLES[key].name,
    barColor: MACRO_HEX[key].fill,
    pctColor: MACRO_HEX[key].text,
  }));

  const getMealTotals = (meal) => ({
    kcal: activeGroups.reduce((s, g) => s + parseFloat(meal.exchanges?.[g.key] || 0) * g.kcal, 0),
    protein: activeGroups.reduce((s, g) => s + parseFloat(meal.exchanges?.[g.key] || 0) * g.protein, 0),
    carbs: activeGroups.reduce((s, g) => s + parseFloat(meal.exchanges?.[g.key] || 0) * g.carbs, 0),
    fat: activeGroups.reduce((s, g) => s + parseFloat(meal.exchanges?.[g.key] || 0) * g.fat, 0),
  });

  // Estado colapsado (desktop): barra angosta con botón para expandir. Mismo
  // patrón que el panel "por alimentos".
  if (collapsed) {
    return (
      <div className="flex h-full w-full flex-col items-center px-2 py-4">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          aria-label="Expandir resumen nutricional"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="mt-4 flex flex-1 items-center justify-center">
          <span className="-rotate-180 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 [writing-mode:vertical-rl]">
            Nutrientes
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 px-5 py-4">

        {/* Header estandarizado (mismo ícono y texto que el panel "Por alimentos"). */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-50 to-[#f4f2ff] text-[#5a56f3] ring-1 ring-[#e7e3ff] shadow-[0_1px_2px_rgba(59, 95, 235,0.10)]">
              <Sparkles className="h-[15px] w-[15px]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold tracking-tight text-slate-800 leading-tight">Resumen del Día</h3>
              <p className="text-[10px] text-slate-400 leading-tight">Análisis nutricional</p>
            </div>
          </div>
          {onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label="Minimizar resumen nutricional"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#5751f3_0%,#6c72ff_52%,#88a0ff_100%)] px-[18px] pb-[18px] pt-[18px] text-white shadow-[0_18px_38px_-30px_rgba(87,81,243,0.74)]">
          <div className="absolute -right-12 top-8 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 left-16 h-20 w-20 rounded-full bg-[#c7c2ff]/18 blur-3xl" />

          <div className="relative flex items-center gap-4">
            <div
              className="flex h-[90px] w-[90px] items-center justify-center rounded-full p-2"
              style={{
                background: `conic-gradient(#95ff69 0deg ${displayProgress * 3.6}deg, rgba(255,255,255,0.14) ${displayProgress * 3.6}deg 360deg)`,
              }}
            >
              <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[rgba(70,63,191,0.82)] shadow-inner shadow-black/10 backdrop-blur">
                <span className="text-[25px] font-extrabold leading-none">{displayCalPct}%</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Meta</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-end gap-1">
                <span className="text-[40px] font-extrabold leading-none tracking-tight">{Math.round(totals.kcal)}</span>
                <span className="pb-1 text-[14px] font-semibold text-white/74">kcal</span>
              </div>
              <p className="mt-1 text-[13px] font-semibold text-white/78">de {targetKcal} objetivo</p>
            </div>
          </div>

          <div className="relative mt-5">
            <div className="flex items-center gap-2 rounded-[18px] border border-[#37d96c]/24 bg-white/10 px-3.5 py-3 backdrop-blur-sm">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#35df70]/16 text-sm text-[#9bff72]">⚡</span>
              <div>
                <p className="text-[11px] font-bold text-white">{totalExchanges || "0"} intercambios completados</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-[18px] border border-[#e7e4ff] bg-[#f7f6ff]/92 p-1 shadow-sm shadow-slate-200/20 backdrop-blur">
        {[
          { key: "general", label: "General" },
          { key: "meals", label: "Tiempo de comida" },
        ].map((option) => {
          const active = viewMode === option.key;
          return (
            <button
              key={option.key}
              onClick={() => setViewMode(option.key)}
              className={`flex h-9 flex-1 items-center justify-center rounded-[14px] px-3 text-[11px] font-semibold transition-colors ${active ? "bg-[linear-gradient(135deg,#5a56f3_0%,#7a84ff_100%)] text-white shadow-[0_10px_18px_-18px_rgba(59, 95, 235,0.76)]" : "text-slate-400 hover:bg-white hover:text-slate-700"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

        <div className="space-y-3.5 pb-2">
          {viewMode === "general" ? (
            <>
              <div className="rounded-[20px] border border-[#ece8fb] bg-white/92 p-4 shadow-sm shadow-slate-200/15">
                <div className="space-y-2">
                {macros.map(({ key, label, barColor, pctColor }) => {
                  const val = Math.round(totals[key] || 0);
                  const tgt = Math.round(macroTargets[key] || 1);
                  const pct = Math.min(Math.round((val / tgt) * 100), 200);
                  const displayPct = Math.min(pct, 100);
                  const cardBg = key === "carbs"
                    ? "bg-gradient-to-br from-[#fffaeb] to-[#fef3c7]"
                    : key === "protein"
                      ? "bg-gradient-to-br from-[#fef2f2] to-[#fee2e2]"
                      : "bg-gradient-to-br from-[#ecf8ff] to-[#cffafe]";
                  return (
                    <div key={key} className={`rounded-[15px] border border-slate-100/90 px-3 py-2.5 ${cardBg}`}>
                      <div className="mb-1.5 flex items-baseline gap-1.5">
                        <span className="text-[13px] font-semibold text-slate-700">{label}</span>
                        <span className="ml-auto text-[13px] font-bold text-slate-800">{val}g <span className="text-slate-300 font-normal">/ {tgt}g</span></span>
                        <span className="text-[10px] font-bold" style={{ color: pctColor }}>{pct}%</span>
                      </div>
                      <div className="bg-white/80 rounded-full h-2 overflow-hidden border border-white/80">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${displayPct}%`, backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>

              {groupColTotals.some(g => g.total > 0) ? (
                <div className="rounded-[20px] border border-[#ece8fb] bg-white/92 p-4 shadow-sm shadow-slate-200/15">
                  <div className="space-y-1.5">
                  {groupColTotals.filter(g => g.total > 0).map(({ group, total }) => (
                    <div key={group.key} className="flex items-center justify-between rounded-[14px] border border-slate-100 bg-[#fcfcff] px-3 py-2">
                      <span className="text-[12px] font-semibold text-slate-600">{getNutritionistGroupLabel(group)}</span>
                      <span className="text-[12px] font-bold text-slate-700">{total}</span>
                    </div>
                  ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              {meals.map(meal => {
                const mt = getMealTotals(meal);
                const mealPct = totals.kcal > 0 ? Math.round((mt.kcal / totals.kcal) * 100) : 0;
                const hasData = mt.kcal > 0;
                const mealVisual = getMealVisualPreset(meal.name);
                return (
                  <div key={meal.id} className={`rounded-[20px] border px-3.5 py-3 transition-colors ${hasData ? `bg-white ${mealVisual.border}` : "border-slate-200 bg-slate-50/80"}`}>
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 leading-none">{meal.name}</p>
                          {meal.time ? <p className="mt-1 text-[10px] font-medium text-slate-400">{meal.time}</p> : null}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={`rounded-[14px] px-2.5 py-1.5 ${hasData ? mealVisual.surface : "bg-slate-100"}`}>
                          <p className={`text-sm font-bold ${hasData ? "text-slate-800" : "text-slate-400"}`}>{hasData ? `${Math.round(mt.kcal)} kcal` : "0 kcal"}</p>
                          <p className={`text-[10px] font-semibold ${hasData ? "text-brand-500" : "text-slate-400"}`}>
                            {hasData ? `${mealPct}% del total` : "Sin carga"}
                          </p>
                        </div>
                      </div>
                    </div>
                    {hasData ? (
                      <>
                        <div className="mt-2.5">
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#ece8fb]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-coral-500 transition-all duration-500"
                              style={{ width: `${Math.min(mealPct, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-semibold">
                          <span className="rounded-full bg-[var(--ng-amber-50)] px-1.5 py-0.5 text-[var(--ng-amber-500)]">CHO {Math.round(mt.carbs)}g</span>
                          <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-brand-500">PRO {Math.round(mt.protein)}g</span>
                          <span className="rounded-full bg-[var(--ng-coral-50)] px-1.5 py-0.5 text-[var(--ng-coral-500)]">GRA {Math.round(mt.fat)}g</span>
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 rounded-[12px] border border-dashed border-slate-200 bg-white/80 px-2.5 py-2 text-[10px] font-medium text-slate-400">
                        Sin intercambios cargados.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
