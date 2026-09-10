import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Minus, X, Zap } from "lucide-react";
import { getWeightForDate } from "@/lib/getWeightForDate";
import { Slider } from "../ui/slider";
import { MACRO_HEX } from "@/lib/macroColors";

/**
 * Panel flotante y movible para edición de macros.
 * Props:
 * - macros: { protein, carbs, fat, calories }
 * - onChange: (macros) => void
 */
/**
 * Permite editar macros en porcentaje o g/kg.
 * Los gramos totales se muestran solo como referencia.
 */

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

const MACRO_ROWS = [
  { key: "protein", label: "Proteínas", color: MACRO_HEX.protein.text, shortLabel: "P" },
  { key: "carbs", label: "Carbohidratos", color: MACRO_HEX.carbs.text, shortLabel: "C" },
  { key: "fat", label: "Grasas", color: MACRO_HEX.fat.text, shortLabel: "G" },
];

const toInt = (value) => Math.round(Number(value) || 0);
const toTwoDecimals = (value) => Math.round((Number(value) || 0) * 100) / 100;

const withAlpha = (hexColor, alpha) => {
  const hex = hexColor.replace("#", "");
  const normalized = hex.length === 3
    ? hex.split("").map((char) => char + char).join("")
    : hex;

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const buildPercentages = (macros) => {
  const calories = Number(macros?.calories) || 0;

  if (!calories) {
    return { protein: 0, carbs: 0, fat: 0 };
  }

  return {
    protein: toInt(((Number(macros?.protein) || 0) * KCAL_PER_GRAM.protein * 100) / calories),
    carbs: toInt(((Number(macros?.carbs) || 0) * KCAL_PER_GRAM.carbs * 100) / calories),
    fat: toInt(((Number(macros?.fat) || 0) * KCAL_PER_GRAM.fat * 100) / calories),
  };
};

const buildKgValues = (macros, weight) => {
  if (!weight) {
    return { protein: "", carbs: "", fat: "" };
  }

  return {
    protein: macros.protein ? toTwoDecimals(macros.protein / weight) : "",
    carbs: macros.carbs ? toTwoDecimals(macros.carbs / weight) : "",
    fat: macros.fat ? toTwoDecimals(macros.fat / weight) : "",
  };
};

const buildMacrosFromPercentages = (calories, percentages) => ({
  calories,
  protein: toInt((calories * (Number(percentages.protein) || 0)) / 100 / KCAL_PER_GRAM.protein),
  carbs: toInt((calories * (Number(percentages.carbs) || 0)) / 100 / KCAL_PER_GRAM.carbs),
  fat: toInt((calories * (Number(percentages.fat) || 0)) / 100 / KCAL_PER_GRAM.fat),
});

export default function MacrosPanel({ macros, onChange, measurements = [], date }) {
  // Estado para posición flotante
  const [pos, setPos] = useState({ x: 80, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);
  const panelRef = useRef(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const didDragRef = useRef(false);

  // Iniciar drag
  const onMouseDown = (e) => {
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
    didDragRef.current = false;
    setOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
    document.body.style.userSelect = "none";
  };
  // Drag activo
  const onMouseMove = (e) => {
    if (!dragging) return;

    const movedX = Math.abs(e.clientX - dragStartRef.current.x);
    const movedY = Math.abs(e.clientY - dragStartRef.current.y);

    if (movedX > 3 || movedY > 3) {
      didDragRef.current = true;
    }

    setPos({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    });
  };
  // Fin drag
  const onMouseUp = () => {
    setDragging(false);
    document.body.style.userSelect = "";
  };
  React.useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  });

  // Obtener peso exacto para la fecha
  const weight = getWeightForDate(measurements, date);
  const [localKg, setLocalKg] = useState(() => buildKgValues(macros, weight));
  const [percentages, setPercentages] = useState(() => buildPercentages(macros));

  useEffect(() => {
    setPercentages(buildPercentages(macros));
    setLocalKg(buildKgValues(macros, weight));
  }, [macros, weight]);

  const syncState = (nextMacros, nextPercentages) => {
    setPercentages(nextPercentages);
    setLocalKg(buildKgValues(nextMacros, weight));
    onChange(nextMacros);
  };

  const handleCaloriesChange = (value) => {
    const calories = Math.max(0, toInt(value));
    const nextMacros = buildMacrosFromPercentages(calories, percentages);
    syncState(nextMacros, percentages);
  };

  const handlePercentageChange = (key, value) => {
    const nextPercentages = {
      ...percentages,
      [key]: Math.max(0, Math.min(100, toInt(value))),
    };
    const nextMacros = buildMacrosFromPercentages(Number(macros.calories) || 0, nextPercentages);
    syncState(nextMacros, nextPercentages);
  };

  const handleKgChange = (key, value) => {
    if (!weight) {
      return;
    }

    const kgValue = Math.max(0, toTwoDecimals(value));
    const grams = toInt(kgValue * weight);
    const calories = Number(macros.calories) || 0;
    const nextMacros = { ...macros, [key]: grams };
    const nextPercentages = {
      ...percentages,
      [key]: calories ? toInt((grams * KCAL_PER_GRAM[key] * 100) / calories) : 0,
    };

    syncState(nextMacros, nextPercentages);
  };

  const pctSum = percentages.protein + percentages.carbs + percentages.fat;

  const handleMinimizedClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    setMinimized(false);
  };

  // Si está minimizado, mostrar solo botón flotante
  if (minimized) {
    return (
      <button
        style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/80 bg-white/92 shadow-[0_18px_38px_rgba(15,23,42,0.18)] backdrop-blur-sm transition hover:scale-[1.02]"
        onMouseDown={onMouseDown}
        onClick={handleMinimizedClick}
        title="Mostrar macros"
      >
        <Zap className="h-5 w-5 text-emerald-500" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 50, minWidth: 304, maxWidth: 320 }}
      className="overflow-hidden rounded-[22px] border border-white/80 bg-white/94 shadow-[0_20px_40px_rgba(15,23,42,0.14)] backdrop-blur-sm"
    >
      <style>{`
        .macro-panel-slider > span:first-child {
          background: linear-gradient(90deg, #dce4f1 0%, #cfd9e7 100%);
          height: 5px;
        }
        .macro-panel-slider > span:first-child > span {
          background: var(--slider-color, #94a3b8);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.24) inset;
        }
        .macro-panel-slider > span:last-child {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.96);
          background: var(--slider-color, #94a3b8);
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.16);
        }
      `}</style>
      {/* Barra de título para mover */}
      <div
        className="cursor-move select-none border-b border-slate-100 bg-slate-50/90 px-3.5 py-2.5"
        onMouseDown={onMouseDown}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="flex items-center gap-2 text-sm font-black text-slate-800">
              <Zap className="h-4.5 w-4.5 text-emerald-500" /> Macros objetivo
            </span>
            <div className="mt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.22em] text-slate-400">
              Ajuste rápido en vivo
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setMinimized(true)} className="rounded-full p-1.5 hover:bg-white" title="Minimizar">
              <Minus className="h-4 w-4 text-slate-400" />
            </button>
            <button onClick={() => setMinimized(true)} className="rounded-full p-1.5 hover:bg-white" title="Ocultar">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>
      {/* Inputs de macros */}
      <div className="space-y-3 p-3">
        <div className="rounded-[16px] border border-slate-200 bg-slate-50/80 px-3 py-2.5 shadow-inner shadow-slate-100/70">
          <div className="text-[0.68rem] font-bold uppercase tracking-[0.28em] text-slate-400">Calorías</div>
          <div className="mt-1.5 flex items-center justify-between gap-3">
            <input
              type="number"
              min={0}
              value={macros.calories}
              onChange={e => handleCaloriesChange(e.target.value)}
              className="w-16 bg-transparent p-0 text-[1.28rem] font-black leading-none text-slate-800 outline-none"
            />
            <span className="text-xs font-semibold text-slate-300">kcal</span>
          </div>
        </div>

        <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
          <div className="mb-2.5 text-[0.64rem] font-bold uppercase tracking-[0.24em] text-slate-400">Macros</div>

          <div className="space-y-2.5">
            {MACRO_ROWS.map(({ key, label, color, shortLabel }) => (
              <div
                key={key}
                className="rounded-[16px] border px-3 py-2.5"
                style={{
                  background: `linear-gradient(180deg, ${withAlpha(color, 0.08)} 0%, rgba(255,255,255,0.96) 80%)`,
                  borderColor: withAlpha(color, 0.16),
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[12px] text-[0.62rem] font-black"
                    style={{ background: withAlpha(color, 0.12), color }}
                  >
                    {shortLabel}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.86rem] font-bold text-slate-800">{label}</div>
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-[14px] px-2 py-1"
                    style={{ background: withAlpha(color, 0.12) }}
                  >
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={percentages[key]}
                      onChange={e => handlePercentageChange(key, e.target.value)}
                      className="w-8 border-0 bg-transparent p-0 text-right text-[0.84rem] font-black outline-none"
                      style={{ color }}
                    />
                    <span className="text-[0.68rem] font-black" style={{ color }}>%</span>
                  </div>
                </div>

                <div className="mt-2 px-0.5">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[percentages[key]]}
                    onValueChange={([value]) => handlePercentageChange(key, value)}
                    className="macro-panel-slider w-full"
                    style={{ "--slider-color": color }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="rounded-[14px] border border-slate-200 bg-white px-2.5 py-1.5 text-[0.76rem] font-bold text-slate-700 shadow-sm">
                    {macros[key] || 0} g
                  </div>
                  <div className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={localKg[key]}
                      onChange={e => handleKgChange(key, e.target.value)}
                      className="w-9 border-0 bg-transparent p-0 text-right text-[0.68rem] font-semibold text-slate-700 outline-none disabled:text-slate-300"
                      disabled={!weight}
                    />
                    <span className="text-[0.56rem] font-bold uppercase tracking-[0.12em] text-slate-300">g/kg</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`flex items-center justify-between rounded-[16px] border px-3 py-2 ${pctSum === 100 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
          <span className={`text-[0.72rem] font-black ${pctSum === 100 ? "text-emerald-700" : "text-amber-700"}`}>Suma: {pctSum}%</span>
          <span className={`text-[0.68rem] font-bold ${pctSum === 100 ? "text-emerald-600" : "text-amber-700"}`}>
            {pctSum === 100 ? "Correcto" : "Debe sumar 100%"}
          </span>
        </div>

        {!weight && (
          <div className="flex items-start gap-2 rounded-[16px] border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span className="text-[0.68rem] font-semibold leading-4">No hay peso registrado para la fecha seleccionada. El campo g/kg está deshabilitado.</span>
          </div>
        )}
      </div>
    </div>
  );
}
