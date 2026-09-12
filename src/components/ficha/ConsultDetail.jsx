import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Eraser } from "lucide-react";
import ResultsTab from "./ResultsTab";
import PediatricAnthroPanel from "./PediatricAnthroPanel";
import { ageInMonths, isPediatricPatient, parseSex, pediatricFieldRange } from "@/lib/anthropometry/pediatric";
import { activePregnancy } from "@/lib/gestation/gestationalGain";
import Requerimiento from "./Requerimiento.tsx";
import { useAutosaveOnLeave } from "@/hooks/useAutosaveOnLeave";
import {
  GROUPS, TABS, TAB_KEYS, SECTIONS, TAB_PATH,
  FIELD_META, DEFAULT_MEALS, countFilled, countRequired,
  ANTRO_TAB_KEYS, MEASURE_TAB_KEYS,
} from "./consult/consultConfig";
import MeasureInput from "./consult/MeasureInput";
import FichaContextBar from "./consult/FichaContextBar";
import DietPanel from "./diet/DietPanel";
import ResultsPrintButton from "./results/ResultsPrintButton";
import Bioquimica from "./Bioquimica";
import DieteticaPanel from "./dietetica/DieteticaPanel";

const DIET_TABS = new Set(["alimentos", "intercambios", "artificial"]);
const pillActive = "ng-pill ng-pill-active";
const pillIdle = "ng-pill ng-pill-idle";
const shellClass = "ng-card";
const sidePillActive = "ng-pill ng-pill-active md:w-full md:justify-start md:rounded-xl";
const sidePillIdle = "ng-pill ng-pill-idle md:w-full md:justify-start md:rounded-xl md:bg-transparent md:shadow-none md:hover:bg-[#f4f6fb]";

