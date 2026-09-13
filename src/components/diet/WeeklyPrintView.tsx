import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DietMeal, DietPlan } from '@/components/ficha/diet/patientDietTypes';
import BackLink from '@/components/ui/back-link';
import { formatWeekRange, shiftWeek, todayLocalDateStr, weekRangeOf } from '@/lib/weekRange';
import { publicSiteLabel } from '@/lib/publicSite';
import { getCurrentLocale } from '@/lib/formatLocale';

type MealItemsProps = {
  meal?: DietMeal | null;
};

type DayColumnProps = {
  dateStr: string;
  plans: DietPlan[];
  dayLabel: string;
};

type WeeklyPrintViewProps = {
  dietPlans: DietPlan[];
  patientName?: string;
  weekStartDate?: string;
  onClose: () => void;
  brandLogoUrl?: string | null;
  brandName?: string | null;
};

type WeekDayPlan = {
  dateStr: string;
  label: string;
  plans: DietPlan[];
};

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

function MealItems({ meal }: MealItemsProps) {
  if (!meal || !meal.items || meal.items.length === 0) return null;

  return (
    <div className="mb-2">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-500">{meal.name}</p>
      {meal.items.map((item, index) => {
        const qty = item.quantity != null ? String(item.quantity) : '';
        const unit = (item.unit || '').trim();
        const amount = qty && unit ? `${qty} ${unit}` : qty || unit;
        return (
          <p key={item.id || `${item.name || 'item'}-${index}`} className="text-[10px] leading-snug text-slate-600">
            {item.name}
            {amount ? `, ${amount}` : ''}
          </p>
        );
      })}
      {meal.notes ? <p className="mt-0.5 text-[9px] italic text-slate-400">{meal.notes}</p> : null}
    </div>
  );
}

function DayColumn({ dateStr, plans, dayLabel }: DayColumnProps) {
  const allMeals = plans.flatMap((plan) => plan.meals || []);
  const totalCal = allMeals.reduce(
    (mealSum, meal) => mealSum + (meal.items || []).reduce((itemSum, item) => itemSum + (item.calories || 0) * (item.quantity || 1), 0),
    0,
  );

  return (
    <div className="weekly-day-col min-h-full border-r border-slate-200 px-1.5 py-2 last:border-r-0">
      <div className="mb-2 border-b border-[#c7d3fd] pb-1 text-center">
        <p className="text-[11px] font-bold text-slate-700">{dayLabel}</p>
        <p className="text-[9px] text-slate-400">{dateStr.slice(8)}/{dateStr.slice(5, 7)}</p>
        {totalCal > 0 ? <p className="mt-0.5 text-[9px] font-semibold text-brand-500">{Math.round(totalCal)} kcal</p> : null}
      </div>

      {plans.length === 0 ? (
        <p className="text-center text-[9px] italic text-slate-300">Sin dieta</p>
      ) : (
        allMeals.map((meal, index) => <MealItems key={meal.id || `${meal.name || 'meal'}-${index}`} meal={meal} />)
      )}
    </div>
  );
}

