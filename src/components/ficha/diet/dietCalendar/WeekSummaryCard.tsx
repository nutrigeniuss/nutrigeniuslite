import { CalendarRange } from 'lucide-react';
import type { WeekSummary } from '@/lib/diet/weekSummary';
import MacroDonut, { MacroLegend } from './MacroDonut';
import { getCurrentLocale } from '@/lib/formatLocale';

type WeekSummaryCardProps = {
  summary: WeekSummary | null;
  /** Objetivo calórico de la ficha del paciente, si lo tiene registrado. */
  targetCalories?: number | null;
};

const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/**
 * Resumen de la semana.
 *
 * Dos decisiones que no son de estilo:
 *
 *  - Sin dietas NO se pinta un cero. Cero kilocalorías es un dato falso;
 *    «no hay dietas» es ausencia de dato. En una pantalla clínica no pueden
 *    verse igual, así que `summary` llega en null y se muestra otro estado.
 *
 *  - El promedio va SIEMPRE acompañado de su denominador. Un «1 695 kcal/día»
 *    suelto no dice si son siete días o dos, y de ahí a compararlo mal con el
 *    objetivo hay un paso.
 */
export default function WeekSummaryCard({ summary, targetCalories }: WeekSummaryCardProps) {
  if (!summary) {
    return (
      <div className="rounded-[16px] border border-[#e6eaf4] bg-white px-5 py-10 text-center sm:px-6">
        <CalendarRange className="mx-auto mb-2.5 h-7 w-7 text-slate-200" />
        <p className="text-sm font-semibold text-slate-500">Sin dietas esta semana</p>
        <p className="mt-1 text-xs text-slate-400">
          Agrega una dieta a cualquier día y aquí verás el promedio.
        </p>
      </div>
    );
  }

  const { average, daysWithPlan } = summary;

  // Diferencia con el objetivo del paciente. Si no tiene objetivo registrado no
  // se inventa uno por defecto: se omite la línea. Un objetivo falso llevaría a
  // ajustar la dieta contra un número que nadie calculó.
  const hasTarget = typeof targetCalories === 'number' && targetCalories > 0;
  const delta = hasTarget ? average.cal - (targetCalories as number) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-[16px] border border-[#e6eaf4] bg-white p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">Resumen de la semana</p>

      <div className="flex items-center gap-4">
        <MacroDonut totals={average} size={104} unitLabel="KCAL / DÍA" />
        <MacroLegend totals={average} long />
      </div>

      <p className="rounded-[9px] bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-slate-500">
        Promedio de {daysWithPlan === 1 ? 'el' : 'los'}{' '}
        <b className="font-bold text-slate-700">
          {daysWithPlan} {daysWithPlan === 1 ? 'día con dieta' : 'días con dieta'}
        </b>
        . Los días sin dieta no entran en el cálculo.
      </p>

      {hasTarget ? (
        <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
          <span className="flex-1 text-[12.5px] text-slate-600">Objetivo del paciente</span>
          <span className="text-[13px] font-bold tabular-nums text-slate-800">
            {(targetCalories as number).toLocaleString(getCurrentLocale())} kcal
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums ${
              Math.abs(delta) <= 50
                ? 'bg-[#ecfaed] text-energy-600'
                : 'bg-[#fdf3e3] text-[#b45309]'
            }`}
          >
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta).toLocaleString(getCurrentLocale())} kcal
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Nombre del día de la semana por índice (0 = lunes). Compartido con el panel. */
export const nombreDiaSemana = (index: number): string => NOMBRES_DIA[index] ?? '';
