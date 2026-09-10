import React, { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { MAX_SCENARIO_NAME, MAX_SCENARIOS, scenarioLabel } from "@/lib/exchangePlan";

// Barra de escenarios del editor por intercambios: seleccionar, RENOMBRAR,
// eliminar (salvo la primera) y replicar el escenario activo en una nueva tabla.
//
// El renombrado no es cosmético. Estas tablas se le van a enseñar al paciente, y
// "Tabla 1 / Tabla 2 / Tabla 3" no le dice cuál seguir hoy. Con un nombre
// ("Días de entrenamiento") la elección es obvia; sin él, seguirá la primera.
// Por eso el lápiz está a la vista en la pestaña activa en vez de escondido tras
// un doble clic que nadie descubre.
export default function ScenarioTabsBar({
  isCompactTable,
  scenarios,
  activeScenario,
  setActiveScenarioId,
  handleRemoveScenario,
  handleDuplicateScenario,
  handleRenameScenario,
}) {
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingKey && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingKey]);

  const startEditing = (scenario) => {
    setEditingKey(scenario.key);
    setDraft(scenario.name || "");
  };

  const commit = () => {
    if (!editingKey) return;
    handleRenameScenario?.(editingKey, draft);
    setEditingKey(null);
  };

  const cancel = () => setEditingKey(null);

  return (
    <div className={`flex flex-shrink-0 flex-wrap items-center justify-between border-b border-[#e8e5ff] bg-white/60 backdrop-blur ${isCompactTable ? "h-[42px] gap-2 px-4" : "h-[50px] gap-3 px-6"}`}>
      <div className={`flex h-full items-end flex-wrap ${isCompactTable ? "gap-3" : "gap-5"}`}>
        {scenarios.map((scenario, index) => {
          const isActive = scenario.key === activeScenario?.key;
          const label = scenarioLabel(scenario, index);
          const isEditing = editingKey === scenario.key;

          if (isEditing) {
            return (
              <div key={scenario.key} className="flex h-full items-center gap-1">
                <input
                  ref={inputRef}
                  value={draft}
                  maxLength={MAX_SCENARIO_NAME}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); commit(); }
                    if (event.key === "Escape") { event.preventDefault(); cancel(); }
                  }}
                  placeholder={`Tabla ${index + 1}`}
                  aria-label={`Nombre de la tabla ${index + 1}`}
                  className={`rounded-md border border-brand-500 bg-white font-semibold text-brand-500 outline-none ${isCompactTable ? "h-[24px] w-[130px] px-1.5 text-[12px]" : "h-[28px] w-[170px] px-2 text-[13px]"}`}
                />
                <button
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={commit}
                  aria-label="Guardar el nombre"
                  title="Guardar el nombre"
                  className={`flex items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-50 ${isCompactTable ? "h-5 w-5" : "h-6 w-6"}`}
                >
                  <Check className={isCompactTable ? "h-3 w-3" : "h-3.5 w-3.5"} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={scenario.key}
              className={`flex h-full items-center ${isCompactTable ? "gap-0.5" : "gap-1"}`}
            >
              <button
                onClick={() => setActiveScenarioId(scenario.key)}
                onDoubleClick={() => startEditing(scenario)}
                title={scenario.name ? label : `${label} — doble clic para ponerle nombre`}
                className={`h-full max-w-[170px] truncate border-b-2 font-semibold transition-colors ${isCompactTable ? "px-0.5 text-[12px]" : "px-1 text-[13px]"} ${isActive ? "border-brand-500 text-brand-500" : "border-transparent text-slate-400 hover:text-slate-700"}`}
              >
                {label}
              </button>

              {/* Solo en la pestaña activa: renombrar la que no estás mirando
                  obligaría a cambiar de tabla mentalmente y a equivocarse. */}
              {isActive ? (
                <button
                  onClick={() => startEditing(scenario)}
                  aria-label={`Poner nombre a ${label}`}
                  title="Ponle un nombre: es lo que verá el paciente"
                  className={`flex items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-brand-50 hover:text-brand-500 ${isCompactTable ? "mb-1 h-4 w-4" : "mb-2 h-5 w-5"}`}
                >
                  <Pencil className={isCompactTable ? "h-2.5 w-2.5" : "h-3 w-3"} />
                </button>
              ) : null}

              {index > 0 ? (
                <button
                  onClick={() => handleRemoveScenario(scenario.key)}
                  className={`flex items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 ${isCompactTable ? "mb-1 h-4 w-4" : "mb-2 h-5 w-5"}`}
                  aria-label={`Eliminar ${label}`}
                  title={`Eliminar ${label}`}
                >
                  <X className={`${isCompactTable ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleDuplicateScenario}
          disabled={!activeScenario || scenarios.length >= MAX_SCENARIOS}
          className={`flex items-center rounded-full border border-[#e1deff] bg-[#f6f5ff] font-semibold text-brand-500 shadow-sm shadow-slate-200/15 transition-colors hover:bg-[#efedff] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 ${isCompactTable ? "h-[26px] px-3 text-[12px]" : "h-[30px] px-4 text-[13px]"}`}
        >
          {scenarios.length < MAX_SCENARIOS ? `Replicar en Tabla ${scenarios.length + 1}` : "Límite alcanzado"}
        </button>
      </div>
    </div>
  );
}
