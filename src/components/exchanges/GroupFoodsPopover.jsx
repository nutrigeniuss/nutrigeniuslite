import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info, Search, X } from "lucide-react";
import { normalizeSearchValue } from "@/lib/exchangePlan";

// Popover de referencia: al abrirlo desde la cabecera de una columna de grupo,
// lista los NOMBRES de los alimentos que pertenecen a ese grupo de intercambio.
// Sirve para ubicarse mientras se arma la tabla, sin cambiar a la pestaña
// "Indicaciones de alimentos" (donde vive el detalle de porciones/medidas).
//
// Se renderiza en un portal a <body> con position:fixed para que el scroll
// horizontal de la tabla (overflow) no lo recorte.
const PANEL_W = 264;

export default function GroupFoodsPopover({ group, title, compact = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const foods = Array.isArray(group?.foods) ? group.foods : [];
  const label = title || group?.label || "Grupo";

  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const panelH = panelRef.current?.offsetHeight || 320;
    // Coloca debajo del botón; si no cabe, lo sube encima.
    const placeAbove = rect.bottom + panelH + 12 > window.innerHeight && rect.top - panelH - 12 > 0;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - PANEL_W / 2, 8), window.innerWidth - PANEL_W - 8);
    const top = placeAbove ? rect.top - panelH - 8 : rect.bottom + 8;
    setPos({ top, left });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (panelRef.current?.contains(event.target) || btnRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onKey = (event) => { if (event.key === "Escape") setOpen(false); };
    const reposition = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    // capture:true para reaccionar también al scroll del contenedor de la tabla.
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  const normalizedQuery = normalizeSearchValue(query);
  const visibleFoods = normalizedQuery
    ? foods.filter((food) => normalizeSearchValue(food.name || "").includes(normalizedQuery))
    : foods;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => { event.stopPropagation(); setOpen((value) => !value); }}
        title="Ver alimentos de este grupo"
        aria-label="Ver alimentos de este grupo"
        aria-expanded={open}
        className={`flex items-center justify-center rounded-full transition-colors ${open ? "bg-[#f1efff] text-brand-500" : "text-slate-300 hover:bg-[#f1efff] hover:text-brand-500"} ${compact ? "h-4 w-4" : "h-5 w-5"}`}
      >
        <Info className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: PANEL_W }}
              className="z-[70] overflow-hidden rounded-2xl border border-[#e9e5fb] bg-white shadow-[0_24px_60px_-18px_rgba(40, 67, 214,0.42)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-[linear-gradient(180deg,#faf9ff_0%,#ffffff_100%)] px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold leading-tight text-slate-800">{label}</p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8079c9]">{foods.length} alimentos</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Cerrar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {foods.length > 8 ? (
                <div className="border-b border-slate-100 px-2.5 py-2">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 transition focus-within:border-brand-500/40 focus-within:bg-white">
                    <Search className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar alimento..."
                      className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder-slate-400"
                    />
                  </div>
                </div>
              ) : null}

              <div className="max-h-[260px] overflow-y-auto px-1.5 py-1.5">
                {visibleFoods.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">Sin coincidencias</p>
                ) : (
                  <ul className="space-y-0.5">
                    {visibleFoods.map((food) => (
                      <li
                        key={food.id || food.name}
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug text-slate-700 transition hover:bg-[#f7f6ff]"
                      >
                        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#c9c4f5]" />
                        <span className="truncate">{food.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
