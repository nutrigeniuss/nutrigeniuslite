import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Calculator, Check, Eraser, FileText } from 'lucide-react';
import BackLink from '@/components/ui/back-link';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useAutosaveOnLeave } from '@/hooks/useAutosaveOnLeave';
import { printLabReport } from './printLabReport';
import {
  PANELS,
  countPanelFilled,
  countPanelOutOfRange,
  parseSexKey,
  resolveRange,
  type LabEntry,
  type LabRange,
} from './biochemConfig';
import LabValueRow from './LabValueRow';
import LabIndicesPanel from './LabIndicesPanel';
import { computeIndices, type MeasurementLike } from './labIndices';
import { isPregnant, type PregnancyRecord } from '@/lib/gestation/gestationalGain';
import { buildHabitualUpdate, type ReferenceWeightsRecord } from '../ReferenceWeights';
import type { AccountRanges } from './useLabReferenceRanges';
import type { PatientUpdateFn } from '@/lib/patients/types';
import { getCurrentLocale } from '@/lib/formatLocale';

export type BiochemPatientContext = {
  gender?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  measurements?: MeasurementLike[];
  reference_weights?: ReferenceWeightsRecord | null;
  pregnancies?: PregnancyRecord[] | null;
};

type LabEntryDetailProps = {
  entries: LabEntry[];
  entryIndex: number;
  patient: BiochemPatientContext;
  accountRanges: AccountRanges;
  onSaveAccountRange: (key: string, range: LabRange | null) => void;
  onBack: () => void;
  onUpdate: PatientUpdateFn;
  registerAutosave?: (handler: (() => Promise<void>) | null) => void;
};

// Clave virtual del panel de índices: va al final de la barra lateral, separado
// de los paneles de captura porque no se digita, se calcula.
const INDICES_KEY = 'indices';

