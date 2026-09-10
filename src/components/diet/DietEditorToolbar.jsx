import { useEffect, useRef, useState } from "react";
import { Printer, BookMarked, ShieldAlert, SlidersHorizontal, Bot, Pencil } from "lucide-react";
import BackLink from "@/components/ui/back-link";

// Pill + popover con las restricciones dietéticas derivadas del expediente
// (diagnósticos + intolerancias). Solo se muestra si hay alguna. Sirve de
// recordatorio pasivo mientras se arma el plan; el asistente IA ya las respeta.
function RestrictionsPill({ restrictions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!restrictions || restrictions.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Restricciones de la dieta"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#f0d9ad] bg-[#fff9ef] px-2.5 py-1.5 text-sm font-semibold text-[#b3670f] transition hover:bg-[#fdf3e0]"
      >
        <ShieldAlert className="h-4 w-4" />
        <span className="hidden lg:inline">Restricciones</span>
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f2c777] px-1 text-[11px] font-bold text-[#7a4a08] tabular-nums">{restrictions.length}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_12px_28px_-12px_rgba(15,23,42,0.28)]">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#b3670f]">
            <ShieldAlert className="h-3.5 w-3.5" /> Restricciones de la dieta
          </div>
          <div className="space-y-2">
            {restrictions.map((r) => {
              const dot = r.source === "alergia" ? "bg-[#c62b26]" : r.source === "intolerancia" ? "bg-[#cf7a1e]" : "bg-brand-500";
              return (
                <div key={r.label} className="flex items-start gap-2">
                  <span className={`mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold leading-snug text-slate-700">{r.label}</div>
                    <div className="text-[10px] font-medium leading-tight text-slate-400">{r.origin}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 border-t border-slate-100 pt-2 text-[10px] leading-snug text-slate-400">
            Derivadas del expediente. El asistente las respeta al sugerir alimentos.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Diet Editor Toolbar ──────────────────────────────────────────────────────
// Barra superior del editor de dietas: volver, botón "Resumen" (mobile),
// título editable y los botones de acción (editar macros, imprimir, guardar en
// catálogo, asistente IA).
//
// Extraído de DietCreator sin cambio de comportamiento. Es puramente
// presentacional: recibe el estado y los callbacks que necesita por props para
// que la página siga siendo la dueña del estado y la orquestación.
export default function DietEditorToolbar({
  isMobile,
  patientId,
  onBack,
  title,
  onTitleChange,
  date,
  onDateChange,
  onShowMobileSummary,
  onShowMacroEditor,
  macroEditorDisabled,
  restrictions = [],
  onPrint,
  onSaveToCatalog,
  onOpenAssistant,
  // En modo inspección (titular Pro+ viendo a un trabajador) el editor es de
  // solo lectura: se ocultan las acciones de edición y se dejan las de ver.
  readOnly = false,
}) {
  return (
    <header className="flex-shrink-0 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6 shadow-sm">
      {/* Volver a la ficha del paciente. En su día se quitó por redundante
          —"el sidebar ya permite regresar"—, pero el sidebar se puede plegar a
          iconos sin rótulo, y entonces esta pantalla se queda sin ninguna
          salida evidente hacia el paciente del que salió.
          Misma flecha redonda, mismo sitio y mismo comportamiento que en el
          editor por intercambios: sin texto (una flecha atrás se entiende
          sola) para no gastar ancho de la barra, pero con el rótulo vivo como
          tooltip y como nombre accesible. */}
      {patientId ? (
        <BackLink
          onClick={onBack}
          label="Volver a Dieta por alimentos"
          title="Volver a Dieta por alimentos"
          variant="icon"
          className="flex-shrink-0 p-1.5"
          iconOnly
        />
      ) : null}

      {/* Botón de resumen (solo mobile). */}
      {isMobile ? (
        <button
          type="button"
          onClick={onShowMobileSummary}
          className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          Resumen
        </button>
      ) : null}

      {/* Nombre del plan — editable. Se resalta como campo editable (lápiz +
          fondo al pasar el cursor + anillo al enfocar) para que quede claro que
          se puede escribir o cambiar el texto, no es un simple rótulo. */}
      <label
        title="Haz clic para escribir o editar el nombre del plan"
        className="group flex min-w-0 max-w-[60%] cursor-text items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 transition hover:border-slate-200 hover:bg-slate-50 focus-within:border-brand-500/40 focus-within:bg-white focus-within:ring-1 focus-within:ring-brand-500/20"
      >
        <input
          type="text"
          value={title}
          onChange={e => onTitleChange(e.target.value)}
          readOnly={readOnly}
          aria-label="Nombre del plan (editable)"
          size={Math.min(Math.max((title || "").length, 8), 26)}
          className="min-w-0 border-none bg-transparent text-base font-bold text-slate-800 outline-none placeholder-slate-300"
          placeholder="Nombre del plan..."
        />
        <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 opacity-70 transition group-hover:text-brand-500 group-hover:opacity-100 group-focus-within:text-brand-500" aria-hidden="true" />
      </label>

      {/* Espaciador: empuja fecha + acciones a la derecha ahora que el título
          se ajusta a su contenido en vez de ocupar todo el ancho (flex-1). */}
      <div className="min-w-[8px] flex-1" aria-hidden="true" />

      {/* Fecha del plan: mismo control que la dieta por intercambios. El input
          nativo `type="date"` muestra la fecha seleccionada y su icono de
          calendario abre el selector moderno del navegador para editarla. */}
      {onDateChange ? (
        <label className="flex h-[31px] flex-shrink-0 items-center gap-2 rounded-full border border-[#e5e3ff] bg-[#f7f6ff] px-3 shadow-sm shadow-slate-200/20">
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6860c7] sm:inline">Fecha</span>
          <input
            type="date"
            value={date || ""}
            onChange={e => onDateChange(e.target.value)}
            aria-label="Fecha del plan"
            className="cursor-pointer rounded-full bg-transparent px-1 py-0 text-sm font-semibold text-slate-700 outline-none"
          />
        </label>
      ) : null}

      {/* Botones de acción (visibles en sm+) con jerarquía visual:
          - Editar macros / Imprimir: "ghost" (solo icono + tooltip en sm, con texto en md+)
          - Guardar dieta: secundario outline
          - Sugerir con IA: primario destacado con gradiente */}
      <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
        <RestrictionsPill restrictions={restrictions} />
        {patientId && !readOnly ? (
          <button
            type="button"
            onClick={onShowMacroEditor}
            disabled={macroEditorDisabled}
            title="Editar macros"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden lg:inline">Editar macros</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrint}
          title="Imprimir"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden lg:inline">Imprimir</span>
        </button>
        {/* Acciones de edición: ocultas en modo solo lectura (inspección). */}
        {!readOnly ? (
          <>
            <div className="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
            <button
              type="button"
              onClick={onSaveToCatalog}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
            >
              <BookMarked className="w-4 h-4" />
              Guardar dieta
            </button>
            {/* Lite excludes clinical AI assistant — Asistente button omitted. */}
            {onOpenAssistant ? (
              <button
                type="button"
                onClick={onOpenAssistant}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(135deg,#3b5feb_0%,#6d81f2_100%)] px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:opacity-95"
              >
                <Bot className="w-4 h-4" />
                Asistente
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </header>
  );
}
