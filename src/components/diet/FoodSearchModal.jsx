import React, { useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";

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
      className="fixed inset-0 z-[55] flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="food-search-modal"
    >
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-[4px]"
        onClick={onClose}
        data-testid="food-search-overlay"
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.18)] outline-none sm:rounded-[1.75rem] sm:shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-100/90 bg-gradient-to-br from-white via-brand-50/30 to-coral-50/20 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-500">Agregar</p>
            <h2 className="ng-display truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ng-back !px-3 !py-2.5"
            aria-label="Cerrar buscador de alimentos"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f7f8fc]/70 px-4 py-3 sm:px-6">
          {children}
        </div>

        <div className="flex-shrink-0 border-t border-slate-100 bg-white px-5 py-3 sm:px-6">
          <p className="text-center text-[11px] font-medium text-slate-400">
            Puedes agregar varios sin cerrar ·{" "}
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              Esc
            </kbd>{" "}
            cierra
          </p>
        </div>
      </div>
    </div>
  );
}
