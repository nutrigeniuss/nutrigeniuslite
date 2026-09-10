import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import SaveToCatalogModal from '@/components/diet/SaveToCatalogModal';
import {
  formatMonthTitle,
  formatWeekRange,
  parseLocalDate,
  shiftWeek,
  todayLocalDateStr,
  toLocalDateStr,
  weekRangeOf,
} from '@/lib/weekRange';
import { summarizeWeek } from '@/lib/diet/weekSummary';
import type { DietPlan, PatientDietRecord } from './patientDietTypes';
import { logger, errorMessage } from '@/lib/logger';
import WeekStrip from './dietCalendar/WeekStrip';
import WeekSummaryCard from './dietCalendar/WeekSummaryCard';
import MonthGrid from './dietCalendar/MonthGrid';
import DayPanel, { type CopyCandidate } from './dietCalendar/DayPanel';
import CopyDietDialog from './dietCalendar/CopyDietDialog';

type PlansByDate = Record<string, DietPlan[]>;

type DietCalendarViewProps = {
  patient: PatientDietRecord;
  dietPlans: DietPlan[];
  onCreateFromScratch: (date: string) => void | Promise<void>;
  onCreateFromCatalog?: (date: string) => void;
  onSaveToCatalog?: (plan: DietPlan, name?: string) => void | Promise<void>;
  onCopyFromDate: (targetDate: string, sourcePlanId: string) => void | Promise<void>;
  patientParam: string;
  onDeletePlan?: (planId: string) => void | Promise<void>;
  /**
   * Avisa de qué día está elegido, en 'YYYY-MM-DD' (o null si ninguno).
   * Lo usa la impresión semanal para saber QUÉ semana sacar: sin esto, el
   * botón de imprimir no tenía forma de enterarse de la selección y siempre
   * caía en la semana de hoy.
   */
  onSelectedDateChange?: (dateStr: string | null) => void;
};

type ViewMode = 'semana' | 'mes';

/** Suma meses conservando el día 1, para navegar el mes sin desbordes. */
const shiftMonth = (dateStr: string, delta: number): string => {
  const date = parseLocalDate(dateStr) ?? new Date();
  return toLocalDateStr(new Date(date.getFullYear(), date.getMonth() + delta, 1));
};

/**
 * Calendario de dietas del paciente.
 *
 * La vista por defecto es la SEMANA, no el mes. El motivo está a la vista en la
 * propia pantalla: el botón de arriba dice «Imprimir semana». La unidad real de
 * trabajo es la semana, y el mes enseñaba treinta casillas vacías para decir
 * que había dieta en dos días.
 *
 * El mes se conserva con otro papel: es el MAPA. Sirve para ver cuánto del mes
 * está planificado y para saltar a una semana lejana, no para trabajar — si
 * hiciera lo mismo que la semana, serían dos pantallas compitiendo.
 */
