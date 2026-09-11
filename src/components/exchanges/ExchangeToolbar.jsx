import React from "react";
import { Printer, SlidersHorizontal } from "lucide-react";
import BackLink from "@/components/ui/back-link";

// Barra superior del editor por intercambios: volver, resumen, fecha,
// conmutador de pestañas (tabla / alimentos) y acciones (macros, imprimir).
// Extraído de ExchangeDietCreator.jsx.
//
// NO lleva botón ni indicador de guardado: el plan se autoguarda al salir de
// la pantalla, al ocultar la pestaña y cada cierto rato, así que no hay nada
// que el nutricionista tenga que pulsar ni vigilar. Por eso ya no recibe
// `onSave`, `saving`, `saved` ni `hasUnsavedChanges`.
export default function ExchangeToolbar({
  isMobile,
  patientId,
  patientRecord,
  date,
  setDate,
  tab,
  setTab,
  onBack,
  onShowMacroEditor,
  onPrint,
  onShowMobileSummary,
}) {
  return (
    <div className="z-30 border-b border-[#e8e5ff] bg-white/82 backdrop-blur-xl shadow-[0_12px_30px_-28px_rgba(59, 95, 235,0.16)]">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex flex-wrap items-center gap-2">
          <BackLink
            onClick={onBack}
            label="Volver a la ficha"
            className="flex-shrink-0"
            compact
          />

          {/* "Resumen" vive entre la flecha de volver y la fecha, igual que en
              el editor por alimentos: las dos pantallas se usan seguidas y no
              tiene sentido que el mismo botón esté en sitios distintos. */}
          {isMobile ? (
            <button
              type="button"
              onClick={onShowMobileSummary}
              className="flex h-[31px] items-center gap-1.5 rounded-full border border-[#e8e4fb] bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-200/20 transition-colors hover:bg-slate-50"
            >
              Resumen
            </button>
          ) : null}

          <div className="flex h-[31px] items-center gap-2 rounded-full border border-[#e5e3ff] bg-[#f7f6ff] px-3 shadow-sm shadow-slate-200/20">
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6860c7] sm:inline">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-full bg-transparent px-1 py-0 text-sm font-semibold text-slate-700 outline-none"
            />
          </div>
        </div>

        {/* `min-w-max` + `whitespace-nowrap` + `px-7` daban unos 544 px para las
            dos pestañas: en un celular de 375 px la segunda quedaba cortada y
            sin forma de alcanzarla. Ahora el grupo puede desplazarse de lado y
            el relleno se aprieta en pantalla chica. */}
        {/* En estrecho las pestañas bajan a una fila propia —la que liberó el
            icono de guardado— y así caben enteras en vez de salirse por el
            borde. Desde `sm` vuelven al centro de la barra, como siempre.
            El `order` las manda al final sin tocar el orden del HTML, que es
            el que sigue un lector de pantalla.

            Su tamaño no salta: alto, relleno y letra van con `clamp`, así que
            encogen de forma continua con el ancho de la ventana en vez de
            cambiar de golpe en un punto. En 393 px las dos pestañas caben
            enteras; antes "Indicaciones de alimentos" se salía. */}
        <div className="order-last flex w-full min-w-0 justify-center overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          <div className="inline-flex min-w-max items-center gap-1 rounded-full border border-[#e5e3ff] bg-[#f7f6ff] p-1 shadow-sm shadow-slate-200/20">
            {[{ key: "tabla", label: "Tabla de intercambios" }, { key: "alimentos", label: "Indicaciones de alimentos" }].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`h-[clamp(26px,6.5vw,32px)] whitespace-nowrap rounded-full px-[clamp(9px,3.2vw,28px)] text-[clamp(11.5px,3.1vw,14px)] font-semibold transition-all ${tab === t.key ? "bg-[linear-gradient(135deg,#5a56f3_0%,#7a84ff_100%)] text-white shadow-[0_12px_26px_-20px_rgba(59, 95, 235,0.8)]" : "text-slate-500 hover:text-slate-700"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Centrados siempre, no pegados a la derecha: en estrecho ocupan su
            propia fila completa y quedan al medio; en ancho, `mx-auto` los
            mantiene centrados dentro del hueco que les toca. Antes `ml-auto`
            los empujaba al borde derecho, que en un celular los dejaba lejos
            del pulgar y descolgados del resto de la barra. */}
        <div className="mx-auto flex w-full flex-wrap items-center justify-center gap-2 sm:w-auto">
          {patientId ? (
            <button
              type="button"
              onClick={onShowMacroEditor}
              disabled={!patientRecord}
              className="flex h-[29px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Macronutrientes
            </button>
          ) : null}

          <button
            onClick={onPrint}
            className="flex h-[29px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>

          {/* El indicador de guardado se quitó del todo. El plan se autoguarda
              al salir de la pantalla, al ocultar la pestaña y cada cierto rato,
              así que ni el botón ni su estado aportaban nada que el
              nutricionista tuviera que atender: solo ocupaban sitio. */}
        </div>
      </div>
    </div>
  );
}
