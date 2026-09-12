import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, Repeat2, X } from "lucide-react";
import { FIELD_META, parseNum2, computeTEM, computeFinalISAK } from "./consultConfig";

function ISAKEditor({ label, unit, values, temThreshold, onChange }) {
  const arr = [values?.[0] ?? null, values?.[1] ?? null, values?.[2] ?? null];
  const tem = computeTEM(arr);
  const final = computeFinalISAK(arr);
  const filled = arr.filter((v) => v !== null && v !== undefined && v !== "").length;
  const temOk = tem !== null && tem <= temThreshold;

  const setAt = (i, raw) => {
    const next = [...arr];
    next[i] = parseNum2(raw);
    onChange(next, computeFinalISAK(next));
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-500">ISAK</p>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">M1 y M2 obligatorias · M3 si difieren</p>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <label className="w-10 text-[11px] font-semibold text-slate-500">M{i + 1}</label>
          <div className="flex flex-1 items-center overflow-hidden rounded-full border border-slate-200 bg-[#f7f8fc]">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={arr[i] ?? ""}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder={i === 2 ? "opcional" : "–"}
              className="medida-input flex-1 bg-transparent px-2.5 py-2 text-right text-sm font-bold tabular-nums text-brand-600 outline-none placeholder:text-[10px] placeholder:font-normal placeholder:text-slate-300"
            />
            <span className="pr-2.5 text-[10px] font-semibold text-slate-400">{unit}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="text-[11px] font-semibold text-slate-400">
          {filled === 3 ? "Mediana" : filled === 2 ? "Media" : "Final"}
        </span>
        <span className="text-sm font-bold tabular-nums text-slate-800">
          {final !== null ? `${final} ${unit}` : "—"}
        </span>
      </div>
      {tem !== null ? (
        <div
          className={`flex items-center justify-between rounded-full px-2.5 py-1.5 text-[10px] font-semibold ${
            temOk ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          <span>TEM {tem}%</span>
          <span>{temOk ? `≤ ${temThreshold}%` : `> ${temThreshold}% · toma M3`}</span>
        </div>
      ) : (
        <p className="text-center text-[10px] text-slate-400">Ingresa M1 y M2 para TEM</p>
      )}
    </div>
  );
}

/**
 * Fila de medida + acceso claro a repeticiones ISAK (sheet en móvil/desktop).
 */
export default function MeasureInput({
  fieldKey,
  label,
  value,
  onChange,
  onManualChange,
  unit,
  inputRef,
  onEnter,
  isakValues,
  onIsakChange,
  pedRange,
  resaltado,
}) {
  const [isakOpen, setIsakOpen] = useState(false);
  const hasValue = value !== null && value !== undefined && value !== "";
  const baseMeta = FIELD_META[fieldKey] || {};
  const meta = pedRange ? { ...baseMeta, ...pedRange } : baseMeta;
  const numVal = hasValue ? Number(value) : null;
  const outAbs =
    numVal !== null && (numVal < (meta.min ?? -Infinity) || numVal > (meta.max ?? Infinity));
  const outPlausible =
    !outAbs &&
    numVal !== null &&
    meta.plausibleMin !== undefined &&
    (numVal < meta.plausibleMin || numVal > meta.plausibleMax);

  const placeholder =
    meta.plausibleMin !== undefined ? `${meta.plausibleMin}–${meta.plausibleMax}` : "–";

  const boxClass = resaltado
    ? "border-amber-400 bg-amber-50 shadow-[0_0_0_4px_rgba(251,191,36,0.22)]"
    : outAbs
      ? "border-red-300 bg-red-50/60"
      : outPlausible
        ? "border-amber-300 bg-amber-50/60"
        : hasValue
          ? "border-brand-500/40 bg-brand-50/40"
          : "border-slate-200/90 bg-[#f7f8fc]";

  const cajaRef = useRef(null);

  useEffect(() => {
    if (!resaltado) return;
    cajaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => cajaRef.current?.querySelector("input")?.focus(), 400);
    return () => clearTimeout(t);
  }, [resaltado]);

  useEffect(() => {
    if (!isakOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setIsakOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isakOpen]);

  const isakEnabled = !!meta.isak;
  const isakArr = isakEnabled ? (Array.isArray(isakValues) ? isakValues : []) : [];
  const isakFilledCount = isakArr.filter(
    (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)),
  ).length;
  const tem = isakEnabled ? computeTEM(isakArr) : null;
  const temThreshold = meta.temPct ?? 5;
  const temOk = tem !== null && tem <= temThreshold;
  const temBad = tem !== null && tem > temThreshold;

  return (
    <div
      ref={cajaRef}
      className={`flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 transition-colors duration-500 sm:gap-3 sm:px-4 ${
        resaltado ? "bg-amber-50/80" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={`truncate text-sm ${
            resaltado
              ? "font-bold text-amber-700"
              : hasValue
                ? "font-semibold text-slate-800"
                : "font-medium text-slate-500"
          }`}
        >
          {label}
        </span>
        {meta.req4 ? (
          <span
            title="Requerido para el modelo de 4 componentes (clásico)"
            className="rounded-md bg-coral-500/10 px-1 py-[1px] text-[9px] font-bold tracking-wider text-coral-700"
          >
            4C
          </span>
        ) : null}
        {meta.req5 ? (
          <span
            title="Requerido para el modelo de 5 componentes (Kerr 1988 · Phantom)"
            className="rounded-md bg-brand-500/10 px-1 py-[1px] text-[9px] font-bold tracking-wider text-brand-500"
          >
            5C
          </span>
        ) : null}
        {meta.hint ? (
          <span title={meta.hint} className="cursor-help text-slate-300 hover:text-slate-500">
            <HelpCircle className="h-3 w-3" />
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className={`flex items-center overflow-hidden rounded-full border transition-all ${boxClass}`}>
          {outAbs || outPlausible ? (
            <span
              className={`pl-2.5 ${outAbs ? "text-red-500" : "text-amber-500"}`}
              title={
                outAbs
                  ? `Fuera de rango (${meta.min}–${meta.max} ${unit})`
                  : `Fuera del rango plausible (${meta.plausibleMin}–${meta.plausibleMax} ${unit}). Verifica medición.`
              }
            >
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder={placeholder}
            value={value ?? ""}
            onChange={(e) => (onManualChange || onChange)(parseNum2(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onEnter?.();
              }
            }}
            className={`medida-input w-[4.75rem] bg-transparent px-2.5 py-2 text-right text-sm font-bold tabular-nums outline-none placeholder:text-[11px] placeholder:font-normal placeholder:text-slate-300 sm:w-[5.5rem] sm:px-3 ${
              outAbs
                ? "text-red-600"
                : outPlausible
                  ? "text-amber-700"
                  : hasValue
                    ? "text-brand-600"
                    : "text-slate-400"
            }`}
          />
          <span
            className={`pr-2.5 text-xs font-semibold sm:pr-3 ${
              outAbs
                ? "text-red-400"
                : outPlausible
                  ? "text-amber-500"
                  : hasValue
                    ? "text-slate-500"
                    : "text-slate-300"
            }`}
          >
            {unit}
          </span>
        </div>

        {isakEnabled ? (
          <button
            type="button"
            onClick={() => setIsakOpen(true)}
            title={`ISAK · TEM ≤ ${temThreshold}%`}
            className={`inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition active:scale-95 ${
              temBad
                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                : temOk
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-brand-50 text-brand-600 ring-1 ring-brand-200"
            }`}
          >
            <Repeat2 className="h-3.5 w-3.5" />
            <span>ISAK</span>
            {isakFilledCount > 0 ? (
              <span
                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${
                  temBad ? "bg-amber-500" : temOk ? "bg-emerald-500" : "bg-brand-500"
                }`}
              >
                {isakFilledCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {isakOpen && isakEnabled ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Cerrar"
            onClick={() => setIsakOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`ISAK ${label}`}
            className="relative z-10 w-full max-w-sm rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Repeticiones ISAK</p>
              <button
                type="button"
                onClick={() => setIsakOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ISAKEditor
              label={label}
              unit={unit}
              values={isakArr}
              temThreshold={temThreshold}
              onChange={(arr, finalVal) => {
                onIsakChange?.(arr);
                onChange(finalVal);
              }}
            />
            <button
              type="button"
              onClick={() => setIsakOpen(false)}
              className="ng-btn-primary mt-4 w-full"
            >
              Listo
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
