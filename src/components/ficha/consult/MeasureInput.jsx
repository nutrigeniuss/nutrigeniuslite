import React, { useEffect, useRef } from "react";
import { AlertTriangle, HelpCircle, Repeat2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { FIELD_META, parseNum2, computeTEM, computeFinalISAK } from "./consultConfig";

// Editor inline para el popover ISAK: tres inputs numéricos + resumen final
// y badge de TEM. Llama onChange(arr, final) en cada cambio para que el caller
// persista tanto el array como el escalar final. Extraído de ConsultDetail.jsx.
function ISAKEditor({ label, unit, values, temThreshold, onChange }) {
  // Trabajamos con copia local para edición libre del usuario.
  const arr = [values?.[0] ?? null, values?.[1] ?? null, values?.[2] ?? null];
  const tem = computeTEM(arr);
  const final = computeFinalISAK(arr);
  const filled = arr.filter(v => v !== null && v !== undefined && v !== "").length;
  const temOk = tem !== null && tem <= temThreshold;

  const setAt = (i, raw) => {
    const next = [...arr];
    next[i] = parseNum2(raw);
    onChange(next, computeFinalISAK(next));
  };

  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-[11px] font-semibold text-slate-400">ISAK</p>
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="flex items-center justify-between gap-2">
          <label className="w-10 text-[11px] font-semibold text-slate-500">M{i + 1}</label>
          <div className="flex flex-1 items-center overflow-hidden rounded-full border border-slate-200 bg-[#f7f8fc]">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={arr[i] ?? ""}
              onChange={e => setAt(i, e.target.value)}
              placeholder={i === 2 ? "opcional" : "–"}
              className="medida-input flex-1 bg-transparent px-2.5 py-1.5 text-right text-sm font-bold tabular-nums text-brand-600 outline-none placeholder:text-[10px] placeholder:font-normal placeholder:text-slate-300"
            />
            <span className="pr-2.5 text-[10px] font-semibold text-slate-400">{unit}</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="text-[11px] font-semibold text-slate-400">
          {filled === 3 ? "Mediana" : filled === 2 ? "Media" : "Final"}
        </span>
        <span className="text-sm font-bold tabular-nums text-slate-800">
          {final !== null ? `${final} ${unit}` : "—"}
        </span>
      </div>
      {tem !== null ? (
        <div className={`flex items-center justify-between rounded-full px-2.5 py-1 text-[10px] font-semibold ${
          temOk ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}>
          <span>TEM {tem}%</span>
          <span>
            {temOk ? `≤ ${temThreshold}%` : `> ${temThreshold}% · M3`}
          </span>
        </div>
      ) : (
        <p className="text-center text-[10px] text-slate-400">
          M1 y M2 para TEM
        </p>
      )}
    </div>
  );
}

// Fila de captura de una medida: input numérico con validación de rango
// (rojo fuera de min/max, ámbar fuera del rango plausible), badges 4C/5C, hint
// y disparador del popover ISAK (M1/M2/M3 + TEM). Extraído de ConsultDetail.jsx.
export default function MeasureInput({ fieldKey, label, value, onChange, onManualChange, unit, inputRef, onEnter, isakValues, onIsakChange, pedRange, resaltado }) {
  const hasValue = value !== null && value !== undefined && value !== "";
  const baseMeta = FIELD_META[fieldKey] || {};
  // Para niños, si hay rango OMS por edad/sexo, sustituye min/max y rango plausible
  // del adulto (conserva el resto de metadatos: badges 4C/5C, ISAK, hint).
  const meta = pedRange ? { ...baseMeta, ...pedRange } : baseMeta;
  // Out-of-range: rojo si fuera de mínimo/máximo absoluto, ámbar si fuera del
  // rango plausible. Solo se evalúa cuando hay valor cargado.
  const numVal = hasValue ? Number(value) : null;
  const outAbs = numVal !== null && (numVal < (meta.min ?? -Infinity) || numVal > (meta.max ?? Infinity));
  const outPlausible = !outAbs && numVal !== null && meta.plausibleMin !== undefined &&
    (numVal < meta.plausibleMin || numVal > meta.plausibleMax);

  // Placeholder dinámico con rango fisiológico esperado (ej. "22–42").
  const placeholder = meta.plausibleMin !== undefined
    ? `${meta.plausibleMin}–${meta.plausibleMax}`
    : "–";

  // Estilos del recuadro según estado.
  //
  // El resaltado va PRIMERO: cuando se llega desde una píldora de "falta esta
  // medida", encontrar la casilla es lo único que importa en ese momento. Los
  // avisos de fuera de rango no aplican a un campo vacío, que es el caso que
  // trae aquí al nutricionista.
  const boxClass = resaltado
    ? "border-amber-400 bg-amber-50 shadow-[0_0_0_4px_rgba(251,191,36,0.22)]"
    : outAbs
      ? "border-red-300 bg-red-50/60"
      : outPlausible
        ? "border-amber-300 bg-amber-50/60"
        : hasValue
          ? "border-brand-500/40 bg-brand-50/40"
          : "border-slate-200/90 bg-[#f7f8fc]";

  // Al resaltarse, la casilla se trae a la vista y toma el foco: puede quedar
  // fuera de pantalla en las pestañas largas, y entonces el color no serviría
  // de nada. Con el foco puesto, ademas se puede teclear el valor de inmediato.
  const cajaRef = useRef(null);

  useEffect(() => {
    if (!resaltado) return;
    cajaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // El desplazamiento es suave; enfocar antes de que termine lo cancelaria.
    const t = setTimeout(() => cajaRef.current?.querySelector('input')?.focus(), 400);
    return () => clearTimeout(t);
  }, [resaltado]);

  // ISAK: contar mediciones provistas y calcular calidad (TEM relativo).
  // Solo se activa la UI ISAK si la metadata del campo lo declara (`isak:true`).
  const isakEnabled = !!meta.isak;
  const isakArr = isakEnabled ? (Array.isArray(isakValues) ? isakValues : []) : [];
  const isakFilledCount = isakArr.filter(v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))).length;
  const tem = isakEnabled ? computeTEM(isakArr) : null;
  const temThreshold = meta.temPct ?? 5;
  const temOk = tem !== null && tem <= temThreshold;
  const temBad = tem !== null && tem > temThreshold;

  return (
    <div
      ref={cajaRef}
      className={`flex items-center justify-between gap-3 px-3.5 py-3 transition-colors duration-500 sm:px-4 ${
        resaltado ? "bg-amber-50/80" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`truncate text-sm ${
          resaltado ? "font-bold text-amber-700" : hasValue ? "font-semibold text-slate-800" : "font-medium text-slate-500"
        }`}>{label}</span>
        {/* Badges de requisito por modelo. Permite al usuario priorizar capturas. */}
        {meta.req4 ? (
          <span title="Requerido para el modelo de 4 componentes (clásico)"
                className="rounded-md bg-coral-500/10 px-1 py-[1px] text-[9px] font-bold tracking-wider text-coral-700">4C</span>
        ) : null}
        {meta.req5 ? (
          <span title="Requerido para el modelo de 5 componentes (Kerr 1988 · Phantom)"
                className="rounded-md bg-brand-500/10 px-1 py-[1px] text-[9px] font-bold tracking-wider text-brand-500">5C</span>
        ) : null}
        {meta.hint ? (
          <span title={meta.hint} className="cursor-help text-slate-300 hover:text-slate-500">
            <HelpCircle className="h-3 w-3" />
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`flex items-center overflow-hidden rounded-full border transition-all ${boxClass}`}>
          {(outAbs || outPlausible) ? (
            <span className={`pl-2.5 ${outAbs ? "text-red-500" : "text-amber-500"}`}
                  title={outAbs
                    ? `Fuera de rango (${meta.min}–${meta.max} ${unit})`
                    : `Fuera del rango plausible (${meta.plausibleMin}–${meta.plausibleMax} ${unit}). Verifica medición.`}>
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
            onChange={e => (onManualChange || onChange)(parseNum2(e.target.value))}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onEnter?.(); } }}
            className={`medida-input w-[5.5rem] bg-transparent px-3 py-2 text-right text-sm font-bold tabular-nums outline-none placeholder:text-[11px] placeholder:font-normal placeholder:text-slate-300 ${
              outAbs ? "text-red-600" : outPlausible ? "text-amber-700" : hasValue ? "text-brand-600" : "text-slate-400"
            }`}
          />
          <span className={`pr-3 text-xs font-semibold ${
            outAbs ? "text-red-400" : outPlausible ? "text-amber-500" : hasValue ? "text-slate-500" : "text-slate-300"
          }`}>{unit}</span>
        </div>
        {/* Disparador ISAK — abre popover con M1/M2/M3 y cálculo de mediana/TEM.
            Botón discreto: solo se vuelve visible al hover o cuando hay datos.
              • reposo + sin datos: gris muy tenue (casi invisible)
              • con mediciones ✓ TEM ok:    verde
              • con mediciones TEM excedido: ámbar */}
        {isakEnabled ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={`ISAK · TEM ≤ ${temThreshold}%`}
                className={`relative flex h-9 w-7 items-center justify-center rounded-full transition opacity-60 hover:opacity-100 ${
                  temBad
                    ? "text-amber-500 opacity-100"
                    : temOk
                      ? "text-emerald-500 opacity-100"
                      : "text-slate-300 hover:text-slate-500"
                }`}
              >
                <Repeat2 className="h-3.5 w-3.5" />
                {/* Contador (1–3) solo si hay mediciones cargadas. */}
                {isakFilledCount > 0 ? (
                  <span className={`absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold tabular-nums text-white ${
                    temBad ? "bg-amber-500" : temOk ? "bg-emerald-500" : "bg-slate-400"
                  }`}>{isakFilledCount}</span>
                ) : null}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 rounded-2xl p-3">
              <ISAKEditor
                label={label}
                unit={unit}
                values={isakArr}
                temThreshold={temThreshold}
                onChange={(arr, finalVal) => {
                  // Persistimos array completo en data.isak[key] y reflejamos
                  // el valor "final" en el campo principal para que los
                  // cálculos posteriores (Kerr/DW) funcionen sin migración.
                  onIsakChange?.(arr);
                  onChange(finalVal);
                }}
              />
            </PopoverContent>
          </Popover>
        ) : null}
      </div>
    </div>
  );
}
