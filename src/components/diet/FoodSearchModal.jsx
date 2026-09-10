import React, { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

// Centered modal (NutriMind-style) that hosts the food/recipe/USDA search
// UI. Wider than the previous right-side drawer (max-w-5xl ≈ 1024px) so
// the full table with macros + add button fits comfortably without the
// columns being pushed off-screen.
//
// Stays open after each add — adding 5 foods is 5 clicks, not 5 open/close
// cycles. Mirrors the a11y patterns used elsewhere in the app (focus
// trap, focus restoration, Esc + overlay close).

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function FoodSearchModal({ open, onClose, title = "Agregar alimento", children }) {
  const panelRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

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

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current = document.activeElement;
    const timer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector('[data-autofocus]')
        || panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      (target || panelRef.current)?.focus();
    }, 0);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      const opener = previouslyFocusedRef.current;
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="food-search-modal"
    >
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[3px] transition-opacity"
        onClick={onClose}
        data-testid="food-search-overlay"
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50 flex-shrink-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Catálogo</p>
            <h2 className="text-base font-bold text-slate-800 leading-snug">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition flex-shrink-0"
            aria-label="Cerrar buscador de alimentos"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — child fills the available space and handles its own scrolling */}
        <div className="flex-1 min-h-0 flex flex-col">
          {children}
        </div>

        {/* Footer hint */}
        <div className="border-t border-slate-100 px-6 py-2.5 bg-slate-50/50 flex-shrink-0">
          <p className="text-[11px] text-slate-400 text-center">
            Agrega varios alimentos sin cerrar · <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-mono">Esc</kbd> para cerrar
          </p>
        </div>
      </div>
    </div>
  );
}
