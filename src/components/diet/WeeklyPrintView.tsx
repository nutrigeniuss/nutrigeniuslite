import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DietMeal, DietPlan } from '../patient/patientDietTypes';
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
  // Marca del nutricionista para personalizar el PDF.
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
      <p className="text-[10px] font-bold text-brand-500 uppercase tracking-wide mb-0.5">{meal.name}</p>
      {meal.items.map((item, index) => (
        <p key={item.id || `${item.name || 'item'}-${index}`} className="text-[10px] text-slate-600 leading-snug">
          {item.name}
          {item.unit ? `, ${item.unit}` : ''}
        </p>
      ))}
      {meal.notes ? <p className="text-[9px] italic text-slate-400 mt-0.5">{meal.notes}</p> : null}
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
    <div className="border-r border-slate-200 last:border-r-0 px-1.5 py-2 min-h-full">
      <div className="text-center mb-2 pb-1 border-b border-[#c7d3fd]">
        <p className="text-[11px] font-bold text-slate-700">{dayLabel}</p>
        <p className="text-[9px] text-slate-400">{dateStr.slice(8)}/{dateStr.slice(5, 7)}</p>
        {totalCal > 0 ? <p className="text-[9px] font-semibold text-brand-500 mt-0.5">{Math.round(totalCal)} kcal</p> : null}
      </div>

      {plans.length === 0 ? (
        <p className="text-[9px] text-slate-300 text-center italic">Sin dieta</p>
      ) : (
        allMeals.map((meal, index) => <MealItems key={meal.id || `${meal.name || 'meal'}-${index}`} meal={meal} />)
      )}
    </div>
  );
}

export default function WeeklyPrintView({ dietPlans, patientName, weekStartDate, onClose, brandLogoUrl, brandName }: WeeklyPrintViewProps) {
  const handlePrint = (): void => {
    window.print();
  };

  // La semana que se está viendo. Arranca en la que traiga el llamador (la del
  // día seleccionado en el calendario) y desde aquí se puede mover sin cerrar
  // la vista previa: antes, para ver otra semana había que salir, elegir otro
  // día y volver a entrar — y ni eso funcionaba, porque el ancla se descartaba.
  const [anchorDate, setAnchorDate] = useState<string>(weekStartDate || todayLocalDateStr());

  // Lunes a domingo y en hora local (ver lib/weekRange): con toISOString, un
  // domingo por la noche en Perú ya contaba como lunes y salía otra semana.
  const week = weekRangeOf(anchorDate);

  const days: WeekDayPlan[] = week.days.map((dateStr, index) => ({
    dateStr,
    label: DAY_NAMES[index],
    plans: dietPlans.filter((plan) => plan.date === dateStr),
  }));

  const daysWithPlan = days.filter((day) => day.plans.length > 0).length;
  const weekLabel = formatWeekRange(week);
  const patientBadge = patientName?.split(' ').slice(0, 2).join(' ') || 'Paciente';

  return (
    <>
      <style>{`
        @media print {
          body > * { display: none !important; }
          .weekly-print-overlay { display: block !important; position: fixed !important; inset: 0; background: white; z-index: 99999; overflow: visible !important; }
          .no-print { display: none !important; }
          @page { margin: 1cm 1.2cm; size: A4 landscape; }
          .print-table { font-size: 9px; }
        }
        @media screen {
          .weekly-print-overlay { display: flex; }
        }
      `}</style>

      <div className="weekly-print-overlay fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm items-start justify-center overflow-y-auto py-8">
        <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 shadow-sm px-6 py-3 flex items-center gap-3">
          <BackLink onClick={onClose} label="Cerrar vista previa" variant="overlay-close" compact />
          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAnchorDate((current) => shiftWeek(current, -1))}
              aria-label="Semana anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="min-w-[210px] text-center" aria-live="polite">
              <p className="text-sm font-semibold text-slate-700">{weekLabel}</p>
              {/* Cuántos días llevan dieta, para no mandar a imprimir una hoja
                  en blanco sin darse cuenta. */}
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
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
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

          <div className="flex-1" />
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-xl shadow transition-colors"
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>

        <div className="mt-16 no-print" />

        <div className="bg-white shadow-2xl rounded-2xl mx-auto print-table" style={{ width: '270mm', minHeight: '190mm', padding: '12mm 10mm', boxSizing: 'border-box' }}>
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
                <p className="text-white text-[10px] font-medium opacity-80">Plan Alimentario Semanal</p>
                <p className="text-white font-bold text-sm">{patientName}</p>
              </div>
            </div>
            <div className="absolute right-4 top-0.5 flex flex-col items-center">
              {brandLogoUrl ? (
                <img
                  src={brandLogoUrl}
                  alt={brandName || 'Logo de la clínica'}
                  className="w-12 h-12 rounded-lg object-contain bg-white border border-[#c7d3fd] p-1"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-[#7d93f7] flex items-center justify-center">
                  <span className="text-slate-400 text-[9px] font-bold text-center leading-tight px-1">{patientBadge}</span>
                </div>
              )}
              {brandName ? <p className="text-[8px] text-slate-500 mt-0.5 font-semibold text-center max-w-[80px] leading-tight">{brandName}</p> : null}
            </div>
          </div>

          <p className="text-sm text-slate-500 font-medium mb-4">{weekLabel}</p>

          <div className="grid grid-cols-7 border border-slate-200 rounded-xl overflow-hidden" style={{ minHeight: '120mm' }}>
            {days.map((day) => (
              <DayColumn key={day.dateStr} dateStr={day.dateStr} plans={day.plans} dayLabel={day.label} />
            ))}
          </div>

          <div className="mt-4 pt-2 border-t border-slate-200 flex justify-between items-center">
            <p className="text-[9px] text-slate-400">Generado por {brandName || 'NutriGenius'} · {new Date().toLocaleDateString(getCurrentLocale())}</p>
            {publicSiteLabel() ? <p className="text-[9px] text-brand-500 font-medium">{publicSiteLabel()}</p> : null}
          </div>
        </div>
      </div>
    </>
  );
}