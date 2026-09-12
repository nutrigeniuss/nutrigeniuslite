import React, { useMemo } from "react";
import { buildMicronutrientSummary, calculatePlanItemTotals, EXTENDED_MICRONUTRIENT_KEYS, PRIMARY_MICRONUTRIENT_KEYS } from "@/lib/foodNutrients";
import { MACRO_HEX, MACRO_STYLES } from "@/lib/macroColors";

// ── Resumen Nutricional del recordatorio 24h ────────────────────────────────────
// Donut de macros + objetivo calórico + distribución por comida + micronutrientes
// con semáforo de adecuación. Extraído de Recall24hEditor.jsx.
export default function NutriSummary({ items, meals, targetCalories }) {
  const totals = useMemo(() => calculatePlanItemTotals(items), [items]);

  const cal  = Math.round(totals.calories);
  const pct  = targetCalories > 0 ? Math.min(Math.round((cal / targetCalories) * 100), 100) : 0;
  const over = targetCalories > 0 && cal > targetCalories;

  const macroKcalSum = totals.carbs * 4 + totals.protein * 4 + totals.fat * 9;
  const totalCalFromMacros = macroKcalSum || 1;
  const hasMacros = macroKcalSum > 0;
  // Colores desde @/lib/macroColors. Antes estaban a mano y no cuadraban entre
  // sí: la proteína declaraba el hex #ff4444 pero pintaba el punto con
  // `bg-red-400`, que es un rojo más pálido, y el texto en -500 en vez de -600.
  const macros = [
    { label: "Carbohidratos", short: "CHO", val: Math.round(totals.carbs),   unit: "g", kcal: totals.carbs * 4,   hex: MACRO_HEX.carbs.fill,   color: MACRO_STYLES.carbs.dot,   text: MACRO_STYLES.carbs.value,   pctCal: Math.round((totals.carbs * 4 / totalCalFromMacros) * 100) },
    { label: "Proteínas",     short: "PRO", val: Math.round(totals.protein), unit: "g", kcal: totals.protein * 4, hex: MACRO_HEX.protein.fill, color: MACRO_STYLES.protein.dot, text: MACRO_STYLES.protein.value, pctCal: Math.round((totals.protein * 4 / totalCalFromMacros) * 100) },
    { label: "Grasas",        short: "GRA", val: Math.round(totals.fat),     unit: "g", kcal: totals.fat * 9,     hex: MACRO_HEX.fat.fill,     color: MACRO_STYLES.fat.dot,     text: MACRO_STYLES.fat.value,     pctCal: Math.round((totals.fat * 9 / totalCalFromMacros) * 100) },
  ];
  // Tramos del donut de macros (conic-gradient, sin dependencias de charting).
  const donutStops = `${macros[0].hex} 0 ${macros[0].pctCal}%, ${macros[1].hex} ${macros[0].pctCal}% ${macros[0].pctCal + macros[1].pctCal}%, ${macros[2].hex} ${macros[0].pctCal + macros[1].pctCal}% 100%`;

  const micros = buildMicronutrientSummary(totals, [...PRIMARY_MICRONUTRIENT_KEYS, ...EXTENDED_MICRONUTRIENT_KEYS]).map((micro) => ({
    ...micro,
    val: micro.value,
    color: micro.key === "sodium" ? "bg-rose-400" : "bg-emerald-400",
  }));

  return (
    // Resumen nutricional moderno: donut de macros + objetivo + micros con
    // semáforo de adecuación al valor de referencia.
    <div className="bg-white rounded-[16px] border border-[#e2e8f0]/80 shadow-[0_1px_3px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06)] p-5 mt-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Resumen Nutricional del Día</p>
        <span className="text-[10px] font-semibold text-slate-400">{items.length} {items.length === 1 ? "alimento" : "alimentos"}</span>
      </div>

      {/* Calorías (donut de macros) + objetivo + leyenda */}
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 mb-4">
        <div className="flex items-center justify-center">
          <div
            className="relative h-[120px] w-[120px] rounded-full"
            style={{ background: hasMacros ? `conic-gradient(${donutStops})` : "#eef1fe" }}
          >
            <div className="absolute inset-[14px] rounded-full bg-white flex flex-col items-center justify-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]">
              <span className={`text-xl font-extrabold leading-none ${over ? "text-red-600" : "text-brand-600"}`}>{cal}</span>
              <span className="text-[10px] font-semibold text-slate-400">kcal</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3">
          {targetCalories > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-slate-500">Objetivo: {targetCalories} kcal</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${over ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-600"}`}>{pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${over ? "bg-red-500" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {macros.map(m => (
              <div key={m.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.hex }} />
                <span className="text-xs font-semibold text-slate-600 w-24 flex-shrink-0">{m.label}</span>
                <span className={`text-xs font-extrabold ${m.text}`}>{m.val}{m.unit}</span>
                <span className="text-[10px] text-slate-400 ml-auto tabular-nums">{Math.round(m.kcal)} kcal · {m.pctCal}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Distribución por comida */}
      {meals && meals.some(m => m.items.length > 0) && (
        <div className="mb-4 rounded-[12px] bg-slate-50/70 border border-slate-100 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Distribución por Comida</p>
          <div className="space-y-1.5">
            {meals.filter(m => m.items.length > 0).map(m => {
              const mCal = Math.round(m.items.reduce((s, i) => s + (i.calories || 0) * (i.quantity || 1), 0));
              const mPct = cal > 0 ? Math.round((mCal / cal) * 100) : 0;
              return (
                <div key={m.id} className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium w-24 truncate">{m.name}</span>
                  <div className="flex-1 bg-slate-200/70 rounded-full h-1.5">
                    <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${mPct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-500 w-20 text-right tabular-nums">{mCal} <span className="text-[10px] text-brand-500">({mPct}%)</span></span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Micronutrientes — chips con semáforo de adecuación */}
      {micros.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Micronutrientes</p>
          <div className="grid grid-cols-2 gap-2.5">
            {micros.map(m => {
              const ratio = m.target ? (m.val / m.target) * 100 : 0;
              const pctM = Math.min(Math.round(ratio), 100);
              const tone = ratio >= 80
                ? { bar: "bg-emerald-400", chip: "text-emerald-600 bg-emerald-50" }
                : ratio >= 40
                  ? { bar: "bg-amber-400", chip: "text-amber-600 bg-amber-50" }
                  : { bar: "bg-rose-400", chip: "text-rose-600 bg-rose-50" };
              return (
                <div key={m.label} className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center justify-between mb-1.5 gap-1">
                    <span className="text-[11px] font-semibold text-slate-600 truncate">{m.label}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${tone.chip}`}>{Math.round(ratio)}%</span>
                  </div>
                  <p className="text-sm font-extrabold text-slate-800 leading-none mb-1.5">{m.val}<span className="text-[10px] font-semibold text-slate-400 ml-0.5">{m.unit}</span></p>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className={`${tone.bar} h-1.5 rounded-full transition-all`} style={{ width: `${pctM}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">de {m.target} {m.unit} ref.</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