export default function DietCalendarView({
  patient,
  dietPlans,
  onCreateFromScratch,
  onCreateFromCatalog,
  onSaveToCatalog,
  onCopyFromDate,
  patientParam,
  onDeletePlan,
  onSelectedDateChange,
}: DietCalendarViewProps) {
  const { user } = useAuth();
  const todayStr = todayLocalDateStr();

  const [viewMode, setViewMode] = useState<ViewMode>('semana');
  // Día de referencia de lo que se está viendo (su semana, o su mes).
  const [anchorDate, setAnchorDate] = useState<string>(todayStr);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr);

  const [planToDelete, setPlanToDelete] = useState<DietPlan | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  // Modal para nombrar la dieta al guardarla en el catálogo ("Mis Dietas").
  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogPlan, setCatalogPlan] = useState<DietPlan | null>(null);
  const [catalogName, setCatalogName] = useState('');
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [savedCatalog, setSavedCatalog] = useState(false);

  const plansByDate = useMemo<PlansByDate>(() => {
    const grouped: PlansByDate = {};
    for (const plan of dietPlans || []) {
      if (!plan.date) continue;
      if (!grouped[plan.date]) grouped[plan.date] = [];
      grouped[plan.date].push(plan);
    }
    return grouped;
  }, [dietPlans]);

  const week = useMemo(() => weekRangeOf(anchorDate), [anchorDate]);
  const weekSummary = useMemo(() => summarizeWeek(plansByDate, week.days), [plansByDate, week.days]);

  const plansOnSelected = selectedDate ? plansByDate[selectedDate] || [] : [];

  // Dietas de OTROS días, más recientes primero. Es la lista que se ofrece para
  // copiar, tanto en el panel (las tres primeras) como en la ventana completa.
  const copyCandidates = useMemo<CopyCandidate[]>(() => {
    return (dietPlans || [])
      .filter((plan) => plan.date && plan.date !== selectedDate)
      .sort((left, right) => (right.date || '').localeCompare(left.date || ''))
      .map((plan) => ({ planId: plan.id, date: plan.date as string, plan }));
  }, [dietPlans, selectedDate]);

  // Un solo sitio del que sale el aviso, en vez de repetirlo en cada onClick:
  // así no hay forma de que un camino nuevo se olvide de avisar.
  useEffect(() => {
    onSelectedDateChange?.(selectedDate);
  }, [selectedDate, onSelectedDateChange]);

  const handleSelect = (dateStr: string): void => {
    setSelectedDate(dateStr);
    // Al elegir un día de otra semana o de otro mes, la vista lo sigue.
    setAnchorDate(dateStr);
  };

  const goToday = (): void => {
    setAnchorDate(todayStr);
    setSelectedDate(todayStr);
  };

  const openCatalogModal = (plan: DietPlan): void => {
    setCatalogPlan(plan);
    setCatalogName(plan.title || `Dieta ${plan.date || ''}`.trim());
    setSavedCatalog(false);
    setCatalogModalOpen(true);
  };

  const handleConfirmSaveToCatalog = async (): Promise<void> => {
    if (!catalogPlan || !onSaveToCatalog || !catalogName.trim() || savingCatalog) return;
    setSavingCatalog(true);
    try {
      await onSaveToCatalog(catalogPlan, catalogName.trim());
      setSavedCatalog(true);
      setTimeout(() => { setCatalogModalOpen(false); setSavedCatalog(false); }, 900);
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleCopy = (planId: string): void => {
    if (!selectedDate) return;
    setCopyDialogOpen(false);
    void onCopyFromDate(selectedDate, planId);
  };

  const rangeLabel = viewMode === 'semana' ? formatWeekRange(week) : formatMonthTitle(anchorDate);

  return (
    <div className="flex flex-col gap-4">
      {/* Conmutador + navegación. En móvil el flex-wrap lo apila solo. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex gap-0.5 rounded-[10px] bg-brand-50 p-1" role="tablist">
          {([['semana', 'Semana'], ['mes', 'Mes']] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={viewMode === mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                viewMode === mode
                  ? 'bg-white text-brand-500 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setAnchorDate((current) => (viewMode === 'semana' ? shiftWeek(current, -1) : shiftMonth(current, -1)))}
          aria-label={viewMode === 'semana' ? 'Semana anterior' : 'Mes anterior'}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e6eaf4] text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="px-1 text-[13.5px] font-bold tracking-tight text-slate-800" aria-live="polite">
          {rangeLabel}
        </span>

        <button
          type="button"
          onClick={() => setAnchorDate((current) => (viewMode === 'semana' ? shiftWeek(current, 1) : shiftMonth(current, 1)))}
          aria-label={viewMode === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-[#e6eaf4] text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-500"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={goToday}
          className="rounded-lg border border-[#e6eaf4] px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-brand-500/40 hover:text-brand-500"
        >
          {viewMode === 'semana' ? 'Esta semana' : 'Este mes'}
        </button>
      </div>

      {viewMode === 'semana' ? (
        <WeekStrip
          days={week.days}
          plansByDate={plansByDate}
          selectedDate={selectedDate}
          todayStr={todayStr}
          onSelect={handleSelect}
          onAdd={(dateStr) => { handleSelect(dateStr); void onCreateFromScratch(dateStr); }}
        />
      ) : null}

      <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {viewMode === 'semana' ? (
            <WeekSummaryCard summary={weekSummary} targetCalories={patient.target_calories} />
          ) : (
            <MonthGrid
              monthAnchor={anchorDate}
              plansByDate={plansByDate}
              selectedDate={selectedDate}
              todayStr={todayStr}
              visibleWeekDays={week.days}
              onSelect={handleSelect}
              onGoToWeek={(dateStr) => { setAnchorDate(dateStr); setViewMode('semana'); }}
            />
          )}
        </div>

        <div className="w-full flex-shrink-0 lg:w-[360px]">
          <DayPanel
            dateStr={selectedDate}
            plans={plansOnSelected}
            todayStr={todayStr}
            patientParam={patientParam}
            copyCandidates={copyCandidates}
            onCreateFromScratch={(date) => { void onCreateFromScratch(date); }}
            onCreateFromCatalog={onCreateFromCatalog}
            onCopyFrom={handleCopy}
            onOpenAllDiets={() => setCopyDialogOpen(true)}
            onSaveToCatalog={openCatalogModal}
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
          // Defense-in-depth: filter by nutritionist_id in addition to id so
          // a stolen plan id can't be used to delete another user's record.
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

      <SaveToCatalogModal
        open={catalogModalOpen}
        value={catalogName}
        onChange={setCatalogName}
        onSave={() => void handleConfirmSaveToCatalog()}
        onClose={() => setCatalogModalOpen(false)}
        saving={savingCatalog}
        saved={savedCatalog}
      />
    </div>
  );
}
