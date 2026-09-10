import Requerimiento from "@/components/patient/Requerimiento.tsx";

// ── Macro Editor Modal ───────────────────────────────────────────────────────
// Overlay para editar la distribución de macronutrientes del paciente para la
// fecha del plan. Envuelve <Requerimiento> en modo "macronutrientes" con
// autoguardado: el padre registra el handler de autosave (registerAutosave) y
// lo dispara al cerrar (onClose). Extraído de DietCreator sin cambio de
// comportamiento; solo se monta cuando hay paciente y el modal está abierto.
export default function MacroEditorModal({
  open,
  patient,
  date,
  activeMeasurement,
  onClose,
  onUpdate,
  registerAutosave,
}) {
  if (!open || !patient) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/35 p-3 pt-16 sm:p-4 sm:pt-20">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 sm:max-h-[calc(100vh-6rem)]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Editar distribución de macronutrientes</h3>
            <p className="mt-1 text-sm text-slate-500">Estás ajustando los macronutrientes para la fecha {date}. Los cambios se guardan automáticamente y luego vuelves al plan.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            Volver al plan
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <Requerimiento
            patient={patient}
            onUpdate={onUpdate}
            tab="macronutrientes"
            fixedMeasurement={activeMeasurement}
            registerAutosave={registerAutosave}
            hideMeasurementSelector
            autoSaveOnChange
            macroPresentation="exchange-clinical"
          />
        </div>
      </div>
    </div>
  );
}