const formatLongDate = (value?: string | null): string => {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

export default function LabEntryDetail({
  entries,
  entryIndex,
  patient,
  accountRanges,
  onSaveAccountRange,
  onBack,
  onUpdate,
  registerAutosave,
}: LabEntryDetailProps) {
  const { user } = useAuth();
  const [data, setData] = useState<LabEntry>(() => ({ ...entries[entryIndex] }));
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => JSON.stringify(entries[entryIndex]));
  const [activePanel, setActivePanel] = useState<string>(PANELS[0].key);
  const inputRefs = useRef<Array<HTMLInputElement | HTMLSelectElement | null>>([]);

  const sex = useMemo(() => parseSexKey(patient.gender ?? patient.sex), [patient.gender, patient.sex]);
  const showingIndices = activePanel === INDICES_KEY;
  const panel = PANELS.find((item) => item.key === activePanel) ?? PANELS[0];
  const values = data.values || {};
  const entryRanges = data.ranges || {};

  const hasUnsavedChanges = JSON.stringify(data) !== savedSnapshot;

  const setValue = useCallback((key: string, value: number | string | null): void => {
    setData((current) => ({ ...current, values: { ...(current.values || {}), [key]: value } }));
  }, []);

  const setEntryRange = useCallback((key: string, range: LabRange | null): void => {
    setData((current) => {
      const nextRanges = { ...(current.ranges || {}) };
      if (range) nextRanges[key] = range;
      else delete nextRanges[key];
      return { ...current, ranges: nextRanges };
    });
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    const nextEntries = [...entries];
    nextEntries[entryIndex] = data;
    const saved = await onUpdate({ biochemistry: nextEntries });
    // Sin esta guarda, un laboratorio entero se daba por guardado y se perdía
    // al volver a la lista de tomas.
    if (saved) setSavedSnapshot(JSON.stringify(data));
  }, [data, entries, entryIndex, onUpdate]);

  const flushAutosave = useAutosaveOnLeave({ hasUnsavedChanges, onAutosave: handleSave });

  useEffect(() => {
    if (!registerAutosave) return undefined;
    registerAutosave(flushAutosave);
    return () => registerAutosave(null);
  }, [flushAutosave, registerAutosave]);

  const handleBack = (): void => {
    void flushAutosave();
    onBack();
  };

  const focusNext = (currentIdx: number): void => {
    inputRefs.current[currentIdx + 1]?.focus();
  };

  // Resumen de la toma completa: cuántos analitos están cargados y cuántos caen
  // fuera de rango. Es lo primero que el nutri quiere saber al abrir el examen.
  const totals = useMemo(
    () =>
      PANELS.reduce(
        (acc, current) => ({
          filled: acc.filled + countPanelFilled(current, values),
          out: acc.out + countPanelOutOfRange(current, values, sex, accountRanges, entryRanges),
        }),
        { filled: 0, out: 0 },
      ),
    [values, sex, accountRanges, entryRanges],
  );

  // Índices derivados: se recalculan en cada render a partir de los valores en
  // edición, así el nutri ve el HOMA-IR cambiar mientras tipea la insulina.
  const indices = useMemo(
    () =>
      computeIndices(data, {
        sex,
        birthDate: patient.birth_date,
        measurements: patient.measurements || [],
        habitualWeightKg: patient.reference_weights?.habitual?.kg ?? null,
        isPregnant: isPregnant(patient.pregnancies),
        // Los puntos de corte personalizados viven en el mismo JSONB que los
        // rangos de laboratorio, bajo claves 'index:*' y usando `max` como valor.
        thresholds: Object.fromEntries(
          Object.entries(accountRanges)
            .filter(([key, range]) => key.startsWith('index:') && range?.max != null)
            .map(([key, range]) => [key, range.max as number]),
        ),
      }),
    [data, sex, patient.birth_date, patient.measurements, patient.reference_weights, accountRanges],
  );

  const pendingIndices = indices.filter((result) => result.value === null).length;

  // kg=null borra el peso habitual (se tipeó mal y se quiere dejar vacío). El
  // resto del registro —fecha del peso, nota— se conserva.
  const saveHabitualWeight = useCallback(async (kg: number | null): Promise<void> => {
    await onUpdate(buildHabitualUpdate(patient.reference_weights, kg === null ? null : { kg }));
  }, [onUpdate, patient.reference_weights]);

  inputRefs.current = [];

  return (
    <div className="w-full min-w-0">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <BackLink onClick={handleBack} label="Volver" className="self-start" />
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-slate-900 sm:text-[1.05rem]">
              {formatLongDate(data.date)}
            </h2>
            <p className="ng-muted mt-0.5">
              Calculadora temporal · {totals.filled} {totals.filled === 1 ? 'análisis' : 'análisis'}
              {totals.out > 0 ? (
                <span className="ml-1.5 font-semibold text-red-500">· {totals.out} fuera de rango</span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:items-center">
          <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-initial sm:flex-row sm:items-center sm:gap-2">
            <span className="ng-label !mb-0">Laboratorio</span>
            <input
              type="text"
              value={data.lab ?? ''}
              onChange={(event) => setData((current) => ({ ...current, lab: event.target.value }))}
              placeholder="Opcional"
              className="ng-input !mt-0 w-full sm:w-56"
            />
          </label>
          <button
            type="button"
            disabled={totals.filled === 0}
            onClick={async () => {
              await flushAutosave();
              try {
                printLabReport({ patient, entry: data, accountRanges, brand: user?.brandName || undefined, brandLogoUrl: user?.brandLogoUrl });
              } catch (error) {
                toast({
                  title: 'No se pudo generar el reporte',
                  description: error instanceof Error ? error.message : 'Error desconocido.',
                });
              }
            }}
            title={totals.filled === 0 ? 'Carga algún análisis para generar el reporte' : 'Generar PDF de esta toma'}
            className="ng-btn-ghost shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileText className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:rounded-[1.5rem] lg:flex-row">
        <div className="flex w-full flex-shrink-0 gap-1.5 overflow-x-auto border-b border-slate-100 bg-[#fafbfd] p-2.5 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch] lg:w-64 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3.5">
          {PANELS.map((item) => {
            const isActive = item.key === activePanel;
            const filled = countPanelFilled(item, values);
            const out = countPanelOutOfRange(item, values, sex, accountRanges, entryRanges);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivePanel(item.key)}
                className={`flex min-h-11 flex-shrink-0 touch-manipulation items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all sm:gap-2.5 sm:text-sm lg:w-full lg:flex-shrink ${
                  isActive
                    ? 'bg-brand-500 text-white shadow-[0_8px_18px_rgba(59,95,235,0.28)]'
                    : 'text-slate-500 hover:bg-white hover:text-slate-800'
                }`}
              >
                {out > 0 ? (
                  <AlertTriangle className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-white/90' : 'text-red-400'}`} />
                ) : filled > 0 ? (
                  <Check className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-white/90' : 'text-energy-600'}`} />
                ) : (
                  <span className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className="truncate lg:flex-1">{item.label}</span>
                {filled > 0 ? (
                  <span className={`text-[10px] font-bold tabular-nums ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{filled}</span>
                ) : null}
              </button>
            );
          })}

          <div className="my-2 hidden border-t border-slate-200/80 lg:mx-2 lg:block" />
          <button
            type="button"
            onClick={() => setActivePanel(INDICES_KEY)}
            className={`flex min-h-11 flex-shrink-0 touch-manipulation items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13px] font-semibold transition-all sm:gap-2.5 sm:text-sm lg:w-full lg:flex-shrink ${
              showingIndices
                ? 'bg-brand-500 text-white shadow-[0_8px_18px_rgba(59,95,235,0.28)]'
                : 'text-slate-500 hover:bg-white hover:text-slate-800'
            }`}
          >
            <Calculator className={`h-3.5 w-3.5 flex-shrink-0 ${showingIndices ? 'text-white/90' : 'text-slate-300'}`} />
            <span className="truncate lg:flex-1">Índices calculados</span>
            <span className={`text-[10px] font-bold tabular-nums ${showingIndices ? 'text-white/80' : 'text-slate-400'}`}>
              {indices.length - pendingIndices}/{indices.length}
            </span>
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-x-hidden">
          {showingIndices ? (
            <LabIndicesPanel
              results={indices}
              habitualWeightKg={patient.reference_weights?.habitual?.kg ?? null}
              onGoToPanel={setActivePanel}
              onSaveHabitualWeight={(kg) => void saveHabitualWeight(kg)}
              onSaveThreshold={(key, value) => onSaveAccountRange(key, value === null ? null : { max: value })}
            />
          ) : (
            <>
          <div className="p-4 sm:p-6 lg:p-7">
            <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-5">
              <span className="h-4 w-1 rounded-full bg-brand-500" />
              <h4 className="ng-section-title uppercase tracking-widest">{panel.label}</h4>
              {countPanelOutOfRange(panel, values, sex, accountRanges, entryRanges) > 0 ? (
                <span className="rounded-full bg-red-50 px-2 py-[2px] text-[10px] font-bold text-red-500">
                  {countPanelOutOfRange(panel, values, sex, accountRanges, entryRanges)} fuera de rango
                </span>
              ) : null}
            </div>

            {/* Móvil: filas apiladas. Desktop: tabla. */}
            <div className="space-y-3 sm:hidden">
              {panel.analytes.map((analyte, index) => {
                const { range, source } = resolveRange(analyte, sex, accountRanges, entryRanges);
                const overrideTarget = analyte.refBySex && sex ? `${analyte.key}:${sex}` : analyte.key;
                return (
                  <LabValueRow
                    key={analyte.key}
                    layout="stack"
                    analyte={analyte}
                    value={(values[analyte.key] as number | string | null) ?? null}
                    onChange={(next) => setValue(analyte.key, next)}
                    range={range}
                    source={source}
                    onSaveEntryRange={(next) => setEntryRange(overrideTarget, next)}
                    onSaveAccountRange={(next) => onSaveAccountRange(overrideTarget, next)}
                    inputRef={(element) => { inputRefs.current[index] = element; }}
                    onEnter={() => focusNext(index)}
                  />
                );
              })}
            </div>

            <div className="hidden sm:block">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Análisis</th>
                    <th className="w-[160px] pb-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 md:w-[188px]">Valor</th>
                    <th className="w-[120px] pb-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-400 md:w-[140px]">Rango</th>
                  </tr>
                </thead>
                <tbody>
                  {panel.analytes.map((analyte, index) => {
                    const { range, source } = resolveRange(analyte, sex, accountRanges, entryRanges);
                    const overrideTarget = analyte.refBySex && sex ? `${analyte.key}:${sex}` : analyte.key;
                    return (
                      <LabValueRow
                        key={analyte.key}
                        analyte={analyte}
                        value={(values[analyte.key] as number | string | null) ?? null}
                        onChange={(next) => setValue(analyte.key, next)}
                        range={range}
                        source={source}
                        onSaveEntryRange={(next) => setEntryRange(overrideTarget, next)}
                        onSaveAccountRange={(next) => onSaveAccountRange(overrideTarget, next)}
                        inputRef={(element) => { inputRefs.current[index] = element; }}
                        onEnter={() => focusNext(index)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 bg-[#f7f8ff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-7">
            <p className="text-xs text-slate-400">
              {panel.analytes.length} análisis en este panel. Completa solo los que reporte el laboratorio.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`¿Limpiar todos los valores de ${panel.label}?`)) return;
                setData((current) => {
                  const nextValues = { ...(current.values || {}) };
                  panel.analytes.forEach((analyte) => { delete nextValues[analyte.key]; });
                  return { ...current, values: nextValues };
                });
              }}
              className="ng-btn-ghost self-start hover:border-rose-200 hover:text-rose-500 sm:self-auto"
            >
              <Eraser className="h-3.5 w-3.5" />
              Limpiar panel
            </button>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
