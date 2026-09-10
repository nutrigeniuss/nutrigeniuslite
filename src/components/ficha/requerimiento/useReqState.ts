// Estado local del requerimiento: hidrata desde la medición/paciente y se
// re-sincroniza SOLO cuando cambia la consulta/paciente de origen — no cada vez
// que el padre recrea los objetos `measurement`/`patient` en cada render (eso
// borraría las ediciones sin guardar; ver ConsultDetail, que pasa objetos
// nuevos en cada render). Extraído del componente para aislar la lógica.
import { useEffect, useRef, useState } from 'react';
import { buildMacroState } from './logic';
import type { MacroState, MeasurementRecord, PatientRequirementRecord } from './types';
import type { MetDay } from '../metCalculator/types';

const normalizeMetDays = (value: unknown): MetDay[] => (Array.isArray(value) ? (value as MetDay[]) : []);

// Identidad de la fuente de datos (consulta + paciente). Mientras no cambie, el
// formulario conserva su estado local aunque el padre re-renderice.
const sourceKey = (measurement: MeasurementRecord | null, patient: PatientRequirementRecord): string =>
  `${measurement?.date ?? ''}|${(patient as { id?: string | number } | null)?.id ?? ''}`;

export function useReqState(measurement: MeasurementRecord | null, patient: PatientRequirementRecord) {
  const req = measurement?.requirement || {};
  const globalReq = patient.requirement || {};

  const [actLevel, setActLevel] = useState(req.activity_level || globalReq.activity_level || 'Sedentario');
  const [customFactor, setCustomFactor] = useState<number | string | null>(req.activity_factor || globalReq.activity_factor || null);
  // Arrancaba SIEMPRE en false, asi que el factor aplicado (el NAF del panel
  // MET) se guardaba pero la pantalla volvia a "Sedentario x1.2" al reabrir.
  const [useCustomFactor, setUseCustomFactor] = useState(
    req.use_custom_factor ?? globalReq.use_custom_factor ?? false,
  );
  const [thermalEffect, setThermalEffect] = useState(req.thermal_effect ?? globalReq.thermal_effect ?? false);
  const [calAdj, setCalAdj] = useState<number | string>(req.calorie_adjustment ?? globalReq.calorie_adjustment ?? 0);
  const [selectedFormula, setSelectedFormula] = useState(req.selected_formula || globalReq.selected_formula || 'Mifflin-St Jeor');
  const [macros, setMacros] = useState<MacroState>(() => buildMacroState(measurement, patient));
  const [metDays, setMetDays] = useState<MetDay[]>(() => normalizeMetDays(req.met_data));

  // Sentinel: undefined en el primer render fuerza la hidratación inicial; luego
  // solo re-hidrata al cambiar de consulta/paciente (no por recreación de props).
  const syncedKeyRef = useRef<string | undefined>(undefined);
  const key = sourceKey(measurement, patient);

  useEffect(() => {
    if (syncedKeyRef.current === key) return;
    syncedKeyRef.current = key;
    const localReq = measurement?.requirement || {};
    const fallbackReq = patient.requirement || {};
    setActLevel(localReq.activity_level || fallbackReq.activity_level || 'Sedentario');
    setCustomFactor(localReq.activity_factor || fallbackReq.activity_factor || null);
    // Aquí también, no solo en el valor inicial. Este efecto rehidrata al
    // volver a la pantalla, y forzando `false` deshacía el factor aplicado:
    // se dejaba en 1.29 manual, se iba a la dieta, se volvía y aparecía
    // "Sedentario ×1.2" con un total distinto. Peor todavía, ese total
    // equivocado se guardaba y las dietas lo adoptaban.
    setUseCustomFactor(localReq.use_custom_factor ?? fallbackReq.use_custom_factor ?? false);
    setThermalEffect(localReq.thermal_effect ?? fallbackReq.thermal_effect ?? false);
    setCalAdj(localReq.calorie_adjustment ?? fallbackReq.calorie_adjustment ?? 0);
    setSelectedFormula(localReq.selected_formula || fallbackReq.selected_formula || 'Mifflin-St Jeor');
    setMacros(buildMacroState(measurement, patient));
    setMetDays(normalizeMetDays(localReq.met_data));
  }, [key, measurement, patient]);

  return { actLevel, setActLevel, customFactor, setCustomFactor, useCustomFactor, setUseCustomFactor, thermalEffect, setThermalEffect, calAdj, setCalAdj, selectedFormula, setSelectedFormula, macros, setMacros, metDays, setMetDays };
}