export default function ConsultDetail({
  patient,
  consultIndex,
  onBack,
  onUpdate,
  onPatientUpdate,
  registerAutosave,
  embedded = false,
}) {
  const measurements = patient.measurements || [];
  const [data, setData] = useState({ ...measurements[consultIndex] });
  const pathologies = patient.health_conditions?.current_pathologies;
  const pregnancy = activePregnancy(patient.pregnancies);
  const isChild = useMemo(
    () => !pregnancy && isPediatricPatient(ageInMonths(patient.birth_date, data.date), pathologies),
    [pregnancy, patient.birth_date, data.date, pathologies],
  );
  const pedRangeFor = useMemo(() => {
    if (!isChild) return () => null;
    const sex = parseSex(patient.gender || patient.sex);
    const months = ageInMonths(patient.birth_date, data.date);
    return (key) => pediatricFieldRange(key, sex, months);
  }, [isChild, patient.gender, patient.sex, patient.birth_date, data.date]);

  const [recall] = useState(
    Array.isArray(measurements[consultIndex]?.recall_24h) && measurements[consultIndex].recall_24h.length > 0
      ? measurements[consultIndex].recall_24h
      : DEFAULT_MEALS,
  );
  // Al volver desde DietCreator/ExchangeDietCreator se guarda la pestaña en
  // sessionStorage para no aterrizar otra vez en antropometría.
  const [tabIdx, setTabIdx] = useState(() => {
    try {
      const saved = sessionStorage.getItem("ng_lite_ficha_tab");
      if (saved) {
        sessionStorage.removeItem("ng_lite_ficha_tab");
        const idx = TAB_KEYS.indexOf(saved);
        if (idx >= 0) return idx;
      }
    } catch {
      /* ignore */
    }
    return 0;
  });
  const [campoResaltado, setCampoResaltado] = useState(null);
  const temporizadorResaltado = useRef(null);

  const resaltarCampo = (fieldKey) => {
    clearTimeout(temporizadorResaltado.current);
    setCampoResaltado(fieldKey);
    if (!fieldKey) return;
    temporizadorResaltado.current = setTimeout(() => setCampoResaltado(null), 15000);
  };

  useEffect(() => () => clearTimeout(temporizadorResaltado.current), []);

  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => ({
    data: { ...measurements[consultIndex] },
    recall: Array.isArray(measurements[consultIndex]?.recall_24h) && measurements[consultIndex].recall_24h.length > 0
      ? measurements[consultIndex].recall_24h
      : DEFAULT_MEALS,
  }));
  const requirementAutosaveRef = useRef(null);

  const tab = TAB_KEYS[tabIdx];
  const isAntro = ANTRO_TAB_KEYS.includes(tab);
  const isMeasure = MEASURE_TAB_KEYS.includes(tab);
  const isLast = tabIdx === TAB_KEYS.length - 1;
  const inputRefs = useRef([]);
  const currentSnapshot = useMemo(() => ({ data, recall }), [data, recall]);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(currentSnapshot) !== JSON.stringify(lastSavedSnapshot),
    [currentSnapshot, lastSavedSnapshot],
  );

  const setField = useCallback((path, value) => {
    setData((d) => {
      const parts = path.split(".");
      if (parts.length === 1) return { ...d, [path]: value };
      return { ...d, [parts[0]]: { ...(d[parts[0]] || {}), [parts[1]]: value } };
    });
  }, []);

  const handleSave = async (_origin = "manual", extraData = {}) => {
    const safeExtra = (extraData && typeof extraData === "object" && !extraData.nativeEvent && !(extraData instanceof Event)) ? extraData : {};
    // Preferir el R24h vivo de la ficha (Dietética) sobre el snapshot local legado.
    const liveRecall = Array.isArray(measurements[consultIndex]?.recall_24h)
      ? measurements[consultIndex].recall_24h
      : recall;
    const merged = { ...data, recall_24h: liveRecall, ...safeExtra };
    const newMeasurements = [...measurements];
    newMeasurements[consultIndex] = merged;
    setData(merged);
    const saved = await onUpdate({ measurements: newMeasurements });
    if (saved) {
      setLastSavedSnapshot({ data: merged, recall: merged.recall_24h || liveRecall });
    }
    return saved;
  };

  const flushFormAutosave = useAutosaveOnLeave({
    hasUnsavedChanges,
    onAutosave: () => handleSave("autosave"),
  });

  const registerRequirementAutosave = useCallback((handler) => {
    requirementAutosaveRef.current = handler;
  }, []);

  const flushAutosave = useCallback(async () => {
    if (requirementAutosaveRef.current) {
      await requirementAutosaveRef.current();
    }
    await flushFormAutosave();
  }, [flushFormAutosave]);

  useEffect(() => {
    if (!registerAutosave) return undefined;
    registerAutosave(flushAutosave);
    return () => registerAutosave(null);
  }, [flushAutosave, registerAutosave]);

  const handleBack = async () => {
    void flushAutosave();
    onBack();
  };

  const focusNext = (currentIdx) => {
    const next = inputRefs.current[currentIdx + 1];
    if (next) next.focus();
    else if (!isLast) setTabIdx((i) => i + 1);
  };

  const sections = SECTIONS[tab] || [];
  const path = TAB_PATH[tab];
  const flatFields = sections.flatMap((s) => s.fields);
  const totalFields = flatFields.length;
  inputRefs.current = [];

  const filledCounts = MEASURE_TAB_KEYS.map((k) => countFilled(k, data));

  const goToAntroTab = (key) => {
    const idx = TAB_KEYS.indexOf(key);
    if (idx >= 0) setTabIdx(idx);
  };

  const renderResults = () => {
    if (pregnancy || !isChild) {
      return (
        <ResultsTab
          data={data}
          sex={patient.gender || patient.sex}
          patient={patient}
          onSetField={setField}
          onGoToField={(group, fieldKey) => {
            const idx = TAB_KEYS.indexOf(group);
            setTabIdx(idx >= 0 ? idx : TAB_KEYS.indexOf("peso"));
            resaltarCampo(fieldKey || null);
          }}
        />
      );
    }

    return (
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex justify-end">
          <ResultsPrintButton patient={patient} measurement={data} />
        </div>
        <PediatricAnthroPanel
          gender={patient.gender || patient.sex}
          birthDate={patient.birth_date}
          pathologies={pathologies}
          measurementDate={data.date}
          weightKg={data.weight}
          heightCm={data.height}
          headCircCm={data.perimeters?.cephalic}
          armCircCm={data.perimeters?.arm_relaxed}
          tricepsSkinfoldMm={data.skinfolds?.triceps}
          subscapularSkinfoldMm={data.skinfolds?.subscapular}
          abdominalCm={data.perimeters?.abdominal_per}
          waistCm={data.perimeters?.waist}
          measurements={measurements.map((mm, i) => {
            const src = i === consultIndex ? data : mm;
            return {
              date: src?.date,
              weightKg: src?.weight,
              heightCm: src?.height,
              headCircCm: src?.perimeters?.cephalic,
              armCircCm: src?.perimeters?.arm_relaxed,
              tricepsMm: src?.skinfolds?.triceps,
              subscapularMm: src?.skinfolds?.subscapular,
            };
          })}
        />
      </div>
    );
  };

  const renderAntroNav = () => (
    <div className="flex w-full flex-shrink-0 gap-2 overflow-x-auto border-b border-slate-100 bg-[#fafbfd] p-3 md:w-52 md:flex-col md:gap-1.5 md:overflow-visible md:border-b-0 md:border-r md:p-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ANTRO_TAB_KEYS.map((key) => {
        const t = TABS.find((item) => item.key === key);
        const i = TAB_KEYS.indexOf(key);
        const isActive = i === tabIdx;
        const measureIdx = MEASURE_TAB_KEYS.indexOf(key);
        const filled = measureIdx >= 0 ? (filledCounts[measureIdx] ?? 0) : 0;
        const r4 = key !== "res" ? countRequired(key, data, "req4") : { filled: 0, total: 0 };
        const r5 = key !== "res" ? countRequired(key, data, "req5") : { filled: 0, total: 0 };
        const needs4 = r4.total > 0;
        const needs5 = r5.total > 0;
        const reqDone = key !== "res" && (!needs4 || r4.filled === r4.total) && (!needs5 || r5.filled === r5.total);
        const partial = filled > 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => goToAntroTab(key)}
            className={`flex flex-shrink-0 items-center gap-2 ${
              isActive ? sidePillActive : sidePillIdle
            }`}
          >
            {reqDone && partial && !isActive
              ? <Check className="h-3.5 w-3.5 flex-shrink-0 text-energy-500" />
              : <span className="h-3.5 w-3.5 flex-shrink-0" />}
            <span className="truncate md:flex-1">{t?.label || key}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full">
      {!embedded ? (
        <div className="mb-4 md:hidden">
          <button type="button" onClick={() => void handleBack()} className="ng-back">
            Volver
          </button>
        </div>
      ) : null}

      <div className="mb-5 flex items-center gap-2.5 overflow-x-auto overflow-y-hidden border-b border-slate-200/70 px-0.5 pb-4 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
        {!embedded ? (
          <div className="hidden flex-shrink-0 items-center pr-2 md:flex">
            <button type="button" onClick={() => void handleBack()} className="ng-back">
              Volver
            </button>
          </div>
        ) : null}
        {GROUPS.map((group) => {
          const groupTabIdxs = group.tabs.map((t) => TAB_KEYS.indexOf(t.key));
          const isGroupActive = groupTabIdxs.includes(tabIdx);
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => setTabIdx(groupTabIdxs[0])}
              className={`shrink-0 ${isGroupActive ? pillActive : pillIdle}`}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      <FichaContextBar
        patient={patient}
        measurement={data}
        onPatientChange={(patch) => {
          if (onPatientUpdate) void onPatientUpdate(patch);
          else void onUpdate(patch);
        }}
        onMeasurementChange={(patch) => {
          setData((prev) => {
            const next = { ...prev, ...patch };
            const list = [...measurements];
            list[consultIndex] = next;
            void onUpdate({ measurements: list });
            return next;
          });
        }}
      />

      <div className={
        tab === "cal" || tab === "bioq" || tab === "dietetica" || DIET_TABS.has(tab)
          ? ""
          : `${shellClass}${isAntro && tab !== "res" ? " flex flex-col md:flex-row" : isAntro ? " flex flex-col md:flex-row" : ""}`
      }>
        {DIET_TABS.has(tab) ? (
          <div className={shellClass}>
            <div className="flex gap-2.5 overflow-x-auto border-b border-slate-100 bg-[#fafbfd] px-4 py-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {GROUPS.find((g) => g.key === "dieta")?.tabs.map((t) => {
                const i = TAB_KEYS.indexOf(t.key);
                const isActive = i === tabIdx;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTabIdx(i)}
                    className={`shrink-0 ${isActive ? pillActive : pillIdle}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="ng-inset">
              <DietPanel mode={tab} />
            </div>
          </div>
        ) : tab === "cal" ? (
          <div className={`${shellClass} ng-inset`}>
            <Requerimiento
              patient={{ ...patient, measurements: [{ ...data }] }}
              fixedMeasurement={data}
              registerAutosave={registerRequirementAutosave}
              autoSaveOnChange
              hideContextStats
              onUpdate={async (updates) => {
                const req = updates.measurements?.[0]?.requirement;
                if (req) {
                  await handleSave("manual", { requirement: req });
                } else {
                  await handleSave("manual");
                }
              }}
              tab="energetico"
            />
          </div>
        ) : tab === "bioq" ? (
          <div className={`${shellClass} ng-inset`}>
            <Bioquimica
              key={`bioq-${tab}`}
              patient={patient}
              onUpdate={async (patch) => {
                if (onPatientUpdate) return onPatientUpdate(patch);
                return onUpdate(patch);
              }}
            />
          </div>
        ) : tab === "dietetica" ? (
          <div className={`${shellClass} ng-inset`}>
            <DieteticaPanel
              patient={patient}
              consultIndex={consultIndex}
              registerAutosave={registerAutosave}
              onUpdate={async (patch) => {
                if (onPatientUpdate) return onPatientUpdate(patch);
                return onUpdate(patch);
              }}
            />
          </div>
        ) : isAntro ? (
          <>
            {renderAntroNav()}
            <div className="min-w-0 flex-1 overflow-auto">
              {tab === "res" ? renderResults() : (
                <>
                  <div className="space-y-5 p-5 sm:p-6">
                    {(() => {
                      let globalIdx = 0;
                      return sections.map((section) => (
                        <div key={section.title}>
                          <h4 className="ng-section-title mb-2.5">
                            {section.title}
                          </h4>
                          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/70 bg-[#fafbfd]">
                            {section.fields.map(([key, label, unit]) => {
                              const myIdx = globalIdx++;
                              const val = path ? (data[path]?.[key] ?? null) : (data[key] ?? null);
                              return (
                                <MeasureInput
                                  key={key}
                                  fieldKey={key}
                                  label={label}
                                  value={val}
                                  unit={unit}
                                  pedRange={pedRangeFor(key)}
                                  onChange={(v) => setField(path ? `${path}.${key}` : key, v)}
                                  onManualChange={FIELD_META[key]?.isak
                                    ? ((v) => { setField(path ? `${path}.${key}` : key, v); setField(`isak.${key}`, []); })
                                    : undefined}
                                  resaltado={campoResaltado === key}
                                  inputRef={(el) => { if (el) inputRefs.current[myIdx] = el; }}
                                  onEnter={() => focusNext(myIdx)}
                                  isakValues={FIELD_META[key]?.isak ? (data.isak?.[key] || []) : undefined}
                                  onIsakChange={FIELD_META[key]?.isak ? ((arr) => setField(`isak.${key}`, arr)) : undefined}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-[#fafbfd] px-5 py-4 sm:px-6">
                    <p className="ng-muted">{totalFields} medidas</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm("¿Limpiar esta sección?")) return;
                          setData((d) => {
                            if (!path) {
                              const cleared = { ...d };
                              flatFields.forEach(([k]) => { cleared[k] = null; });
                              return cleared;
                            }
                            const sub = { ...(d[path] || {}) };
                            flatFields.forEach(([k]) => { sub[k] = null; });
                            return { ...d, [path]: sub };
                          });
                        }}
                        className="ng-btn-ghost hover:border-rose-200 hover:text-rose-500"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        Limpiar
                      </button>
                      {isMeasure && MEASURE_TAB_KEYS.indexOf(tab) < MEASURE_TAB_KEYS.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const nextKey = MEASURE_TAB_KEYS[MEASURE_TAB_KEYS.indexOf(tab) + 1];
                            goToAntroTab(nextKey);
                          }}
                          className="ng-btn-primary"
                        >
                          Siguiente
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => goToAntroTab("res")}
                          className="ng-btn-primary"
                        >
                          Ver resultados
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
