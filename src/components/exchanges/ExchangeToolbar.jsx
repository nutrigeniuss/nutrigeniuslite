import { useEffect, useRef, useState } from "react";
import { Printer, SlidersHorizontal, MoreHorizontal, ChevronDown, MessageCircle } from "lucide-react";
import BackLink from "@/components/ui/back-link";

function MobileActionsMenu({
  patientId,
  patientRecord,
  onShowMacroEditor,
  onPrint,
  onWhatsApp,
  whatsAppBusy,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = (action) => {
    setOpen(false);
    action?.();
  };

  return (
    <div className="relative z-30 sm:hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        <MoreHorizontal className="h-4 w-4" />
        Opciones
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => run(onPrint)}
            className="flex min-h-11 w-full touch-manipulation items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            PDF / Imprimir
          </button>
          {onWhatsApp ? (
            <button
              type="button"
              role="menuitem"
              disabled={whatsAppBusy}
              onClick={() => run(onWhatsApp)}
              className="flex min-h-11 w-full touch-manipulation items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              {whatsAppBusy ? "Generando…" : "WhatsApp"}
            </button>
          ) : null}
          {patientId ? (
            <button
              type="button"
              role="menuitem"
              disabled={!patientRecord}
              onClick={() => run(onShowMacroEditor)}
              className="flex min-h-11 w-full touch-manipulation items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              Macronutrientes
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
  onWhatsApp,
  whatsAppBusy = false,
  onShowMobileSummary,
}) {
  return (
    <div className="z-30 border-b border-[#e8e5ff]/90 bg-white/90 shadow-[0_12px_30px_-28px_rgba(59,95,235,0.18)] backdrop-blur-xl">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex flex-wrap items-center gap-2">
          <BackLink
            onClick={onBack}
            label={isMobile ? "Volver" : "Volver a la ficha"}
            className="relative z-30 min-h-11 flex-shrink-0 touch-manipulation"
            compact
          />

          {isMobile ? (
            <button
              type="button"
              onClick={onShowMobileSummary}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-[#e8e4fb] bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-200/20 transition-colors hover:bg-slate-50"
            >
              Resumen
            </button>
          ) : null}

          <div className="flex min-h-11 items-center gap-2 rounded-full border border-[#e5e3ff] bg-[#f7f6ff] px-3 shadow-sm shadow-slate-200/20 sm:h-[31px] sm:min-h-0">
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6860c7] sm:inline">Fecha</span>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-full bg-transparent px-1 py-0 text-sm font-semibold text-slate-700 outline-none"
            />
          </div>

          <MobileActionsMenu
            patientId={patientId}
            patientRecord={patientRecord}
            onShowMacroEditor={onShowMacroEditor}
            onPrint={onPrint}
            onWhatsApp={onWhatsApp}
            whatsAppBusy={whatsAppBusy}
          />
        </div>

        <div className="order-last flex w-full min-w-0 justify-center overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          <div className="inline-flex min-w-max items-center gap-1 rounded-full border border-[#e5e3ff] bg-[#f7f6ff] p-1 shadow-sm shadow-slate-200/20">
            {[
              { key: "tabla", label: "Tabla", labelFull: "Tabla de intercambios" },
              { key: "alimentos", label: "Alimentos", labelFull: "Indicaciones de alimentos" },
            ].map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`min-h-11 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-all sm:h-[clamp(26px,6.5vw,32px)] sm:min-h-0 sm:px-[clamp(9px,3.2vw,28px)] sm:text-[clamp(11.5px,3.1vw,14px)] ${tab === t.key ? "bg-[linear-gradient(135deg,#5a56f3_0%,#7a84ff_100%)] text-white shadow-[0_12px_26px_-20px_rgba(59, 95, 235,0.8)]" : "text-slate-500 hover:text-slate-700"}`}
              >
                <span className="sm:hidden">{t.label}</span>
                <span className="hidden sm:inline">{t.labelFull}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mx-auto hidden w-full flex-wrap items-center justify-center gap-2 sm:mx-0 sm:flex sm:w-auto">
          {patientId ? (
            <button
              type="button"
              onClick={onShowMacroEditor}
              disabled={!patientRecord}
              className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 sm:h-[29px] sm:min-h-0"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Macronutrientes
            </button>
          ) : null}

          <button
            type="button"
            onClick={onPrint}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 sm:h-[29px] sm:min-h-0"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>

          {onWhatsApp ? (
            <button
              type="button"
              onClick={onWhatsApp}
              disabled={whatsAppBusy}
              className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 sm:h-[29px] sm:min-h-0"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {whatsAppBusy ? "…" : "WhatsApp"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
