import { CalendarRange } from 'lucide-react';
import { calcPlanTotals } from '@/lib/diet/weekSummary';
import { formatWeekRange, parseLocalDate, weekRangeOf } from '@/lib/weekRange';
import type { DietPlan } from '../patientDietTypes';
import { getCurrentLocale } from '@/lib/formatLocale';

const DIAS_CORTOS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

type MonthGridProps = {
  /** Cualquier día del mes que se quiere pintar. */
  monthAnchor: string;
  plansByDate: Record<string, DietPlan[]>;
  selectedDate: string | null;
  todayStr: string;
  /** Días de la semana que se está viendo en la vista semanal. */
  visibleWeekDays: readonly string[];
  onSelect: (dateStr: string) => void;
  /** Salta a la semana del día elegido — el papel real de esta vista. */
  onGoToWeek: (dateStr: string) => void;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * El mes, SIN REJILLA. Cuarenta y dos casillas con borde convierten un
 * calendario en una hoja de cálculo: aquí la cuadrícula la hace la alineación
 * y lo único con fondo son los días que tienen dieta, así que «dónde hay
 * dietas» se lee de un golpe.
 *
 * Esta vista NO es una segunda mesa de trabajo: es el mapa. Sirve para ver
 * cuánto del mes está planificado y para saltar a una semana lejana sin pulsar
 * la flecha ocho veces. Por eso al elegir un día aparece la banda de abajo con
 * el botón que lleva a su semana, en vez de duplicar aquí las acciones.
 */
export default function MonthGrid({
  monthAnchor,
  plansByDate,
  selectedDate,
  todayStr,
  visibleWeekDays,
  onSelect,
  onGoToWeek,
}: MonthGridProps) {
  const anchor = parseLocalDate(monthAnchor) ?? new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0 = domingo. Como la semana empieza en lunes, el hueco inicial es
  // (getDay + 6) % 7 — si no, todos los meses saldrían corridos un día.
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

  const semanaVisible = new Set(visibleWeekDays);
  const selectedWeekLabel = selectedDate ? formatWeekRange(weekRangeOf(selectedDate)) : '';

  return (
    <div className="rounded-[14px] border border-[#e6eaf4] bg-white">
      <div className="grid grid-cols-7 px-3 pb-0.5 pt-1">
        {DIAS_CORTOS.map((dia) => (
          <span key={dia} className="py-1.5 text-center text-[10px] font-bold tracking-[0.1em] text-slate-300">
            {dia}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 px-3 pb-3.5">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <div key={`hueco-${index}`} className="min-h-[58px]" />
        ))}

        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
          const plans = plansByDate[dateStr] || [];
          const hasPlan = plans.length > 0;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const enSemanaVisible = semanaVisible.has(dateStr);

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelect(dateStr)}
              aria-pressed={isSelected}
              className={`flex min-h-[58px] flex-col items-center gap-1.5 rounded-[12px] p-2 transition-colors ${
                hasPlan ? 'bg-brand-50 hover:bg-[#e4e9fe]' : enSemanaVisible ? 'bg-[#f4f7ff]' : 'hover:bg-[#f4f7ff]'
              } ${isSelected ? 'ring-[1.5px] ring-inset ring-brand-500' : ''}`}
            >
              <span
                className={`text-[13.5px] font-semibold leading-tight tabular-nums ${
                  hasPlan || isToday ? 'font-bold text-brand-500' : 'text-slate-400'
                }`}
              >
                {day}
                {isToday ? <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-brand-500" /> : null}
              </span>

              {hasPlan ? (
                <span className="whitespace-nowrap rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-brand-500">
                  {calcPlanTotals(plans[0]).cal.toLocaleString(getCurrentLocale())}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selectedDate ? (
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-brand-500/20 bg-[#f4f7ff] px-3 py-2.5 text-[12.5px] text-slate-600">
          <CalendarRange className="h-4 w-4 flex-shrink-0 text-brand-500" />
          <span className="min-w-0">
            Semana del <b className="font-bold text-slate-800">{selectedWeekLabel}</b>
          </span>
          <button
            type="button"
            onClick={() => onGoToWeek(selectedDate)}
            className="ml-auto flex-shrink-0 rounded-lg border border-brand-500/25 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-50"
          >
            Ver esa semana
          </button>
        </div>
      ) : null}
    </div>
  );
}
