import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Ruler, Scale, Sparkles, UserRound } from 'lucide-react';
import { ageInMonths } from '@/lib/anthropometry/pediatric';

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
};

type Props = {
  patient: PatientLike;
  measurement: MeasurementLike;
  onPatientChange: (patch: Partial<PatientLike>) => void;
  onMeasurementChange: (patch: Partial<MeasurementLike>) => void;
};

function formatAge(birthDate: string | null | undefined, onDate: string | null | undefined): string {
  const months = ageInMonths(birthDate, onDate || undefined);
  if (months == null) return '—';
  const y = Math.floor(months / 12);
  const m = Math.floor(months % 12);
  if (y <= 0) return `${Math.floor(months)} m`;
  return m > 0 ? `${y} a ${m} m` : `${y} a`;
}

function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(`${iso}T12:00:00`);
  if (Number.isNaN(ms)) return iso;
  return new Date(ms).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Cabecera de ficha compartida (Lite calculadora).
 * Visible en todas las pestañas; editable; misma fuente que Antro/Calorías/Dieta.
 */
export default function FichaContextBar({
  patient,
  measurement,
  onPatientChange,
  onMeasurementChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const sex = patient.gender || patient.sex || 'Femenino';
  const age = useMemo(
    () => formatAge(patient.birth_date, measurement.date),
    [patient.birth_date, measurement.date],
  );

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

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left sm:px-4"
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
        <div className="grid gap-3 border-t border-slate-100 bg-[#fafbfd] px-3.5 py-3.5 sm:grid-cols-2 sm:px-4 lg:grid-cols-3">
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
              onChange={(e) => onPatientChange({ gender: e.target.value, sex: e.target.value })}
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
          <label className="text-[11px] font-semibold text-slate-500">
            Fecha de evaluación
            <input
              type="date"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              value={measurement.date || ''}
              onChange={(e) => onMeasurementChange({ date: e.target.value || null })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
