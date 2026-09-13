import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Ruler, Scale, Sparkles, UserRound } from 'lucide-react';
import {
  ageInMonths,
  formatAgeFromDates,
  hasDownSyndrome,
  isPediatricPatient,
} from '@/lib/anthropometry/pediatric';
import {
  activePregnancy,
  type PregnancyRecord,
  type PregnancyType,
} from '@/lib/gestation/gestationalGain';
import { todayLocalDateStr } from '@/lib/weekRange';

type MeasurementLike = {
  date?: string | null;
  weight?: number | null;
  height?: number | null;
};

type PatientLike = {
  full_name?: string | null;
  gender?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  pregnancies?: PregnancyRecord[] | null;
  health_conditions?: { current_pathologies?: string[] };
};

type Props = {
  patient: PatientLike;
  measurement: MeasurementLike;
  onPatientChange: (patch: Partial<PatientLike>) => void;
  onMeasurementChange: (patch: Partial<MeasurementLike>) => void;
};

function formatAgeChip(birthDate: string | null | undefined, onDate: string | null | undefined): string {
  const exact = formatAgeFromDates(birthDate, onDate);
  if (exact) {
    // Chip corto: "6 a 7 m" (el panel pediátrico sigue mostrando años/meses/días).
    const months = ageInMonths(birthDate, onDate || undefined);
    if (months == null) return exact;
    const y = Math.floor(months / 12);
    const m = Math.floor(months % 12);
    if (y <= 0) return `${Math.floor(months)} m`;
    return m > 0 ? `${y} a ${m} m` : `${y} a`;
  }
  return '—';
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(`${iso}T12:00:00`);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

function num(raw: string): number | null {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pathologyList(raw: string[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

/**
 * Cabecera de ficha compartida.
 * En móvil: resumen compacto colapsable; editar abre el formulario.
 * Incluye gestante y síndrome de Down (antes en PatientDatosPanel).
 */
export default function FichaContextBar({
  patient,
  measurement,
  onPatientChange,
  onMeasurementChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [chipsOpen, setChipsOpen] = useState(false);
  const sex = patient.gender || patient.sex || 'Femenino';
  const months = ageInMonths(patient.birth_date, measurement.date || undefined);
  const age = useMemo(
    () => formatAgeChip(patient.birth_date, measurement.date),
    [patient.birth_date, measurement.date],
  );
  const evalBeforeBirth = Boolean(
    patient.birth_date
    && measurement.date
    && measurement.date < patient.birth_date,
  );

  const canBePregnant = sex === 'Femenino' && months != null && months >= 10 * 12;
  const pregnancy = activePregnancy(patient.pregnancies);
  const isPregnant = Boolean(canBePregnant && pregnancy);
  const origen: 'fum' | 'eco' = pregnancy?.ultrasound?.onDate ? 'eco' : 'fum';
  const type: PregnancyType = pregnancy?.type === 'twin' ? 'twin' : 'single';
  const ecoWeeks = pregnancy?.ultrasound?.weeks ?? '';
  const ecoDate = pregnancy?.ultrasound?.onDate ?? '';

  const showDown = isPediatricPatient(months, patient.health_conditions?.current_pathologies)
    || hasDownSyndrome(patient.health_conditions?.current_pathologies)
    || (months == null && Boolean(patient.birth_date));
  const isDown = hasDownSyndrome(patient.health_conditions?.current_pathologies);

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

  const setDown = (checked: boolean) => {
    const list = pathologyList(patient.health_conditions?.current_pathologies);
    const without = list.filter((p) => !/down|trisom/i.test(p));
    onPatientChange({
      health_conditions: {
        ...patient.health_conditions,
        current_pathologies: checked ? [...without, 'Síndrome de Down'] : without,
      },
    });
  };

  const chips = [
    { label: 'Edad', value: age, icon: <UserRound className="h-3.5 w-3.5" /> },
    { label: 'Sexo', value: sex || '—', icon: <Sparkles className="h-3.5 w-3.5" /> },
    {
      label: 'Peso',
      value: measurement.weight != null ? `${measurement.weight} kg` : '—',
      icon: <Scale className="h-3.5 w-3.5" />,
    },
    {
      label: 'Talla',
      value: measurement.height != null ? `${measurement.height} cm` : '—',
      icon: <Ruler className="h-3.5 w-3.5" />,
    },
    {
      label: 'Evaluación',
      value: formatDateLabel(measurement.date),
      icon: <CalendarDays className="h-3.5 w-3.5" />,
    },
  ];

  const mobileSummary = [
    age,
    sex === 'Masculino' ? 'M' : sex === 'Femenino' ? 'F' : sex,
    measurement.weight != null ? `${measurement.weight} kg` : null,
    measurement.height != null ? `${measurement.height} cm` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="ng-card-soft mb-4">
      {/* Móvil: una línea + expandir chips */}
      <div className="flex min-h-12 items-center gap-2 px-3 py-2.5 sm:hidden">
        <button
          type="button"
          onClick={() => setChipsOpen((v) => !v)}
          className="min-h-11 min-w-0 flex-1 touch-manipulation text-left"
          aria-expanded={chipsOpen}
        >
          <p className="truncate text-[13px] font-semibold tabular-nums text-slate-800">
            {mobileSummary || 'Sin datos de contexto'}
          </p>
          <p className="text-[10px] font-medium text-slate-400">
            {chipsOpen ? 'Ocultar detalle' : 'Ver edad · sexo · peso · talla'}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-11 shrink-0 touch-manipulation items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 px-4 text-xs font-bold text-white shadow-[0_8px_18px_rgba(59,95,235,0.28)]"
          aria-expanded={open}
        >
          {open ? 'Cerrar' : 'Editar'}
        </button>
      </div>

      {chipsOpen ? (
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2.5 sm:hidden">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200/80"
            >
              <span className="text-brand-500">{chip.icon}</span>
              <span className="text-slate-400">{chip.label}</span>
              <span className="tabular-nums text-slate-800">{chip.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Desktop / tablet: chips siempre visibles */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hidden w-full items-center gap-3 px-3.5 py-3 text-left sm:flex sm:px-4"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200/80"
            >
              <span className="text-brand-500">{chip.icon}</span>
              <span className="text-slate-400">{chip.label}</span>
              <span className="tabular-nums text-slate-800">{chip.value}</span>
            </span>
          ))}
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-brand-500">
          {open ? 'Cerrar' : 'Editar'}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 bg-[#fafbfd] px-3.5 py-3.5 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[11px] font-semibold text-slate-500 sm:col-span-2 lg:col-span-1">
              Nombre
              <input
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={patient.full_name || ''}
                onChange={(e) => onPatientChange({ full_name: e.target.value })}
                placeholder="Consulta rápida"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Sexo
              <select
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={sex}
                onChange={(e) => {
                  const gender = e.target.value;
                  const patch: Partial<PatientLike> = { gender, sex: gender };
                  if (gender !== 'Femenino') patch.pregnancies = [];
                  onPatientChange(patch);
                }}
              >
                <option value="Femenino">Femenino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-slate-500">
              Fecha de nacimiento
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={patient.birth_date || ''}
                onChange={(e) => onPatientChange({ birth_date: e.target.value || null })}
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-500 sm:col-span-2 lg:col-span-1">
              Fecha de evaluación
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={measurement.date || ''}
                min={patient.birth_date || undefined}
                onChange={(e) => onMeasurementChange({ date: e.target.value || null })}
              />
              {evalBeforeBirth ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">
                  La evaluación no puede ser anterior al nacimiento. Corrige el año (p. ej. {todayLocalDateStr().slice(0, 4)}).
                </p>
              ) : null}
            </label>
          </div>

          {showDown ? (
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={isDown}
                onChange={(e) => setDown(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-500"
              />
              Síndrome de Down · Zemel (2015)
            </label>
          ) : null}

          {canBePregnant ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
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
                          origen === key
                            ? 'border-transparent bg-brand-500 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {origen === 'fum' ? (
                    <label className="text-[11px] font-semibold text-slate-500">
                      Última menstruación
                      <input
                        type="date"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        value={pregnancy?.fum || ''}
                        onChange={(e) => patchPregnancy({ fum: e.target.value || null, ultrasound: null })}
                      />
                    </label>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[11px] font-semibold text-slate-500">
                        Semanas por eco
                        <input
                          type="number"
                          min={0}
                          max={42}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                          value={ecoWeeks}
                          onChange={(e) => {
                            const weeks = num(e.target.value);
                            patchPregnancy({
                              fum: null,
                              ultrasound: weeks == null
                                ? null
                                : {
                                    weeks,
                                    days: 0,
                                    onDate: ecoDate || (measurement.date || todayLocalDateStr()),
                                  },
                            });
                          }}
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-500">
                        Fecha de la eco
                        <input
                          type="date"
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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

                  <label className="text-[11px] font-semibold text-slate-500">
                    Peso pregestacional
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        value={pregnancy?.prePregnancyKg ?? ''}
                        onChange={(e) => patchPregnancy({ prePregnancyKg: num(e.target.value) })}
                      />
                      <span className="pointer-events-none absolute right-3 top-[calc(50%+0.35rem)] -translate-y-1/2 text-xs font-semibold text-slate-400">kg</span>
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
      ) : null}
    </div>
  );
}
