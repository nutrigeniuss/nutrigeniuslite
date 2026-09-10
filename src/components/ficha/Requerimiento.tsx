import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronDown, Flame, Info, Ruler, Save, Scale, Sparkles, UserRound, Zap } from 'lucide-react';
import MetCalculator from './MetCalculator.tsx';
import { useAutosaveOnLeave } from '@/hooks/useAutosaveOnLeave';
import type {
  FormulaResult,
  MeasurementRecord,
  RequerimientoProps,
  RequirementInputSnapshot,
  RequirementRecord,
  SaveOrigin,
} from './requerimiento/types';
import {
  ACTIVITY_LEVELS,
  asMeasurementArray,
  buildMacroState,
  calcTMB,
  formatDate,
  FORMULAS,
  isMacroSplitValid,
  formatSigned,
  macroTotalPct,
} from './requerimiento/logic';
import { MacroSection, SummaryMetricCard } from './requerimiento/components';
import { useReqState } from './requerimiento/useReqState';
import type { MetDay } from './metCalculator/types';
import { formatPatientAge } from '@/lib/patients/age';

export default function Requerimiento({ patient, onUpdate, tab = 'energetico', fixedMeasurement, registerAutosave, registerManualSave, hideMeasurementSelector = false, autoSaveOnChange = false, macroPresentation = 'standard' }: RequerimientoProps) {
  const measurements = asMeasurementArray(patient.measurements);
  const sortedMeasurements = [...measurements].sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastInputMode, setLastInputMode] = useState<'pct' | 'g'>('pct');
  const [selectorOpen, setSelectorOpen] = useState(false);

  const selectedMeasurement = fixedMeasurement ?? sortedMeasurements[selectedIdx] ?? null;

  // La pestaña elegida se recuerda: si el nutricionista trabaja por MET, al
  // volver a la consulta la encuentra por MET y no por niveles.
  //
  // VA DESPUÉS de selectedMeasurement, no entre los demás useState de arriba.
  // Puesto antes, el inicializador leía una constante aún no declarada y la
  // pantalla entera reventaba con "Cannot access before initialization".
  const [metMode, setMetMode] = useState(
    () => Boolean(selectedMeasurement?.requirement?.met_mode ?? patient.requirement?.met_mode ?? false),
  );
  // Modo del calculador MET (base / corregido), recordado igual que la pestaña.
  const [nafMode, setNafMode] = useState<'base' | 'corrected'>(
    () => (selectedMeasurement?.requirement?.naf_mode ?? patient.requirement?.naf_mode ?? 'base') as 'base' | 'corrected',
  );
  const weight = selectedMeasurement?.weight || null;
  const height = selectedMeasurement?.height || null;

  const { actLevel, setActLevel, customFactor, setCustomFactor, useCustomFactor, setUseCustomFactor, thermalEffect, setThermalEffect, calAdj, setCalAdj, selectedFormula, setSelectedFormula, macros, setMacros, metDays, setMetDays } = useReqState(selectedMeasurement, patient);

  const buildInputSnapshotFromSource = useCallback((): RequirementInputSnapshot => {
    const req = selectedMeasurement?.requirement || {};
    const globalReq = patient.requirement || {};

    return {
      actLevel: req.activity_level || globalReq.activity_level || 'Sedentario',
      customFactor: req.activity_factor || globalReq.activity_factor || null,
      useCustomFactor: Boolean(req.use_custom_factor ?? globalReq.use_custom_factor ?? false),
      thermalEffect: req.thermal_effect ?? globalReq.thermal_effect ?? false,
      calAdj: req.calorie_adjustment ?? globalReq.calorie_adjustment ?? 0,
      selectedFormula: req.selected_formula || globalReq.selected_formula || 'Mifflin-St Jeor',
      macros: buildMacroState(selectedMeasurement, patient),
      metDays: Array.isArray(req.met_data) ? (req.met_data as MetDay[]) : [],
      metMode: Boolean(req.met_mode ?? globalReq.met_mode ?? false),
      nafMode: (req.naf_mode ?? globalReq.naf_mode ?? 'base') as 'base' | 'corrected',
    };
  }, [patient, selectedMeasurement]);

  const currentInputSnapshot = useMemo<RequirementInputSnapshot>(() => ({
    actLevel,
    customFactor,
    useCustomFactor,
    thermalEffect,
    calAdj,
    selectedFormula,
    macros,
    metDays,
    metMode,
    nafMode,
  }), [actLevel, calAdj, customFactor, macros, metDays, metMode, nafMode, selectedFormula, thermalEffect, useCustomFactor]);

  const [lastSavedInputSnapshot, setLastSavedInputSnapshot] = useState<RequirementInputSnapshot>(() => buildInputSnapshotFromSource());

  const presetFactor = ACTIVITY_LEVELS.find((level) => level.label === actLevel)?.factor || 1.2;
  const actFactor = useCustomFactor && customFactor ? parseFloat(String(customFactor)) : presetFactor;

  const medicionAt = useMemo(() => {
    const raw = selectedMeasurement?.date || selectedMeasurement?.created_at;
    const d = raw ? new Date(String(raw)) : null;
    return d && !Number.isNaN(d.getTime()) ? d : new Date();
  }, [selectedMeasurement]);

  const results = useMemo<FormulaResult[]>(() => {
    return FORMULAS.map((formula) => {
      // Edad A LA FECHA DE LA MEDICIÓN. Con la de hoy, el requerimiento de una
      // consulta vieja se recalcula solo: las mismas medidas dan otra TMB
      // porque el paciente ha cumplido años desde entonces.
      const basal = calcTMB(formula, patient, selectedMeasurement, medicionAt);
      if (!basal) return { formula, basal: null, eta: null, af: null, total: null, toUse: null };

      const af = basal * actFactor;
      const eta = thermalEffect ? basal * 0.1 : 0;
      const total = af + eta;
      const toUse = total + (parseFloat(String(calAdj)) || 0);

      return { formula, basal: Math.round(basal), eta: Math.round(eta), af: Math.round(af), total: Math.round(total), toUse: Math.round(toUse) };
    });
  }, [actFactor, calAdj, patient, selectedMeasurement, medicionAt, thermalEffect]);

  const validResults = results.filter((result) => result.toUse != null);
  const avgToUse = validResults.length ? Math.round(validResults.reduce((sum, result) => sum + (result.toUse || 0), 0) / validResults.length) : null;
  const avgBasal = validResults.length ? Math.round(validResults.reduce((sum, result) => sum + (result.basal || 0), 0) / validResults.length) : null;
  const avgAF = validResults.length ? Math.round(validResults.reduce((sum, result) => sum + (result.af || 0), 0) / validResults.length) : null;
  const avgETA = validResults.length ? Math.round(validResults.reduce((sum, result) => sum + (result.eta || 0), 0) / validResults.length) : null;

  const isPromedioSelected = selectedFormula === 'Promedio';
  const selectedResult = isPromedioSelected
    ? (avgToUse ? { formula: 'Promedio', basal: avgBasal, af: avgAF, eta: avgETA, total: avgToUse, toUse: avgToUse } : null)
    : results.find((result) => result.formula === selectedFormula) || null;
  const targetCal = selectedResult?.toUse || selectedMeasurement?.requirement?.target_calories || patient.target_calories || 2000;
  const vctBasal = selectedResult?.basal || 0;
  const vctETA = selectedResult?.eta || 0;
  const vctAdj = parseFloat(String(calAdj)) || 0;
  const activityContribution = selectedResult?.af != null && selectedResult?.basal != null ? selectedResult.af - selectedResult.basal : 0;

  // Tarjeta de objetivo: siempre clara y moderna (no degrada azul del sidebar).
  // El número en coral es el ancla visual; el desglose va secundario abajo.
  const breakdown = [
    { label: 'Basal', value: vctBasal || '—', tone: 'text-slate-900' },
    { label: 'Actividad', value: selectedResult?.af != null ? formatSigned(activityContribution) : '—', tone: 'text-brand-600' },
    { label: 'ETA', value: thermalEffect ? formatSigned(vctETA) : '0', tone: 'text-slate-900' },
    { label: 'Ajuste', value: formatSigned(vctAdj), tone: 'text-slate-900' },
  ];

  const ModeToggle = (
    <div className="inline-flex flex-shrink-0 gap-0.5 rounded-full bg-slate-100/90 p-1">
      <button type="button" onClick={() => setMetMode(false)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${!metMode ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
        <Zap className="h-3 w-3" /> Nivel
      </button>
      <button type="button" onClick={() => setMetMode(true)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${metMode ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
        <Activity className="h-3 w-3" /> MET
      </button>
    </div>
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(currentInputSnapshot) !== JSON.stringify(lastSavedInputSnapshot),
    [currentInputSnapshot, lastSavedInputSnapshot],
  );

  useEffect(() => {
    setLastSavedInputSnapshot(buildInputSnapshotFromSource());
    setSaved(false);
  }, [buildInputSnapshotFromSource]);

  useEffect(() => {
    if (hasUnsavedChanges) setSaved(false);
  }, [hasUnsavedChanges]);

  const buildSavePayload = useCallback(() => {
    const carbPct = Number(macros.carbs.pct) || 0;
    const protPct = Number(macros.protein.pct) || 0;
    const fatPct = Number(macros.fat.pct) || 0;
    const carbG = Math.round(((targetCal * carbPct) / 100 / 4) * 10) / 10;
    const protG = Math.round(((targetCal * protPct) / 100 / 4) * 10) / 10;
    const fatG = Math.round(((targetCal * fatPct) / 100 / 9) * 10) / 10;

    const reqData: RequirementRecord = {
      activity_level: actLevel,
      activity_factor: actFactor,
      use_custom_factor: useCustomFactor,
      met_mode: metMode,
      naf_mode: nafMode,
      thermal_effect: thermalEffect,
      calorie_adjustment: parseFloat(String(calAdj)) || 0,
      selected_formula: selectedFormula,
      target_calories: targetCal,
      target_carbs: carbG,
      target_protein: protG,
      target_fat: fatG,
      macro_pct_carbs: carbPct,
      macro_pct_protein: protPct,
      macro_pct_fat: fatPct,
      met_data: metDays,
    };

    const updatedMeasurements = asMeasurementArray(patient.measurements).map((measurement) => {
      if (measurement === selectedMeasurement || measurement.date === selectedMeasurement?.date) {
        return { ...measurement, requirement: reqData };
      }
      return measurement;
    });

    return {
      payload: {
        measurements: updatedMeasurements,
        target_calories: targetCal,
        target_carbs: carbG,
        target_protein: protG,
        target_fat: fatG,
        macro_pct_carbs: carbPct,
        macro_pct_protein: protPct,
        macro_pct_fat: fatPct,
      },
    };
    // `metMode`, `nafMode` y `useCustomFactor` van aquí porque el cuerpo los
    // GUARDA (met_mode, naf_mode, use_custom_factor) y ninguno de ellos mueve
    // otra dependencia por su cuenta: `actFactor` sale de `actLevel` y de
    // `customFactor`, así que pasar de «Por nivel» a «Manual» sin escribir aún
    // el factor no cambiaba nada de esta lista. El callback se quedaba con los
    // valores anteriores y el requerimiento se guardaba con el modo
    // equivocado; al reabrir la ficha, la pantalla volvía en un modo distinto
    // del que el nutricionista había elegido.
  }, [actFactor, actLevel, calAdj, macros, metDays, metMode, nafMode, patient.measurements, selectedFormula, selectedMeasurement, targetCal, thermalEffect, useCustomFactor]);

  const handleSave = useCallback(async (origin: SaveOrigin = 'manual'): Promise<void> => {
    if (isSaving) return;

    // El reparto que no suma 100 NO SE GUARDA, ni a mano ni por autoguardado.
    //
    // El autoguardado es la mitad importante de esta guarda: se dispara al salir
    // de la pestaña, así que sin esta línea bastaba con cambiar un porcentaje y
    // marcharse para dejar el dato corrupto grabado sin haber pulsado nada. De
    // los 5 pacientes que aparecieron mal en la revisión, ninguno necesitó que
    // alguien insistiera en guardar.
    //
    // No se avisa aquí con un toast: el panel de macronutrientes ya explica
    // cuánto falta y trae el botón para repartirlo. Un mensaje flotante que
    // aparece y se va sería justo la clase de aviso que ya se demostró que no
    // se ve.
    if (!isMacroSplitValid(macros)) return;

    setIsSaving(true);
    try {
      const { payload } = buildSavePayload();
      const persisted = await onUpdate(payload);
      // Si no se persistió no se toca el snapshot ni se enciende el "Guardado":
      // el requerimiento sigue contando como pendiente.
      if (!persisted) return;

      setLastSavedInputSnapshot(currentInputSnapshot);
      setSaved(origin === 'manual');

      if (origin === 'manual') {
        window.setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [buildSavePayload, currentInputSnapshot, isSaving, macros, onUpdate]);

  // Se recalcula aquí y no se sube desde MacroSection para que los dos botones
  // de guardar sepan el estado sin depender de que la sección esté montada:
  // en la vista compacta no siempre lo está.
  const macroSplitOk = isMacroSplitValid(macros);
  const macroSplitTotal = macroTotalPct(macros);

  const flushAutosave = useAutosaveOnLeave({
    hasUnsavedChanges,
    onAutosave: () => handleSave('autosave'),
  });

  useEffect(() => {
    if (!registerAutosave) return undefined;

    registerAutosave(flushAutosave);
    return () => registerAutosave(null);
  }, [flushAutosave, registerAutosave]);

  useEffect(() => {
    if (!registerManualSave) return undefined;

    registerManualSave(() => handleSave('manual'));
    return () => registerManualSave(null);
  }, [handleSave, registerManualSave]);

  useEffect(() => {
    if (!autoSaveOnChange || !hasUnsavedChanges || isSaving) return undefined;

    const timeoutId = window.setTimeout(() => {
      void handleSave('autosave');
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [autoSaveOnChange, handleSave, hasUnsavedChanges, isSaving]);

  const selectedM = fixedMeasurement ?? sortedMeasurements[selectedIdx] ?? null;
  const hasReqSelected = !!selectedM?.requirement?.target_calories;

  const handleSelectMeasurement = async (index: number): Promise<void> => {
    if (index === selectedIdx) {
      setSelectorOpen(false);
      return;
    }

    void flushAutosave();
    setSelectedIdx(index);
    setSelectorOpen(false);
  };

  const MeasurementSelector = () => {
    if (fixedMeasurement || sortedMeasurements.length === 0) return null;

    return (
      <div className="relative">
        <div onClick={() => setSelectorOpen((open) => !open)} className="cursor-pointer rounded-[1.5rem] border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:border-brand-300">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-slate-400">Evaluación</span>
                {selectedM?.date ? (
                  <span className="text-sm font-bold text-slate-900">{formatDate(selectedM.date)}</span>
                ) : (
                  <input
                    type="date"
                    className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      const originalIndex = asMeasurementArray(patient.measurements).indexOf(selectedM as MeasurementRecord);
                      if (originalIndex === -1) return;

                      const nextMeasurements = asMeasurementArray(patient.measurements).map((measurement, index) => (
                        index === originalIndex ? { ...measurement, date: event.target.value } : measurement
                      ));
                      void onUpdate({ measurements: nextMeasurements });
                    }}
                    placeholder="Asignar fecha"
                  />
                )}
              </div>
              {selectedIdx === 0 && selectedM?.date ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">última</span> : null}
              {hasReqSelected ? <span className="text-[10px] font-semibold text-energy-600">Guardado</span> : null}
            </div>

            <div className="flex items-center gap-3">
              {selectedM?.weight ? <span className="text-sm font-semibold tabular-nums text-slate-700">{selectedM.weight} kg</span> : null}
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleSave('manual');
                }}
                disabled={!macroSplitOk}
                title={macroSplitOk ? undefined : `Los macronutrientes suman ${macroSplitTotal} %. Ajústalos a 100 % para guardar.`}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                  !macroSplitOk
                    ? 'cursor-not-allowed bg-amber-100 text-amber-800'
                    : saved ? 'bg-energy-400 text-slate-950' : 'bg-coral-500 text-white hover:bg-coral-600'
                }`}
              >
                <Save className="h-3 w-3" />
                {!macroSplitOk
                  ? `Macros ${macroSplitTotal}%`
                  : isSaving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}
              </button>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${selectorOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>

        {selectorOpen ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)]">
            {sortedMeasurements.map((measurement, index) => {
              const hasReq = !!measurement.requirement?.target_calories;
              const isSelected = index === selectedIdx;

              return (
                <div
                  key={`${measurement.date || 'measurement'}-${index}`}
                  onClick={() => {
                    void handleSelectMeasurement(index);
                  }}
                  className={`flex cursor-pointer items-center justify-between border-b border-slate-50 px-4 py-3 text-left transition last:border-0 ${isSelected ? 'bg-brand-50' : 'hover:bg-[#f7f8fc]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 flex-shrink-0 rounded-full ${isSelected ? 'bg-brand-500' : 'bg-slate-200'}`} />
                    {measurement.date ? (
                      <span className={`text-sm font-semibold ${isSelected ? 'text-brand-600' : 'text-slate-700'}`}>{formatDate(measurement.date)}</span>
                    ) : (
                      <input
                        type="date"
                        className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          if (!event.target.value) return;
                          const originalIndex = asMeasurementArray(patient.measurements).indexOf(measurement);
                          if (originalIndex === -1) return;

                          const nextMeasurements = asMeasurementArray(patient.measurements).map((currentMeasurement, currentIndex) => (
                            currentIndex === originalIndex ? { ...currentMeasurement, date: event.target.value } : currentMeasurement
                          ));
                          void onUpdate({ measurements: nextMeasurements });
                          setSelectorOpen(false);
                        }}
                        placeholder="Asignar fecha"
                      />
                    )}
                    {index === 0 && measurement.date ? <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-600">última</span> : null}
                  </div>

                  <div className="flex items-center gap-3">
                    {measurement.weight ? <span className="text-sm font-medium tabular-nums text-slate-500">{measurement.weight} kg</span> : null}
                    {hasReq ? <span className="text-[10px] font-semibold text-energy-600">Guardado</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  const quickStats = [
    { label: 'Edad', value: formatPatientAge(patient, '—'), hint: 'Calculada desde la fecha de nacimiento.', icon: <UserRound className="h-4 w-4" /> },
    { label: 'Sexo', value: patient.gender || patient.sex || '—', hint: 'Dato usado por las fórmulas de GEB.', icon: <Sparkles className="h-4 w-4" /> },
    { label: 'Peso', value: weight ? `${weight} kg` : '—', hint: 'Medición activa para el cálculo actual.', icon: <Scale className="h-4 w-4" /> },
    { label: 'Talla', value: height ? `${height} cm` : '—', hint: 'Medición activa para las fórmulas.', icon: <Ruler className="h-4 w-4" /> },
    { label: 'Evaluación', value: selectedMeasurement ? formatDate(selectedMeasurement.date) : '—', hint: 'Consulta antropométrica seleccionada.', icon: <CalendarDays className="h-4 w-4" /> },
  ];

  if (tab === 'macronutrientes') {
    return (
      <div className="max-w-4xl space-y-5">
        {macroPresentation === 'exchange-clinical' || macroPresentation === 'diet-compact' ? (
          <div className="flex flex-wrap gap-3.5">
            {quickStats.map((item) => (
              <SummaryMetricCard key={item.label} icon={item.icon} label={item.label} value={item.value} hint={item.hint} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-slate-200/70 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-coral-50 text-coral-500">
                <Flame className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400">Objetivo</p>
                <p className="text-sm font-bold text-slate-900">
                  <span className="tabular-nums text-coral-500">{targetCal}</span>
                  {' '}kcal/día{weight ? <span className="font-semibold text-slate-400"> · {weight} kg</span> : null}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleSave('manual')}
              disabled={!macroSplitOk}
              title={macroSplitOk ? undefined : `Los macronutrientes suman ${macroSplitTotal} %. Ajústalos a 100 % para guardar.`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                !macroSplitOk
                  ? 'cursor-not-allowed bg-amber-100 text-amber-800'
                  : saved ? 'bg-energy-400 text-slate-950' : 'bg-coral-500 text-white hover:bg-coral-600'
              }`}
            >
              <Save className="h-3 w-3" />
              {!macroSplitOk
                ? `Macros ${macroSplitTotal}%`
                : isSaving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}
            </button>
          </div>
        )}

        {!hideMeasurementSelector ? <MeasurementSelector /> : null}
        {!weight ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-center gap-2"><Info className="h-4 w-4 flex-shrink-0" /> Completa el peso en Mediciones para ver g/kg.</div>
          </div>
        ) : null}

        <MacroSection
          totalCal={targetCal}
          weight={weight}
          macros={macros}
          setMacros={setMacros}
          setLastInputMode={setLastInputMode}
          lastInputMode={lastInputMode}
          compact={macroPresentation === 'diet-compact'}
        />
      </div>
    );
  }

  const formulaRows = [
    ...results.map((result) => ({
      key: result.formula,
      label: result.formula,
      basal: result.basal,
      activity: result.basal != null && result.af != null ? result.af - result.basal : null,
      eta: result.eta,
      total: result.toUse,
      selectable: result.toUse != null,
    })),
    ...(avgToUse
      ? [{
          key: 'Promedio',
          label: 'Promedio',
          basal: avgBasal,
          activity: avgAF != null && avgBasal != null ? avgAF - avgBasal : avgAF,
          eta: avgETA,
          total: avgToUse,
          selectable: true,
        }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {sortedMeasurements.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-center gap-2"><Info className="h-4 w-4 flex-shrink-0" /> Registra una medición primero.</div>
        </div>
      ) : !hideMeasurementSelector ? <MeasurementSelector /> : null}

      {!weight ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="flex items-center gap-2"><Info className="h-4 w-4 flex-shrink-0" /> Completa peso y talla en Mediciones.</div>
        </div>
      ) : null}

      {metMode ? (
        <MetCalculator
          weight={weight}
          basalKcal={selectedResult?.basal || null}
          initialDays={metDays}
          onDaysChange={setMetDays}
          initialNafMode={nafMode}
          onNafModeChange={setNafMode}
          headerExtra={ModeToggle}
          onNAFCalculated={({ naf }) => {
            // El NAF calculado se guarda como factor manual para permitir ajuste fino posterior.
            setUseCustomFactor(true);
            setCustomFactor(naf);
            setMetMode(false);
          }}
        />
      ) : (
        <div className="mx-auto w-full max-w-5xl space-y-5">
          {/* 1. Objetivo primero — tipografía unificada con el resto de la ficha */}
          {selectedResult?.toUse ? (
            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="px-5 py-5 sm:px-6 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-400">Objetivo diario</p>
                  {ModeToggle}
                </div>

                <div className="mt-2 flex items-end gap-2">
                  <p className="text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-coral-500 sm:text-[44px]">
                    {selectedResult.toUse}
                  </p>
                  <p className="pb-1 text-sm font-semibold text-slate-400">kcal</p>
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-600">{selectedFormula}</span>
                  {selectedMeasurement?.date ? (
                    <>
                      <span className="mx-1.5 text-slate-300">·</span>
                      {formatDate(selectedMeasurement.date)}
                    </>
                  ) : null}
                </p>

                <div className="mt-4 grid grid-cols-4 gap-2 border-t border-slate-100 pt-3.5">
                  {breakdown.map((item) => (
                    <div key={item.label} className="min-w-0 text-center sm:text-left">
                      <p className="text-xs font-semibold text-slate-400">{item.label}</p>
                      <p className={`mt-0.5 truncate text-sm font-bold tabular-nums ${item.tone}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-5 py-10 text-center sm:px-6">
              <div className="mb-4 flex justify-end">{ModeToggle}</div>
              <Flame className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-3 text-sm text-slate-400">Completa peso y talla para ver el objetivo.</p>
            </div>
          )}

          {/* 2. Controles compactos en un solo bloque */}
          <div className="space-y-4 rounded-[1.5rem] border border-slate-200/70 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-900">Actividad</p>
              <button
                type="button"
                onClick={() => setUseCustomFactor((value) => !value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${useCustomFactor ? 'bg-brand-50 text-brand-600' : 'bg-[#f7f8fc] text-slate-500 hover:text-slate-700'}`}
              >
                {useCustomFactor ? 'Factor manual' : 'Usar factor'}
              </button>
            </div>

            {useCustomFactor ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/40 px-4 py-2">
                  <span className="text-sm font-semibold text-brand-500">×</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="3"
                    value={customFactor || ''}
                    onChange={(event) => setCustomFactor(event.target.value)}
                    placeholder="1.55"
                    className="w-24 bg-transparent text-center text-sm font-bold tabular-nums text-brand-700 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { setUseCustomFactor(false); setCustomFactor(null); }}
                  className="text-xs font-semibold text-slate-500 transition hover:text-slate-800"
                >
                  Volver a niveles
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_LEVELS.map((level) => {
                  const isSelected = actLevel === level.label;
                  return (
                    <button
                      type="button"
                      key={level.label}
                      title={level.desc}
                      onClick={() => setActLevel(level.label)}
                      className={`rounded-full px-3.5 py-2 text-left transition ${
                        isSelected
                          ? 'bg-brand-500 text-white shadow-[0_8px_18px_rgba(59,95,235,0.22)]'
                          : 'bg-[#f7f8fc] text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block text-xs font-semibold leading-none">{level.label}</span>
                      <span className={`mt-1 block text-[11px] font-semibold tabular-nums ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>×{level.factor}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="h-px bg-slate-100" />

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setThermalEffect((value) => !value)}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  thermalEffect ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200' : 'bg-[#f7f8fc] text-slate-500 hover:text-slate-700'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${thermalEffect ? 'bg-brand-500' : 'bg-slate-300'}`} />
                ETA +10%
              </button>

              <div className="inline-flex items-center gap-1 rounded-full bg-[#f7f8fc] p-1">
                <button
                  type="button"
                  aria-label="Bajar ajuste"
                  onClick={() => setCalAdj(String((parseFloat(String(calAdj)) || 0) - 50))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800"
                >
                  −
                </button>
                <div className="flex min-w-[7.5rem] items-center justify-center gap-1 px-1">
                  <input
                    type="number"
                    step="1"
                    value={calAdj}
                    onChange={(event) => setCalAdj(String(Math.round(Number(event.target.value)) || 0))}
                    onBlur={(event) => setCalAdj(String(Math.round(Number(event.target.value)) || 0))}
                    className="w-16 bg-transparent text-center text-sm font-bold tabular-nums text-slate-800 focus:outline-none"
                    aria-label="Ajuste calórico"
                  />
                  <span className="text-xs font-semibold text-slate-400">kcal</span>
                </div>
                <button
                  type="button"
                  aria-label="Subir ajuste"
                  onClick={() => setCalAdj(String((parseFloat(String(calAdj)) || 0) + 50))}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-slate-500 transition hover:bg-white hover:text-slate-800"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 3. Fórmulas — misma escala tipográfica que el desglose */}
          <div className="space-y-2.5">
            <p className="px-1 text-sm font-bold text-slate-900">Fórmula</p>
            <div className="space-y-2">
              {formulaRows.map((row) => {
                const isSelected = selectedFormula === row.key;
                return (
                  <button
                    type="button"
                    key={row.key}
                    disabled={!row.selectable}
                    onClick={() => { if (row.selectable) setSelectedFormula(row.key); }}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition sm:px-5 ${
                      isSelected
                        ? 'bg-white ring-2 ring-coral-400/70 shadow-[0_8px_24px_rgba(255,92,87,0.12)]'
                        : row.selectable
                          ? 'bg-white ring-1 ring-slate-200/70 hover:ring-slate-300'
                          : 'cursor-not-allowed bg-white/40 opacity-50 ring-1 ring-slate-100'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`truncate text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{row.label}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Basal {row.basal ?? '—'}
                        {row.activity != null ? ` · Act ${formatSigned(row.activity)}` : ''}
                        {thermalEffect && row.eta != null ? ` · ETA ${formatSigned(row.eta)}` : ''}
                      </p>
                    </div>
                    <p className={`flex-shrink-0 text-sm font-bold tabular-nums ${isSelected ? 'text-coral-500' : 'text-slate-800'}`}>
                      {row.total ?? '—'}
                      {row.total != null ? <span className="ml-1 text-xs font-semibold text-slate-400">kcal</span> : null}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}