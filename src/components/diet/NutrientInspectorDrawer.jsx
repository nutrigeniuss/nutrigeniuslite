import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, ChefHat, Flame, Beef, Wheat, Droplets } from "lucide-react";
import { formatNutrientValue, getNutrientCategory } from "@/lib/inspectorPayload";

// Tailwind class map per nutrient category. Keeps chips visually scannable:
// minerals = green, vitamins = orange, lipids = rose, etc.
const CATEGORY_STYLES = {
  mineral:      { chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  vitamin:      { chip: "bg-amber-50 text-amber-700 border-amber-200" },
  lipid:        { chip: "bg-rose-50 text-rose-700 border-rose-200" },
  sugar:        { chip: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  amino:        { chip: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  carotenoid:   { chip: "bg-orange-50 text-orange-700 border-orange-200" },
  bioactive:    { chip: "bg-purple-50 text-purple-700 border-purple-200" },
  index:        { chip: "bg-slate-100 text-slate-700 border-slate-300" },
  "fiber-water": { chip: "bg-teal-50 text-teal-700 border-teal-200" },
  other:        { chip: "bg-slate-50 text-slate-600 border-slate-200" },
};

const CATEGORY_LABELS = {
  mineral: "Minerales",
  vitamin: "Vitaminas",
  lipid: "Lípidos detallados",
  sugar: "Azúcares y almidón",
  amino: "Aminoácidos",
  carotenoid: "Carotenoides",
  bioactive: "Bioactivos",
  index: "Índices",
  "fiber-water": "Fibra y componentes",
  other: "Otros",
};

const CATEGORY_ORDER = [
  "fiber-water",
  "mineral",
  "vitamin",
  "lipid",
  "sugar",
  "amino",
  "carotenoid",
  "bioactive",
  "index",
  "other",
];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function MacroCard({ icon: Icon, label, value, unit, accent }) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border ${accent.border} ${accent.bg} px-3 py-3`}>
      <Icon className={`w-4 h-4 ${accent.text} mb-1.5`} aria-hidden="true" />
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${accent.text} mb-0.5`}>{label}</p>
      <p className="text-lg font-bold text-slate-800 tabular-nums leading-none">
        {Math.round(value * 10) / 10}
        <span className="text-[10px] text-slate-400 ml-0.5 font-medium">{unit}</span>
      </p>
    </div>
  );
}

// Hero thumbnail with graceful fallback when image_url is missing OR fails
// to load (404, broken link). Falls back to the recipe icon for recipes,
// returns null for plain ingredients (no slot rendered).
function HeaderThumbnail({ imageUrl, alt, kind }) {
  const [errored, setErrored] = useState(false);
  // Reset error state when the imageUrl prop changes (panel swaps between items)
  useEffect(() => { setErrored(false); }, [imageUrl]);

  if (imageUrl && !errored) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        onError={() => setErrored(true)}
        className="w-14 h-14 rounded-xl object-cover border border-slate-200 flex-shrink-0"
      />
    );
  }
  if (kind === "recipe") {
    return (
      <div
        className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center flex-shrink-0"
        aria-hidden="true"
      >
        <ChefHat className="w-6 h-6 text-teal-600" />
      </div>
    );
  }
  return null;
}

