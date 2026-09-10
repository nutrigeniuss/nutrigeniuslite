import { BookMarked } from "lucide-react";

// ── Save To Catalog Modal ────────────────────────────────────────────────────
// Diálogo para guardar el plan actual como plantilla reutilizable en "Mis
// Dietas" (is_catalog). Presentacional: el padre conserva el estado del nombre
// y la lógica de persistencia (onSave). Extraído de DietCreator sin cambio de
// comportamiento.
export default function SaveToCatalogModal({
  open,
  value,
  onChange,
  onSave,
  onClose,
  saving,
  saved,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <BookMarked className="h-5 w-5 text-brand-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-base">Guardar en Mis Dietas</h3>
            <p className="text-xs text-slate-400">Se guardará como plantilla en tu catálogo</p>
          </div>
        </div>

        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nombre de la dieta</label>
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSave()}
          placeholder="Ej: Dieta hipocalórica 1500 kcal"
          className="mb-4 w-full rounded-xl border border-[#dde3f0]/80 px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100 transition">
            Cancelar
          </button>
          <button onClick={onSave} disabled={saving || !value.trim()}
            className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
            {saved ? "¡Guardado!" : saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
