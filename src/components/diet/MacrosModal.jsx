import React, { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { getWeightForDate } from "@/lib/getWeightForDate";
import { Slider } from "../ui/slider";
import { MACRO_HEX } from "@/lib/macroColors";

const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

const MACRO_FIELDS = [
  { key: "protein", label: "Proteínas", color: MACRO_HEX.protein.text, shortLabel: "P" },
  { key: "carbs", label: "Carbohidratos", color: MACRO_HEX.carbs.text, shortLabel: "C" },
  { key: "fat", label: "Grasas", color: MACRO_HEX.fat.text, shortLabel: "G" },
];

const toInt = (value) => Math.round(Number(value) || 0);
const toTwoDecimals = (value) => Math.round((Number(value) || 0) * 100) / 100;

// Genera fondos y bordes suaves a partir del color principal de cada macro.
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

/**
 * Modal central para edición de macros antes de crear la dieta.
 * Solo porcentaje y g/kg son editables; los gramos totales son informativos.
 */
export default function MacrosModal({
  visible,
  macros,
  onChange,
  onSave,
  measurements = [],
  date,
}) {
  const weight = getWeightForDate(measurements, date);
  const [localMacros, setLocalMacros] = useState(macros);
  const [percentages, setPercentages] = useState(() => buildPercentages(macros));
  const [localKg, setLocalKg] = useState(() => buildKgValues(macros, weight));

  useEffect(() => {
    setLocalMacros(macros);
    setPercentages(buildPercentages(macros));
    setLocalKg(buildKgValues(macros, weight));
  }, [macros, weight]);

  if (!visible) {
    return null;
  }

  const syncState = (nextMacros, nextPercentages) => {
    setLocalMacros(nextMacros);
    setPercentages(nextPercentages);
    setLocalKg(buildKgValues(nextMacros, weight));
  };

  const handleCaloriesChange = (value) => {
    const calories = Math.max(0, toInt(value));
    const nextMacros = buildMacrosFromPercentages(calories, percentages);
    syncState(nextMacros, percentages);
  };

  const handlePercentageChange = (key, value) => {
    const nextValue = Math.max(0, Math.min(100, toInt(value)));
    const nextPercentages = { ...percentages, [key]: nextValue };
    const nextMacros = buildMacrosFromPercentages(Number(localMacros.calories) || 0, nextPercentages);
    syncState(nextMacros, nextPercentages);
  };

  const handleKgChange = (key, value) => {
    if (!weight) {
      return;
    }

    const kgValue = Math.max(0, toTwoDecimals(value));
    const grams = toInt(kgValue * weight);
    const calories = Number(localMacros.calories) || 0;
    const nextMacros = { ...localMacros, [key]: grams };
    const nextPercentages = {
      ...percentages,
      [key]: calories ? toInt((grams * KCAL_PER_GRAM[key] * 100) / calories) : 0,
    };

    syncState(nextMacros, nextPercentages);
  };

  const handleConfirm = () => {
    onChange(localMacros);
    onSave();
  };

  const pctSum = percentages.protein + percentages.carbs + percentages.fat;
  const sumStatus = pctSum === 100
    ? "Correcto"
    : pctSum < 100
      ? `Faltan ${100 - pctSum}%`
      : `Sobran ${pctSum - 100}%`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[2px]">
      <style>{`
        .macro-modal-shell {
          background:
            radial-gradient(circle at top right, rgba(56, 189, 248, 0.12), transparent 26%),
            radial-gradient(circle at bottom left, rgba(255, 77, 87, 0.10), transparent 24%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }
        .macro-slider > span:first-child {
          background: linear-gradient(90deg, #dce4f1 0%, #cfd9e7 100%);
          height: 6px;
        }
        .macro-slider > span:first-child > span {
          background: var(--slider-color, #14b8a6);
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25) inset;
        }
        .macro-slider > span:last-child {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          border: 2px solid rgba(255, 255, 255, 0.96);
          background: var(--slider-color, #14b8a6);
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.16);
          transition: transform 140ms ease, box-shadow 140ms ease;
        }
        .macro-slider > span:last-child:hover {
          transform: scale(1.06);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.2);
        }
      `}</style>
      <div className="macro-modal-shell relative w-full max-w-[700px] overflow-hidden rounded-[24px] border border-white/80 shadow-[0_16px_44px_rgba(15,23,42,0.11)]">
        <div className="absolute -top-14 right-10 h-28 w-28 rounded-full bg-sky-100/60 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-6 h-40 w-40 rounded-full bg-rose-100/65 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-h-[calc(100vh-3rem)] overflow-y-auto px-4 py-4 sm:px-5 lg:px-5 lg:py-5">
          <button
            onClick={onSave}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/85 text-slate-300 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-500"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="max-w-[360px] pr-12 lg:pr-0">
              <h2 className="text-[1.45rem] font-black leading-[1.02] tracking-[-0.03em] text-slate-900 sm:text-[1.62rem]">
                Define los macros objetivo antes de crear la dieta.
              </h2>
          </div>

          <div className="mt-3 inline-flex items-center gap-4 rounded-[16px] border border-slate-200/80 bg-white px-3.5 py-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <div>
                <div className="text-[0.68rem] font-bold uppercase tracking-[0.32em] text-slate-400">
                  Calorías
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-[16px] border border-slate-200 bg-slate-50 px-3.5 py-1.5 shadow-inner shadow-slate-100">
              <input
                type="number"
                min={0}
                value={localMacros.calories}
                onChange={(e) => handleCaloriesChange(e.target.value)}
                className="w-16 bg-transparent text-right text-[1.4rem] font-black leading-none text-slate-800 outline-none"
              />
                <span className="text-sm font-semibold text-slate-300">kcal</span>
              </div>
          </div>

          <div className="mt-4 max-w-[560px] space-y-2.5">
            {MACRO_FIELDS.map(({ key, label, color, shortLabel }) => (
              <div
                key={key}
                className="rounded-[20px] border px-3.5 py-2.5 shadow-[0_6px_18px_rgba(15,23,42,0.035)]"
                style={{
                  background: `linear-gradient(180deg, ${withAlpha(color, 0.08)} 0%, rgba(255,255,255,0.96) 74%)`,
                  borderColor: withAlpha(color, 0.18),
                }}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="flex min-w-[0] flex-1 items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[12px] text-[0.62rem] font-black shadow-sm"
                      style={{
                        background: withAlpha(color, 0.14),
                        color,
                      }}
                    >
                      {shortLabel}
                    </div>
                    <div className="min-w-[0]">
                      <div className="text-[0.9rem] font-bold text-slate-800">{label}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
                    <div
                      className="flex items-center gap-1 rounded-[14px] px-2.5 py-1 shadow-sm"
                      style={{ background: withAlpha(color, 0.12) }}
                    >
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={percentages[key]}
                        onChange={(e) => handlePercentageChange(key, e.target.value)}
                        className="w-8 border-0 bg-transparent p-0 text-right text-[0.92rem] font-black outline-none"
                        style={{ color }}
                      />
                      <span className="text-xs font-black" style={{ color }}>%</span>
                    </div>

                    <div className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                      <span className="text-[0.72rem] font-bold uppercase tracking-[0.24em] text-slate-300">g</span>
                      <span className="min-w-[38px] text-right text-[0.88rem] font-bold text-slate-800">
                        {localMacros[key] || 0}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={localKg[key]}
                        onChange={(e) => handleKgChange(key, e.target.value)}
                        className="w-10 border-0 bg-transparent p-0 text-right text-[0.72rem] font-semibold text-slate-700 outline-none disabled:text-slate-300"
                        disabled={!weight}
                      />
                      <span className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-slate-300">g/kg</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 px-0.5">
                  <Slider
                    min={0}
                    max={100}
                    step={1}
                    value={[percentages[key]]}
                    onValueChange={([value]) => handlePercentageChange(key, value)}
                    className="macro-slider w-full"
                    style={{ "--slider-color": color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div
            className={`mt-3 flex max-w-[400px] items-center justify-between rounded-[14px] border px-3.5 py-2 ${
              pctSum === 100
                ? "border-emerald-200 bg-emerald-50/90"
                : "border-amber-200 bg-amber-50/90"
            }`}
          >
            <span className={`text-[0.82rem] font-black ${pctSum === 100 ? "text-emerald-700" : "text-amber-700"}`}>
              Suma: {pctSum}%
            </span>
            <span className={`text-[0.72rem] font-bold ${pctSum === 100 ? "text-emerald-600" : "text-amber-700"}`}>
              {sumStatus}
            </span>
          </div>

          {!weight && (
            <div className="mt-3 flex max-w-[400px] items-start gap-2 rounded-[14px] border border-amber-200 bg-amber-50 px-3.5 py-2 text-amber-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="text-[0.66rem] font-semibold leading-4.5">
                No hay peso registrado para la fecha seleccionada. El campo g/kg está deshabilitado hasta que exista una medición válida.
              </span>
            </div>
          )}

          <button
            className="mt-3 w-full max-w-[400px] rounded-[14px] border border-slate-200 bg-slate-100 px-5 py-2.5 text-[0.9rem] font-black text-slate-800 shadow-[0_8px_16px_rgba(148,163,184,0.12)] transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={pctSum !== 100}
            onClick={handleConfirm}
          >
            Guardar macros y crear dieta
          </button>
        </div>
      </div>
    </div>
  );
}
