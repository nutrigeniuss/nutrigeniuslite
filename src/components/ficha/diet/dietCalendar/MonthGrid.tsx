import { calcPlanTotals } from '@/lib/diet/weekSummary';
import { parseLocalDate } from '@/lib/weekRange';
import type { DietPlan } from '../patientDietTypes';
import { getCurrentLocale } from '@/lib/formatLocale';

const DIAS_CORTOS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

type MonthGridProps = {
  /** Cualquier día del mes que se quiere pintar. */
  monthAnchor: string;
  plansByDate: Record<string, DietPlan[]>;
  selectedDate: string | null;
  todayStr: string;
  onSelect: (dateStr: string) => void;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Calendario mensual de dietas (única vista en Lite).
 * Elegir un día abre el panel lateral; la impresión semanal usa la semana de ese día.
 */
export default function MonthGrid({
  monthAnchor,
  plansByDate,
  selectedDate,
  todayStr,
  onSelect,
}: MonthGridProps) {
  const anchor = parseLocalDate(monthAnchor) ?? new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

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

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelect(dateStr)}
              aria-pressed={isSelected}
              className={`flex min-h-[58px] flex-col items-center gap-1.5 rounded-[12px] p-2 transition-colors ${
                hasPlan ? 'bg-brand-50 hover:bg-[#e4e9fe]' : 'hover:bg-[#f4f7ff]'
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
    </div>
  );
}