export default function WeeklyPrintView({
  dietPlans,
  patientName,
  weekStartDate,
  onClose,
  brandLogoUrl,
  brandName,
}: WeeklyPrintViewProps) {
  const handlePrint = (): void => {
    window.print();
  };

  const [anchorDate, setAnchorDate] = useState<string>(weekStartDate || todayLocalDateStr());
  const week = weekRangeOf(anchorDate);

  const days: WeekDayPlan[] = week.days.map((dateStr, index) => ({
    dateStr,
    label: DAY_NAMES[index],
    plans: dietPlans.filter((plan) => plan.date === dateStr),
  }));

  const daysWithPlan = days.filter((day) => day.plans.length > 0).length;
  const weekLabel = formatWeekRange(week);
  const patientBadge = patientName?.split(' ').slice(0, 2).join(' ') || 'Paciente';

  return createPortal(
    <>
      <style>{`
        /* Misma idea que DietPrintView: portal a body + excluir el overlay
           del body > * { display:none }. Si no, #root se oculta y el PDF sale en blanco. */
        @media print {
          body > *:not(.weekly-print-overlay) { display: none !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .weekly-print-overlay {
            display: block !important;
            position: static !important;
            inset: auto !important;
            background: white !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            z-index: auto !important;
          }
          .no-print { display: none !important; }
          .weekly-print-sheet {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .weekly-print-scroll {
            overflow: visible !important;
          }
          .weekly-print-grid {
            min-width: 0 !important;
            width: 100% !important;
          }
          .weekly-day-col {
            min-width: 0 !important;
            overflow: visible !important;
          }
          @page { margin: 1cm 1.2cm; size: A4 landscape; }
        }
      `}</style>

      <div className="weekly-print-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 py-8 backdrop-blur-sm">
        <div className="no-print fixed left-0 right-0 top-0 z-50 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-3 shadow-sm sm:gap-3 sm:px-6">
          <BackLink onClick={onClose} label="Cerrar vista previa" variant="overlay-close" compact />

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setAnchorDate((current) => shiftWeek(current, -1))}
              aria-label="Semana anterior"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="min-w-0 text-center" aria-live="polite">
              <p className="truncate text-sm font-semibold text-slate-700">{weekLabel}</p>
              <p className="text-[11px] text-slate-400">
                {daysWithPlan === 0
                  ? 'Ningún día con dieta'
                  : `${daysWithPlan} ${daysWithPlan === 1 ? 'día con dieta' : 'días con dieta'}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAnchorDate((current) => shiftWeek(current, 1))}
              aria-label="Semana siguiente"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setAnchorDate(todayLocalDateStr())}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-500/40 hover:text-brand-500"
            >
              Semana actual
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="ml-auto flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-brand-600 sm:px-5"
          >
            🖨️ <span className="sm:hidden">PDF</span><span className="hidden sm:inline">Imprimir / Guardar PDF</span>
          </button>
        </div>

        <div className="mt-20 no-print sm:mt-16" />

        {/* En pantalla: scroll horizontal en móvil. En impresión: hoja ancha A4 landscape. */}
        <div className="weekly-print-sheet mx-auto box-border max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white p-4 shadow-2xl sm:p-6 md:w-[270mm] md:min-h-[190mm] md:max-w-none md:px-[10mm] md:py-[12mm]">
          <div className="relative mb-5">
            <div
              className="h-14 w-full"
              style={{
                background: 'linear-gradient(135deg, #3b5feb 0%, #4130c9 50%, #312a8f 100%)',
                clipPath: 'polygon(0 0, 72% 0, 52% 100%, 0 100%)',
              }}
            />
            <div className="absolute inset-0 flex items-center px-5">
              <div>
                <p className="text-[10px] font-medium text-white opacity-80">Plan Alimentario Semanal</p>
                <p className="text-sm font-bold text-white">{patientName}</p>
              </div>
            </div>
            <div className="absolute right-4 top-0.5 flex flex-col items-center">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={brandName || 'Logo de la clínica'}
                  className="h-12 w-12 rounded-lg border border-[#c7d3fd] bg-white object-contain p-1"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#7d93f7] bg-slate-100">
                  <span className="px-1 text-center text-[9px] font-bold leading-tight text-slate-400">{patientBadge}</span>
                </div>
              )}
              {brandName ? (
                <p className="mt-0.5 max-w-[80px] text-center text-[8px] font-semibold leading-tight text-slate-500">{brandName}</p>
              ) : null}
            </div>
          </div>

          <p className="mb-4 text-sm font-medium text-slate-500">{weekLabel}</p>

          <div className="weekly-print-scroll -mx-1 overflow-x-auto pb-1">
            <div
              className="weekly-print-grid grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200"
              style={{ minWidth: '980px', minHeight: '120mm' }}
            >
              {days.map((day) => (
                <DayColumn key={day.dateStr} dateStr={day.dateStr} plans={day.plans} dayLabel={day.label} />
              ))}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-2">
            <p className="text-[9px] text-slate-400">
              Generado por {brandName || 'NutriGenius'} · {new Date().toLocaleDateString(getCurrentLocale())}
            </p>
            {publicSiteLabel() ? <p className="text-[9px] font-medium text-brand-500">{publicSiteLabel()}</p> : null}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