export default function NutrientInspectorDrawer({ payload, onClose }) {
  const isOpen = !!payload;
  const panelRef = useRef(null);
  // Element that had focus before the drawer opened, restored on close.
  const previouslyFocusedRef = useRef(null);

  // Stable onClose ref so the keydown listener doesn't re-attach on every
  // parent render. Saves listener churn and avoids stale-closure bugs.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Manual focus trap: when Tab/Shift+Tab would escape the panel, wrap to
  // the other end. Esc closes. Both behaviors are SaaS-standard for modals.
  const handleKeyDown = useCallback((event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  // Open: capture currently-focused element, mount listener, move focus
  // into the panel. Close: restore focus to opener.
  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocusedRef.current = document.activeElement;
    // Defer focus move so the panel is mounted in the DOM
    const timer = window.setTimeout(() => {
      const firstFocusable = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      (firstFocusable || panelRef.current)?.focus();
    }, 0);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the element that opened the drawer, if still
      // present in the DOM (a re-render might have unmounted it).
      const opener = previouslyFocusedRef.current;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  // Memoize categorization so reorders/re-renders don't redo the work.
  const microsByCategory = useMemo(() => {
    if (!payload) return {};
    return payload.micros.reduce((acc, micro) => {
      const cat = getNutrientCategory(micro.key);
      (acc[cat] ||= []).push(micro);
      return acc;
    }, {});
  }, [payload]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-label="Detalle nutricional"
      data-testid="nutrient-inspector-drawer"
    >
      <div
        className="absolute inset-0 bg-slate-900/15 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        data-testid="nutrient-inspector-overlay"
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        tabIndex={-1}
        className="absolute right-0 top-0 h-full w-full max-w-[460px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 outline-none"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4 bg-gradient-to-br from-white to-slate-50">
          <HeaderThumbnail imageUrl={payload.imageUrl} alt={payload.title} kind={payload.kind} />

          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              {payload.kind === "recipe" ? "Receta · Detalle" : "Alimento · Detalle"}
            </p>
            <h2 className="text-base font-bold text-slate-800 leading-snug mt-0.5 break-words">
              {payload.title}
            </h2>
            {payload.subtitle ? (
              <p className="text-xs text-slate-500 mt-0.5">{payload.subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition flex-shrink-0"
            aria-label="Cerrar detalle nutricional"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Macros */}
          <section aria-labelledby="inspector-macros-heading">
            <div className="flex items-center justify-between mb-2">
              <h3 id="inspector-macros-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">Macronutrientes</h3>
              <span className="text-[11px] text-slate-400">aporte total</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MacroCard
                icon={Flame}
                label="Kcal"
                value={payload.totals.calories}
                unit=""
                accent={{ bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600" }}
              />
              <MacroCard
                icon={Wheat}
                label="Carbs"
                value={payload.totals.carbs}
                unit="g"
                accent={{ bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600" }}
              />
              <MacroCard
                icon={Beef}
                label="Prot."
                value={payload.totals.protein}
                unit="g"
                accent={{ bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-600" }}
              />
              <MacroCard
                icon={Droplets}
                label="Gras."
                value={payload.totals.fat}
                unit="g"
                accent={{ bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600" }}
              />
            </div>
          </section>

          {/* Micros */}
          <section aria-labelledby="inspector-micros-heading">
            <div className="flex items-center justify-between mb-2">
              <h3 id="inspector-micros-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Micronutrientes y componentes
              </h3>
              <span className="text-[11px] text-slate-400">{payload.micros.length} presentes</span>
            </div>

            {payload.micros.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                Este alimento no tiene micronutrientes registrados en el catálogo.
              </p>
            ) : (
              <div className="space-y-3">
                {CATEGORY_ORDER.filter((cat) => microsByCategory[cat]?.length).map((cat) => {
                  const items = microsByCategory[cat];
                  const styles = CATEGORY_STYLES[cat] || CATEGORY_STYLES.other;
                  return (
                    <div key={cat} data-testid={`micro-category-${cat}`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                        {CATEGORY_LABELS[cat]} · {items.length}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((m) => (
                          <span
                            key={m.key}
                            className={`inline-flex items-baseline gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${styles.chip}`}
                            title={`${m.label}: ${formatNutrientValue(m.value, m.unit)} ${m.unit}`}
                            data-testid={`micro-chip-${m.key}`}
                          >
                            <span className="opacity-80">{m.label}</span>
                            <span className="font-bold tabular-nums">
                              {formatNutrientValue(m.value, m.unit)}
                              <span className="opacity-60 ml-0.5">{m.unit}</span>
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Per-ingredient breakdown (recipe only) */}
          {payload.kind === "recipe" && payload.ingredients?.length ? (
            <section aria-labelledby="inspector-ingredients-heading">
              <h3 id="inspector-ingredients-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Ingredientes
              </h3>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {payload.ingredients.map((ing) => (
                  <div key={ing.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{ing.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {ing.quantity}{ing.unit ? ` · ${ing.unit}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-700 tabular-nums ml-3">
                      {Math.round(ing.calories)}
                      <span className="text-[10px] text-slate-400 ml-0.5 font-medium">kcal</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Footer hint */}
        <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/50">
          <p className="text-[11px] text-slate-400 text-center">
            Click en otro alimento para inspeccionarlo · <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">Esc</kbd> para cerrar
          </p>
        </div>
      </aside>
    </div>
  );
}
