import React from "react";
import Requerimiento from "@/components/patient/Requerimiento.tsx";

// Modal para editar la distribución de macronutrientes desde el editor por
// intercambios (autoguardado). Extraído de ExchangeDietCreator.jsx.
export default function ExchangeMacroEditorModal({
  date,
  patient,
  activeMeasurement,
  onClose,
  onUpdate,
  registerAutosave,
}) {
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
