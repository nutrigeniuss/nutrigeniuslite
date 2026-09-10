import React, { useState } from "react";
import { ChevronDown, ChevronUp, Flame, Beef, Wheat, Droplets } from "lucide-react";
import { buildMicronutrientSummary, calculatePlanItemTotals, EXTENDED_MICRONUTRIENT_KEYS, PRIMARY_MICRONUTRIENT_KEYS } from "@/lib/foodNutrients";

const MacroRing = ({ value, max, color, size = 80 }) => {
  const pct = Math.min((value / max) * 100, 100);
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f4f2" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
    </svg>
  );
};

export default function NutritionalPanel({ totals, targets, meals }) {
  const [showMicros, setShowMicros] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState("total");

  const calPct = targets.calories > 0 ? Math.round((totals.calories / targets.calories) * 100) : 0;

  const getMealTotals = (mealId) => {
    if (mealId === "total") return totals;
    const meal = meals.find(m => m.id === mealId);
    if (!meal) return calculatePlanItemTotals([]);
    return calculatePlanItemTotals(meal.items || []);
  };

  const view = getMealTotals(selectedMeal);
  const viewTargets = selectedMeal === "total" ? targets : {
    calories: targets.calories / meals.length || 400,
    protein: targets.protein / meals.length || 30,
    carbs: targets.carbs / meals.length || 50,
    fat: targets.fat / meals.length || 15,
  };

  const macros = [
    { key: "carbs", label: "Carbohidratos", color: "#14b8a6", unit: "g", icon: Wheat },
    { key: "protein", label: "Proteínas", color: "#6366f1", unit: "g", icon: Beef },
    { key: "fat", label: "Grasas", color: "#f59e0b", unit: "g", icon: Droplets },
  ];

  const totalCalFromMacros = view.carbs * 4 + view.protein * 4 + view.fat * 9;
  const micros = buildMicronutrientSummary(view, [...PRIMARY_MICRONUTRIENT_KEYS, ...EXTENDED_MICRONUTRIENT_KEYS]);

  return (
    <aside className="w-72 flex-shrink-0 h-full overflow-y-auto bg-white border-l border-slate-100 flex flex-col">
      <div className="p-5 border-b border-slate-100">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Panel Nutricional</h2>

        {/* Calorías */}
        <div className="bg-gradient-to-br from-emerald-50 to-brand-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium text-slate-500">Calorías</span>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${calPct > 100 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
              {calPct}%
            </span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-slate-800">{Math.round(totals.calories)}</span>
            <span className="text-sm text-slate-400 mb-0.5">/ {targets.calories} kcal</span>
          </div>
          <div className="mt-3 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${calPct > 100 ? 'bg-red-400' : 'bg-gradient-to-r from-emerald-400 to-brand-500'}`}
              style={{ width: `${Math.min(calPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Selector de vista */}
        <div className="mb-4">
          <p className="text-xs text-slate-400 mb-2 font-medium">Ver aporte de:</p>
          <select
            value={selectedMeal}
            onChange={e => setSelectedMeal(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="total">Dieta completa</option>
            {meals.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* Macros */}
        <div className="space-y-3">
          {macros.map(({ key, label, color, unit: _unit }) => {
            const val = Math.round(view[key] || 0);
            const tgt = Math.round(viewTargets[key] || 1);
            const pct = Math.min(Math.round((val / tgt) * 100), 100);
            const calContrib = key === "fat" ? val * 9 : val * 4;
            const calPctMacro = totalCalFromMacros > 0 ? Math.round((calContrib / totalCalFromMacros) * 100) : 0;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-medium text-slate-600">{label}</span>
                  <span className="text-xs text-slate-400">{val}g <span className="text-slate-300">/</span> {tgt}g</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <span className="text-xs font-semibold w-8 text-right" style={{ color }}>{calPctMacro}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Macros rings */}
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex justify-around">
          {macros.map(({ key, label, color, unit: _unit }) => {
            const val = Math.round(view[key] || 0);
            const tgt = Math.round(viewTargets[key] || 1);
            return (
              <div key={key} className="flex flex-col items-center gap-1">
                <div className="relative">
                  <MacroRing value={val} max={tgt} color={color} size={64} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700">{val}</span>
                </div>
                <span className="text-xs text-slate-400">{label.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Micronutrientes */}
      <div className="p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">🧪 Micronutrientes</span>
        </div>

        {/* Siempre visibles */}
        {micros.slice(0, 2).map(micro => {
          const pct = Math.min(Math.round((micro.value / micro.target) * 100), 100);
          return (
            <div key={micro.key} className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">{micro.label} ({micro.unit})</span>
                <span className="text-xs font-semibold text-slate-600">{micro.value} <span className="text-slate-300 font-normal">{pct}%</span></span>
              </div>
              <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${micro.key === 'sodium' ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}

        {/* Expandibles */}
        <button
          onClick={() => setShowMicros(!showMicros)}
          className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-600 font-semibold mt-1 transition-colors"
        >
          {showMicros ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showMicros ? "Ver menos" : "Ver más micronutrientes"}
        </button>

        {showMicros && (
          <div className="mt-3 space-y-3">
            {micros.slice(2).map(micro => (
              <div key={micro.key} className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-xs text-slate-500">{micro.label} ({micro.unit})</span>
                <span className="text-xs font-medium text-slate-500">{micro.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}