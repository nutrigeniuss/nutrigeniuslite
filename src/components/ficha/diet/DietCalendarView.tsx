import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import {
  formatMonthTitle,
  parseLocalDate,
  todayLocalDateStr,
  toLocalDateStr,
} from '@/lib/weekRange';
import type { DietPlan } from './patientDietTypes';
import { logger, errorMessage } from '@/lib/logger';
import MonthGrid from './dietCalendar/MonthGrid';
import DayPanel, { type CopyCandidate } from './dietCalendar/DayPanel';
import CopyDietDialog from './dietCalendar/CopyDietDialog';

type PlansByDate = Record<string, DietPlan[]>;

type DietCalendarViewProps = {
  dietPlans: DietPlan[];
  onCreateFromScratch: (date: string) => void | Promise<void>;
  onCopyFromDate: (targetDate: string, sourcePlanId: string) => void | Promise<void>;
  patientParam: string;
  onDeletePlan?: (planId: string) => void | Promise<void>;
  onSelectedDateChange?: (dateStr: string | null) => void;
};

const shiftMonth = (dateStr: string, delta: number): string => {
  const date = parseLocalDate(dateStr) ?? new Date();
  return toLocalDateStr(new Date(date.getFullYear(), date.getMonth() + delta, 1));
};

/** Calendario de dietas Lite: sin catálogo de plantillas. */
export default function DietCalendarView({
  dietPlans,
  onCreateFromScratch,
  onCopyFromDate,
  patientParam,
  onDeletePlan,
  onSelectedDateChange,
}: DietCalendarViewProps) {
  const { user } = useAuth();
  const todayStr = todayLocalDateStr();

  const [anchorDate, setAnchorDate] = useState<string>(todayStr);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);
  const [planToDelete, setPlanToDelete] = useState<DietPlan | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);

  const plansByDate = useMemo<PlansByDate>(() => {
    const grouped: PlansByDate = {};
    for (const plan of dietPlans || []) {
      if (!plan.date) continue;
      if (!grouped[plan.date]) grouped[plan.date] = [];
      grouped[plan.date].push(plan);
    }
    return grouped;
  }, [dietPlans]);

  const plansOnSelected = selectedDate ? plansByDate[selectedDate] || [] : [];

  const copyCandidates = useMemo<CopyCandidate[]>(() => {
    return (dietPlans || [])
      .filter((plan) => plan.date && plan.date !== selectedDate)
      .sort((left, right) => (right.date || '').localeCompare(left.date || ''))
      .map((plan) => ({ planId: plan.id, date: plan.date as string, plan }));
  }, [dietPlans, selectedDate]);

  useEffect(() => {
    onSelectedDateChange?.(selectedDate);
  }, [selectedDate, onSelectedDateChange]);

  const handleSelect = (dateStr: string): void => {
    setSelectedDate(dateStr);
    setAnchorDate(dateStr);
  };

  const goToday = (): void => {
    setAnchorDate(todayStr);
    setSelectedDate(todayStr);
  };

  const handleCopy = (planId: string): void => {
    if (!selectedDate) return;
    setCopyDialogOpen(false);
    void onCopyFromDate(selectedDate, planId);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setAnchorDate((current) => shiftMonth(current, -1))}
          aria-label="Mes anterior"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e6eaf4] text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="px-1 text-[13.5px] font-bold tracking-tight text-slate-800" aria-live="polite">
          {formatMonthTitle(anchorDate)}
        </span>

        <button
          type="button"
          onClick={() => setAnchorDate((current) => shiftMonth(current, 1))}
          aria-label="Mes siguiente"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e6eaf4] text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border border-[#e6eaf4] px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-brand-500/40 hover:text-brand-500"
        >
          Este mes
        </button>
      </div>

      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <MonthGrid
            monthAnchor={anchorDate}
            plansByDate={plansByDate}
            selectedDate={selectedDate}
            todayStr={todayStr}
            onSelect={handleSelect}
          />
        </div>

        <div className="w-full flex-shrink-0 lg:w-[360px]">
          <DayPanel
            dateStr={selectedDate}
            plans={plansOnSelected}
            todayStr={todayStr}
            patientParam={patientParam}
            copyCandidates={copyCandidates}
            onCreateFromScratch={(date) => { void onCreateFromScratch(date); }}
            onCopyFrom={handleCopy}
            onOpenAllDiets={() => setCopyDialogOpen(true)}
            onDeletePlan={setPlanToDelete}
          />
        </div>
      </div>

      <CopyDietDialog
        open={copyDialogOpen}
        targetDate={selectedDate}
        candidates={copyCandidates}
        onCopy={handleCopy}
        onClose={() => setCopyDialogOpen(false)}
      />

      <ConfirmationDialog
        open={Boolean(planToDelete)}
        onOpenChange={(open: boolean) => { if (!open) setPlanToDelete(null); }}
        title="Eliminar plan diario"
        description="Esta acción quitará el plan asignado a ese día."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (!planToDelete) return;

          if (onDeletePlan) {
            await onDeletePlan(planToDelete.id);
            setPlanToDelete(null);
            return;
          }

          if (!user?.id) return;
          const { error } = await supabase
            .from('diet_plans')
            .delete()
            .eq('id', planToDelete.id)
            .eq('nutritionist_id', user.id);
          if (error) {
            logger.error('Error eliminando dieta', { error: errorMessage(error) });
            return;
          }

          setPlanToDelete(null);
          window.location.reload();
        }}
      />
    </div>
  );
}
