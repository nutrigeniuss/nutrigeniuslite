import { useMemo } from 'react';
import {
  activePregnancy,
  type PregnancyRecord,
  type PregnancyType,
} from '@/lib/gestation/gestationalGain';
import { ageInMonths } from '@/lib/anthropometry/pediatric';

type PatientLike = {
  full_name?: string | null;
  gender?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  pregnancies?: PregnancyRecord[] | null;
};

type PatientDatosPanelProps = {
  patient: PatientLike;
  measurementDate?: string | null;
  onPatientChange: (patch: Partial<PatientLike>) => void;
  onMeasurementDateChange: (date: string) => void;
};

function num(raw: string): number | null {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function PatientDatosPanel({
  patient,
  measurementDate,
  onPatientChange,
  onMeasurementDateChange,
}: PatientDatosPanelProps) {
  const sex = patient.gender || patient.sex || 'Femenino';
  const months = ageInMonths(patient.birth_date, measurementDate || undefined);
  const canBePregnant = sex === 'Femenino' && months != null && months >= 10 * 12;
  const pregnancy = activePregnancy(patient.pregnancies);
  const isPregnant = Boolean(canBePregnant && pregnancy);

  const origen: 'fum' | 'eco' = pregnancy?.ultrasound?.onDate ? 'eco' : 'fum';
  const type: PregnancyType = pregnancy?.type === 'twin' ? 'twin' : 'single';

  const setPregnancy = (next: PregnancyRecord | null) => {
    onPatientChange({ pregnancies: next ? [next] : [] });
  };

  const patchPregnancy = (partial: Partial<PregnancyRecord>, nextOrigen?: 'fum' | 'eco') => {
    const next: PregnancyRecord = {
      id: pregnancy?.id || 'session-pregnancy',
      status: 'active',
      type,
      prePregnancyKg: pregnancy?.prePregnancyKg ?? null,
      fum: pregnancy?.fum ?? null,
      ultrasound: pregnancy?.ultrasound ?? null,
      ...partial,
    };
    if (nextOrigen === 'fum') next.ultrasound = null;
    if (nextOrigen === 'eco') next.fum = null;
    setPregnancy(next);
  };

  const ecoWeeks = pregnancy?.ultrasound?.weeks ?? '';
  const ecoDate = pregnancy?.ultrasound?.onDate ?? '';

  const ageLabel = useMemo(() => {
    if (months == null) return null;
    const y = Math.floor(months / 12);
    const m = Math.floor(months % 12);
    if (y <= 0) return `${Math.floor(months)} mes${Math.floor(months) === 1 ? '' : 'es'}`;
    return m > 0 ? `${y} a ${m} m` : `${y} años`;
  }, [months]);

  return (
    <div className="ng-inset space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="ng-label sm:col-span-2">
          Nombre
          <input
            className="ng-input"
            value={patient.full_name || ''}
            onChange={(e) => onPatientChange({ full_name: e.target.value })}
            placeholder="Consulta rápida"
          />
        </label>

        <label className="ng-label">
          Sexo
          <select
            className="ng-input"
            value={sex}
            onChange={(e) => {
              const gender = e.target.value;
              const patch: Partial<PatientLike> = { gender, sex: gender };
              if (gender !== 'Femenino') patch.pregnancies = [];
              onPatientChange(patch);
            }}
          >
            <option>Femenino</option>
            <option>Masculino</option>
          </select>
        </label>

        <label className="ng-label">
          Fecha de nacimiento
          <input
            type="date"
            className="ng-input"
            value={patient.birth_date || ''}
            onChange={(e) => onPatientChange({ birth_date: e.target.value || null })}
          />
        </label>

        <label className="ng-label sm:col-span-2">
          Fecha de evaluación
          <input
            type="date"
            className="ng-input"
            value={measurementDate || ''}
            onChange={(e) => onMeasurementDateChange(e.target.value)}
          />
        </label>
      </div>

      {ageLabel ? <p className="ng-muted">Edad: {ageLabel}</p> : null}

      {canBePregnant ? (
        <div className="rounded-2xl border border-slate-200/80 bg-[#fafbfd] p-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={isPregnant}
              onChange={(e) => {
                if (!e.target.checked) {
                  setPregnancy(null);
                  return;
                }
                setPregnancy({
                  id: 'session-pregnancy',
                  status: 'active',
                  type: 'single',
                  prePregnancyKg: null,
                  fum: null,
                  ultrasound: null,
                });
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand-500"
            />
            Gestante
          </label>

          {isPregnant ? (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['fum', 'Por FUM'],
                  ['eco', 'Por ecografía'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => patchPregnancy({}, key)}
                    className={`h-9 rounded-xl border text-xs font-semibold transition ${
                      origen === key ? 'ng-pill-active border-transparent' : 'ng-pill-idle border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {origen === 'fum' ? (
                <label className="ng-label">
                  Última menstruación
                  <input
                    type="date"
                    className="ng-input"
                    value={pregnancy?.fum || ''}
                    onChange={(e) => patchPregnancy({ fum: e.target.value || null, ultrasound: null })}
                  />
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="ng-label">
                    Semanas por eco
                    <input
                      type="number"
                      min={0}
                      max={42}
                      className="ng-input"
                      value={ecoWeeks}
                      onChange={(e) => {
                        const weeks = num(e.target.value);
                        patchPregnancy({
                          fum: null,
                          ultrasound: weeks == null
                            ? null
                            : { weeks, days: 0, onDate: ecoDate || (measurementDate || new Date().toISOString().slice(0, 10)) },
                        });
                      }}
                    />
                  </label>
                  <label className="ng-label">
                    Fecha de la eco
                    <input
                      type="date"
                      className="ng-input"
                      value={ecoDate}
                      onChange={(e) => {
                        const onDate = e.target.value;
                        const weeks = pregnancy?.ultrasound?.weeks ?? null;
                        patchPregnancy({
                          fum: null,
                          ultrasound: onDate && weeks != null ? { weeks, days: 0, onDate } : null,
                        });
                      }}
                    />
                  </label>
                </div>
              )}

              <label className="ng-label">
                Peso pregestacional
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    className="ng-input pr-10"
                    value={pregnancy?.prePregnancyKg ?? ''}
                    onChange={(e) => patchPregnancy({ prePregnancyKg: num(e.target.value) })}
                  />
                  <span className="pointer-events-none absolute right-3 top-[calc(50%+0.125rem)] -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={type === 'twin'}
                  onChange={(e) => patchPregnancy({ type: e.target.checked ? 'twin' : 'single' })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-500"
                />
                Gestación múltiple
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
