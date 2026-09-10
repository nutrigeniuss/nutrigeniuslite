import { Plus } from 'lucide-react';
import { calcPlanTotals, describeMeals } from '@/lib/diet/weekSummary';
import { formatDayWithMonth, parseLocalDate } from '@/lib/weekRange';
import type { DietPlan } from '../patientDietTypes';
import { MacroBar } from './MacroDonut';
import { getCurrentLocale } from '@/lib/formatLocale';

const DIAS_CORTOS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

type WeekStripProps = {
  /** Los siete días de la semana, de lunes a domingo, en 'YYYY-MM-DD'. */
  days: readonly string[];
  plansByDate: Record<string, DietPlan[]>;
  selectedDate: string | null;
  todayStr: string;
  onSelect: (dateStr: string) => void;
  /** Crear una dieta directamente desde el hueco de un día vacío. */
  onAdd: (dateStr: string) => void;
};

/**
 * La semana a lo ancho. Cada día enseña sus calorías, su reparto de macros y
 * qué comidas tiene; los días sin dieta muestran el botón de agregar.
 *
 * El hueco ES el botón a propósito: en el calendario de mes había que buscar
 * los días vacíos, y aquí piden que los llenes sin que nadie los busque.
 */
export default function WeekStrip({ days, plansByDate, selectedDate, todayStr, onSelect, onAdd }: WeekStripProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
      {days.map((dateStr, index) => {
        const plans = plansByDate[dateStr] || [];
        const plan = plans[0] ?? null;
        const hasPlan = plans.length > 0;
        const totals = hasPlan ? calcPlanTotals(plan) : null;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedDate;
        const dayNumber = parseLocalDate(dateStr)?.getDate() ?? '';

        return (
          // La tarjeta selecciona el día y el «Agregar» de dentro crea la
          // dieta. Son dos acciones distintas, así que el «Agregar» tiene que
          // ser un botón de verdad: como <span> dentro de la tarjeta, decía
          // «Agregar» y lo único que hacía era seleccionar.
          //
          // Va en un div con role/tabIndex en vez de un <button> porque un
          // botón dentro de otro botón es HTML inválido y el navegador no
          // entrega el clic del de dentro.
          <div
            key={dateStr}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => onSelect(dateStr)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(dateStr);
              }
            }}
            className={`flex min-h-[176px] cursor-pointer flex-col gap-2.5 rounded-[14px] border bg-white p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isSelected ? 'border-brand-500 ring-1 ring-brand-500' : 'border-[#e6eaf4] hover:border-[#c9d3f7]'
            }`}
          >
            <div>
              <p className={`text-[9.5px] font-bold tracking-[0.09em] ${isToday ? 'text-brand-500' : 'text-slate-400'}`}>
                {DIAS_CORTOS[index]}{isToday ? ' · HOY' : ''}
              </p>
              <p className={`text-[19px] font-bold leading-none tracking-tight tabular-nums ${isToday ? 'text-brand-500' : 'text-slate-900'}`}>
                {dayNumber}
              </p>
            </div>

            {hasPlan && totals ? (
              <>
                <p className="text-[12.5px] font-bold tabular-nums text-slate-800">
                  {totals.cal.toLocaleString(getCurrentLocale())} kcal
                </p>
                <MacroBar totals={totals} />
                <p className="text-[10.5px] leading-snug text-slate-400">{describeMeals(plan, 4)}</p>
                {/* Más de una dieta el mismo día: se avisa, porque las tarjetas
                    solo muestran la primera. */}
                {plans.length > 1 ? (
                  <p className="text-[10px] font-semibold text-slate-400">+{plans.length - 1} dieta más</p>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  // Sin esto, el clic burbujea a la tarjeta y lo único que
                  // pasaría es que el día quedaría seleccionado.
                  event.stopPropagation();
                  onAdd(dateStr);
                }}
                aria-label={`Agregar dieta al ${formatDayWithMonth(dateStr).toLowerCase()}`}
                className={`mt-auto flex items-center justify-center gap-1.5 rounded-[9px] border border-dashed py-2 text-[11.5px] font-semibold transition-colors ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/5 text-brand-500'
                    : 'border-slate-300 text-slate-400 hover:border-brand-500 hover:text-brand-500'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
