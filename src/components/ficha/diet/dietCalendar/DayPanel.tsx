import { Link } from 'react-router-dom';
import { Copy, FileText, Pencil, Trash2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { calcPlanTotals, mealCountLabel } from '@/lib/diet/weekSummary';
import { formatDayTitle, formatDayWithMonth, formatLongDate } from '@/lib/weekRange';
import type { DietPlan } from '../patientDietTypes';
import MacroDonut, { MacroLegend } from './MacroDonut';
import { getCurrentLocale } from '@/lib/formatLocale';

export type CopyCandidate = {
  planId: string;
  date: string;
  plan: DietPlan;
};

type DayPanelProps = {
  dateStr: string | null;
  plans: DietPlan[];
  todayStr: string;
  patientParam: string;
  copyCandidates: CopyCandidate[];
  onCreateFromScratch: (date: string) => void;
  onCopyFrom: (planId: string) => void;
  onOpenAllDiets: () => void;
  onDeletePlan: (plan: DietPlan) => void;
};

const ATAJOS_COPIA = 3;

/** Panel del día (Lite: sin catálogo de dietas). */
export default function DayPanel({
  dateStr,
  plans,
  todayStr,
  patientParam,
  copyCandidates,
  onCreateFromScratch,
  onCopyFrom,
  onOpenAllDiets,
  onDeletePlan,
}: DayPanelProps) {
  if (!dateStr) {
    return (
      <div className="rounded-[16px] border border-[#e6eaf4] bg-white px-5 py-8 text-center sm:px-6">
        <p className="text-sm text-slate-400">Selecciona un día para ver o crear una dieta</p>
      </div>
    );
  }

  const plan = plans[0] ?? null;
  const hasPlan = plans.length > 0;
  const isToday = dateStr === todayStr;
  const atajos = copyCandidates.slice(0, ATAJOS_COPIA);

  return (
    <div className="overflow-hidden rounded-[16px] border border-[#e6eaf4] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e6eaf4] px-5 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-base font-bold leading-tight tracking-tight text-slate-900">{formatDayTitle(dateStr)}</p>
          <p className="mt-0.5 text-[11.5px] text-slate-400">
            {formatLongDate(dateStr)}{isToday ? ' · hoy' : ''}
          </p>
        </div>
        {hasPlan ? (
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[#ecfaed] px-2.5 py-1 text-[11px] font-bold text-energy-600">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Con dieta
          </span>
        ) : (
          <span className="inline-flex flex-shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
            Sin dieta
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3.5 p-5">
        {hasPlan && plan ? (
          <>
            <div className="flex items-center gap-4">
              <MacroDonut totals={calcPlanTotals(plan)} size={92} unitLabel="KCAL" />
              <MacroLegend totals={calcPlanTotals(plan)} />
            </div>

            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Comidas del día</p>
              <div className="flex flex-col">
                {(plan.meals || []).map((meal, index) => {
                  const mealCal = (meal.items || []).reduce(
                    (sum, item) => sum + (item.calories || 0) * (item.quantity || 1),
                    0,
                  );
                  const detalle = (meal.items || []).map((item) => item.name).filter(Boolean).join(', ');

                  return (
                    <div
                      key={meal.id || `${meal.name || 'comida'}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-t border-slate-50 py-2"
                    >
                      <span className="min-w-0">
                        <span className="text-[13px] font-semibold text-slate-800">{meal.name || 'Comida'}</span>
                        {detalle ? <span className="ml-1.5 text-[11.5px] text-slate-400">{detalle}</span> : null}
                      </span>
                      <span className="whitespace-nowrap text-[12px] font-bold tabular-nums text-slate-500">
                        {Math.round(mealCal).toLocaleString(getCurrentLocale())} kcal
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <Link
                to={createPageUrl(`DietCreator?planId=${plan.id}&${patientParam}`)}
                className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-brand-500 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(59,95,235,0.3)] transition-colors hover:bg-[#2843c9]"
              >
                <Pencil className="h-4 w-4" />
                Abrir dieta
              </Link>
              <button
                type="button"
                onClick={() => onDeletePlan(plan)}
                aria-label="Eliminar la dieta de este día"
                title="Eliminar la dieta de este día"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] border border-[#e6eaf4] text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onCreateFromScratch(dateStr)}
              className="flex w-full items-center gap-3 rounded-[12px] border border-brand-500/30 bg-brand-50 p-3 text-left transition-colors hover:bg-[#e4e9fe]"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-brand-500 text-white">
                <FileText className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-[13.5px] font-semibold leading-tight text-slate-800">Agregar dieta</span>
                <span className="block text-[11.5px] text-slate-500">Comenzar desde cero</span>
              </span>
            </button>

            {atajos.length > 0 ? (
              <>
                <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  O copia una de estos días
                  <span className="h-px flex-1 bg-[#e6eaf4]" />
                </div>

                <div className="flex flex-col gap-1.5">
                  {atajos.map((candidate) => (
                    <div
                      key={candidate.planId}
                      className="flex items-center gap-2.5 rounded-[11px] border border-[#e6eaf4] px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold leading-tight text-slate-800">
                          {formatDayWithMonth(candidate.date)}
                        </span>
                        <span className="block text-[11.5px] tabular-nums text-slate-400">
                          {calcPlanTotals(candidate.plan).cal.toLocaleString(getCurrentLocale())} kcal · {mealCountLabel(candidate.plan)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onCopyFrom(candidate.planId)}
                        className="flex-shrink-0 rounded-lg border border-brand-500/25 px-3 py-1.5 text-[12px] font-semibold text-brand-500 transition-colors hover:bg-brand-50"
                      >
                        Copiar
                      </button>
                    </div>
                  ))}
                </div>

                {copyCandidates.length > atajos.length ? (
                  <button
                    type="button"
                    onClick={onOpenAllDiets}
                    className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#e6eaf4] py-2 text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Ver todas las dietas ({copyCandidates.length})
                  </button>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
