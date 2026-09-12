import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Apple, ArrowRightLeft, Plus, Printer, Search } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { createPageUrl } from '@/utils';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useInspection } from '@/lib/InspectionContext';
import DietCalendarView from './DietCalendarView';
import WeeklyPrintView from '@/components/diet/WeeklyPrintView';
import Requerimiento from '@/components/ficha/Requerimiento';
import {
  hydrateExchangeGroupsRuntime,
  subscribeToExchangeGroupsHydration,
} from '@/lib/exchangeRuntime';
import {
  readPatientDietPlansCache,
  writePatientDietPlansCache,
  readPatientExchangePlansCache,
  writePatientExchangePlansCache,
} from '@/lib/patientDietCache';
import type { DietPlan, ExchangePlan } from './patientDietTypes';
import type {
  DietCatalogInsertPayload,
  ExchangeInsertPayload,
  ExchangeMacroBreakdown,
  PatientDietProps,
  PendingDietAction,
} from './patientDiet/types';
import {
  asMeasurementArray,
  buildExchangeMacroBreakdown,
  buildPatientName,
  buildPatientParam,
  clampPercentage,
  cloneMeals,
  DEFAULT_EXCHANGE_PLAN_TITLE,
  getExchangeMeals,
  getExchangePlanTotals,
  getPrimaryExchangeScenario,
  matchesExchangeSearch,
  resolveMeasurementForPlanDate,
} from './patientDiet/logic';
import { DatePromptModal } from './patientDiet/components';
import ExchangePlanCard from './patientDiet/ExchangePlanCard';
import { logger, errorMessage } from '@/lib/logger';
import { formatWeekRangeShort, todayLocalDateStr, weekRangeOf } from '@/lib/weekRange';

export default function PatientDiet({ patient, tab = 'alimentos', onUpdate, registerAutosave }: PatientDietProps) {
  const { user } = useAuth();
  // Modo inspección (titular Pro+): las LECTURAS de dietas apuntan al trabajador
  // inspeccionado; las escrituras siguen en user.id (bloqueadas por RLS).
  const { inspectedId } = useInspection();
  const scopeId = inspectedId ?? user?.id;
  const navigate = useNavigate();
  const [dietPlans, setDietPlans] = useState<DietPlan[]>(
    () => readPatientDietPlansCache<DietPlan>(patient.id) ?? [],
  );
  const [exchangePlans, setExchangePlans] = useState<ExchangePlan[]>(
    () => readPatientExchangePlansCache<ExchangePlan>(patient.id) ?? [],
  );
  // Solo bloqueamos con "Cargando…" si no hay nada cacheado que mostrar.
  const [loading, setLoading] = useState(
    () =>
      readPatientDietPlansCache(patient.id) == null &&
      readPatientExchangePlansCache(patient.id) == null,
  );
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [showWeeklyPrint, setShowWeeklyPrint] = useState(false);
  const [weekPrintStart, setWeekPrintStart] = useState(todayLocalDateStr);
  // Qué día tiene elegido el calendario. Es lo que decide qué semana se
  // imprime: antes el botón lo descartaba y volvía a hoy, así que las dietas
  // de otras semanas no había manera de imprimirlas.
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(todayLocalDateStr);
  const [searchExchange, setSearchExchange] = useState('');
  const [exchangePlanToDelete, setExchangePlanToDelete] = useState<string | null>(null);
  const [editingExchangePlanId, setEditingExchangePlanId] = useState<string | null>(null);
  const [editingExchangeTitle, setEditingExchangeTitle] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingDietAction | null>(null);
  const [showMacroEditor, setShowMacroEditor] = useState(false);
  const [macroEditorKey, setMacroEditorKey] = useState(0);
  const [macroManualSaveHandler, setMacroManualSaveHandler] = useState<(() => Promise<void>) | null>(null);
  const [showExchangeDatePrompt, setShowExchangeDatePrompt] = useState(false);
  const [exchangeDraftDate, setExchangeDraftDate] = useState(todayLocalDateStr);
  const [exchangeDraftTitle, setExchangeDraftTitle] = useState(DEFAULT_EXCHANGE_PLAN_TITLE);
  // Tick para forzar re-render cuando termine la hidratación del catálogo de intercambios.
  const [, setCatalogVersion] = useState(0);

  // Carga el catálogo dinámico desde Supabase. Si el admin ya migró/editó alimentos,
  // sus cambios se reflejan aquí sin tener que recargar manualmente.
  useEffect(() => {
    void hydrateExchangeGroupsRuntime();
    const unsubscribe = subscribeToExchangeGroupsHydration(() => {
      setCatalogVersion((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  const patientName = buildPatientName(patient);
  const patientParam = buildPatientParam(patient, patientName);
  const pendingMeasurement = pendingAction ? resolveMeasurementForPlanDate(asMeasurementArray(patient.measurements), pendingAction.date) : null;

  // Mantiene sincronizado el calendario con Supabase cada vez que cambia el paciente activo.
  // Defensa en capas: aunque RLS ya aísla por nutritionist_id, filtramos también en la query
  // y excluimos plantillas de catálogo (is_catalog = true) para no contaminar el calendario.
  const load = async (): Promise<void> => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    // Si ya tenemos datos cacheados en pantalla, refrescamos en silencio
    // (sin "Cargando…"); solo bloqueamos cuando no hay nada que mostrar.
    const hasCached =
      readPatientDietPlansCache(patient.id) != null ||
      readPatientExchangePlansCache(patient.id) != null;
    setLoading(!hasCached);

    const [{ data, error }, { data: exchangeData, error: exchangeError }] = await Promise.all([
      supabase
        .from('diet_plans')
        .select('*')
        .eq('nutritionist_id', scopeId)
        .eq('patient_id', patient.id)
        .eq('is_catalog', false)
        .order('date', { ascending: false }),
      supabase
        .from('exchange_diets')
        .select('*')
        .eq('nutritionist_id', scopeId)
        .eq('patient_id', patient.id)
        .order('date', { ascending: false }),
    ]);

    if (error) {
      logger.error('Error cargando dietas del paciente', { error: errorMessage(error) });
      setDietPlans([]);
      toast({
        title: 'No se pudieron cargar las dietas por alimentos',
        description: error.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } else {
      const plans = (data as DietPlan[]) || [];
      setDietPlans(plans);
      writePatientDietPlansCache(patient.id, plans);
    }

    if (exchangeError) {
      logger.error('Error cargando planes por intercambios', { error: errorMessage(exchangeError) });
      setExchangePlans([]);
      toast({
        title: 'No se pudieron cargar los planes por intercambios',
        description: exchangeError.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
    } else {
      const plans = (exchangeData as ExchangePlan[]) || [];
      setExchangePlans(plans);
      writePatientExchangePlansCache(patient.id, plans);
    }

    setLoading(false);
  };

  useEffect(() => {
    // Al cambiar de paciente, mostramos de inmediato su caché (o vacío) para
    // no dejar en pantalla los planes del paciente anterior mientras refresca.
    setDietPlans(readPatientDietPlansCache<DietPlan>(patient.id) ?? []);
    setExchangePlans(readPatientExchangePlansCache<ExchangePlan>(patient.id) ?? []);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  const openMacroEditor = (action: PendingDietAction | null): void => {
    setPendingAction(action);
    setShowMacroEditor(true);
    setMacroEditorKey((current) => current + 1);
  };

  const closeMacroEditor = (): void => {
    setPendingAction(null);
    setShowMacroEditor(false);
  };

  const openActionOrRequestMacros = (action: PendingDietAction): void => {
    // Tanto alimentos como intercambios deben pasar primero por la
    // distribución de macronutrientes para la fecha objetivo elegida.
    openMacroEditor(action);
  };

  const registerMacroAutosave = useCallback((handler: (() => Promise<void>) | null) => {
    registerAutosave?.(handler);
  }, [registerAutosave]);

  const registerMacroManualSave = useCallback((handler: (() => Promise<void>) | null) => {
    setMacroManualSaveHandler(() => handler);
  }, []);

  const executePendingAction = async (action: PendingDietAction): Promise<void> => {
    if (!user?.id) return;

    if (action.kind === 'alimentos-nuevo') {
      void navigate(createPageUrl(`DietCreator?date=${action.date}&${patientParam}`));
      return;
    }

    if (action.kind === 'intercambios-nuevo') {
      void navigate(createPageUrl(`ExchangeDietCreator?date=${action.date}&title=${encodeURIComponent(action.title)}&${patientParam}`));
      return;
    }

    if (action.kind === 'alimentos-catalogo') {
      const payload: DietCatalogInsertPayload = {
        nutritionist_id: user.id,
        patient_id: patient.id,
        patient_name: patientName,
        date: action.date,
        title: action.catalogPlan.title,
        target_calories: patient.target_calories || 2000,
        target_protein: patient.target_protein || 150,
        target_carbs: patient.target_carbs || 250,
        target_fat: patient.target_fat || 65,
        meals: cloneMeals(action.catalogPlan.meals),
      };

      const { data, error } = await supabase.from('diet_plans').insert([payload]).select().single();

      if (error) {
        logger.error('Error creando dieta desde catálogo', { error: errorMessage(error) });
        toast({
          title: 'No se pudo crear la dieta desde catálogo',
          description: error.message || 'Intenta nuevamente.',
          variant: 'destructive',
        });
        return;
      }

      void navigate(createPageUrl(`DietCreator?planId=${(data as DietPlan).id}&${patientParam}`));
      return;
    }

    const sourcePlan = dietPlans.find((plan) => plan.id === action.sourcePlanId);
    if (!sourcePlan) {
      toast({
        title: 'No se encontró la dieta a copiar',
        description: 'Selecciona nuevamente la dieta de origen.',
        variant: 'destructive',
      });
      return;
    }

    const payload: DietCatalogInsertPayload = {
      nutritionist_id: user.id,
      patient_id: patient.id,
      patient_name: patientName,
      date: action.date,
      title: sourcePlan.title,
      target_calories: sourcePlan.target_calories || patient.target_calories || 2000,
      target_protein: sourcePlan.target_protein || patient.target_protein || 150,
      target_carbs: sourcePlan.target_carbs || patient.target_carbs || 250,
      target_fat: sourcePlan.target_fat || patient.target_fat || 65,
      meals: cloneMeals(sourcePlan.meals),
    };

    const { data, error } = await supabase.from('diet_plans').insert([payload]).select().single();

    if (error) {
      logger.error('Error copiando dieta por fecha', { error: errorMessage(error) });
      toast({
        title: 'No se pudo copiar la dieta',
        description: error.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    void navigate(createPageUrl(`DietCreator?planId=${(data as DietPlan).id}&${patientParam}`));
  };

  const handleCreateFromCatalog = (date: string): void => {
    setPendingDate(date);
    setShowCatalogModal(true);
  };

  const handleCatalogSelect = async (catalogPlan: DietPlan): Promise<void> => {
    if (!pendingDate) return;

    setShowCatalogModal(false);
    openActionOrRequestMacros({ kind: 'alimentos-catalogo', date: pendingDate, catalogPlan });
  };

  const handleCopyFromDate = async (targetDate: string, sourcePlanId: string): Promise<void> => {
    openActionOrRequestMacros({ kind: 'alimentos-copia', date: targetDate, sourcePlanId });
  };

  const handleContinueAfterMacros = async (): Promise<void> => {
    if (!pendingAction) {
      closeMacroEditor();
      return;
    }

    // Antes éramos estrictos: si los macros no estaban guardados (manual o
    // autosave), bloqueábamos al usuario. Eso generaba falsos negativos
    // (porcentaje cuadrado al 100% pero el botón se sentía "trabado").
    // Ahora intentamos guardar best-effort y siempre dejamos pasar; cualquier
    // valor faltante se completa luego en el editor con valores por defecto.
    try {
      if (macroManualSaveHandler) {
        await macroManualSaveHandler();
      }
    } catch (error) {
      // No bloqueamos el flujo aunque falle el guardado manual: el editor
      // tomará los últimos valores conocidos del paciente.
      logger.warn('Guardado de macros no completado, continuando igual', { error: errorMessage(error) });
    }

    const actionToRun = pendingAction;
    setPendingAction(null);
    setShowMacroEditor(false);
    await executePendingAction(actionToRun);
  };

  const filteredExchange = exchangePlans.filter((plan) => matchesExchangeSearch(plan, searchExchange));

  const isLatest = (plan: ExchangePlan): boolean => plan.id === exchangePlans[0]?.id;

  const formatDate = (value?: string | null): string => {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleDuplicateExchange = async (plan: ExchangePlan): Promise<void> => {
    if (!user?.id) return;

    const primaryScenario = getPrimaryExchangeScenario(plan);

    const payload: ExchangeInsertPayload = {
      nutritionist_id: user.id,
      title: plan.title,
      patient_id: patient.id,
      patient_name: patientName,
      date: todayLocalDateStr(),
      meals: cloneMeals(primaryScenario?.meals || plan.meals),
      active_group_keys: Array.isArray(primaryScenario?.active_group_keys) ? [...primaryScenario.active_group_keys] : Array.isArray(plan.active_group_keys) ? [...plan.active_group_keys] : undefined,
      food_list_selections: primaryScenario?.food_list_selections ? { ...primaryScenario.food_list_selections } : plan.food_list_selections ? { ...plan.food_list_selections } : undefined,
      scenarios: Array.isArray(plan.scenarios)
        ? plan.scenarios.map((scenario) => ({
            ...scenario,
            meals: cloneMeals(scenario.meals),
            active_group_keys: Array.isArray(scenario.active_group_keys) ? [...scenario.active_group_keys] : [],
            food_list_selections: scenario.food_list_selections ? { ...scenario.food_list_selections } : {},
          }))
        : undefined,
      active_scenario_key: plan.active_scenario_key || primaryScenario?.key || null,
    };

    const { error } = await supabase.from('exchange_diets').insert([payload]);

    if (error) {
      logger.error('Error duplicando plan por intercambios', { error: errorMessage(error) });
      toast({
        title: 'No se pudo duplicar el plan',
        description: error.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Plan duplicado',
      description: 'Se creó una copia del plan por intercambios.',
    });
    await load();
  };

  const handleDeleteExchange = async (planId: string): Promise<void> => {
    if (!user?.id) return;
    // Defense-in-depth: nutritionist_id filter on top of id so a stolen
    // plan id can't be exploited from another authenticated account.
    const { error } = await supabase
      .from('exchange_diets')
      .delete()
      .eq('id', planId)
      .eq('nutritionist_id', user.id);

    if (error) {
      logger.error('Error eliminando plan por intercambios', { error: errorMessage(error) });
      toast({
        title: 'No se pudo eliminar el plan',
        description: error.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    setExchangePlanToDelete(null);
    toast({
      title: 'Plan eliminado',
      description: 'El plan por intercambios se eliminó correctamente.',
    });
    await load();
  };

  const startExchangeRename = (plan: ExchangePlan): void => {
    setEditingExchangePlanId(plan.id);
    setEditingExchangeTitle(plan.title || DEFAULT_EXCHANGE_PLAN_TITLE);
  };

  const cancelExchangeRename = (): void => {
    setEditingExchangePlanId(null);
    setEditingExchangeTitle('');
  };

  // El nombre se renombra desde el listado almacenado para mantener libre
  // la cabecera del editor y evitar que los controles salten de fila.
  const saveExchangeRename = async (plan: ExchangePlan): Promise<void> => {
    const nextTitle = editingExchangeTitle.trim() || DEFAULT_EXCHANGE_PLAN_TITLE;

    if (nextTitle === (plan.title || DEFAULT_EXCHANGE_PLAN_TITLE)) {
      cancelExchangeRename();
      return;
    }

    const { error } = await supabase
      .from('exchange_diets')
      .update({ title: nextTitle })
      .eq('id', plan.id);

    if (error) {
      logger.error('Error renombrando plan por intercambios', { error: errorMessage(error) });
      toast({
        title: 'No se pudo actualizar el nombre',
        description: error.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    setExchangePlans((current) => {
      const next = current.map((entry) => (
        entry.id === plan.id ? { ...entry, title: nextTitle } : entry
      ));
      writePatientExchangePlansCache(patient.id, next);
      return next;
    });
    cancelExchangeRename();
    toast({
      title: 'Nombre actualizado',
      description: 'El plan por intercambios se renombró correctamente.',
    });
  };

  const handleSaveDietToCatalog = async (plan: DietPlan, name?: string): Promise<void> => {
    if (!user?.id) return;

    const payload = {
      nutritionist_id: user.id,
      title: (name && name.trim()) || plan.title || `Dieta ${plan.date || 'sin fecha'}`,
      patient_id: null,
      patient_name: '',
      date: plan.date,
      target_calories: plan.target_calories || patient.target_calories || 2000,
      target_protein: plan.target_protein || patient.target_protein || 150,
      target_carbs: plan.target_carbs || patient.target_carbs || 250,
      target_fat: plan.target_fat || patient.target_fat || 65,
      meals: cloneMeals(plan.meals),
      is_catalog: true,
    };

    const { error } = await supabase.from('diet_plans').insert([payload]);

    if (error) {
      logger.error('Error guardando dieta en catálogo', { error: errorMessage(error) });
      toast({
        title: 'No se pudo guardar la dieta en el catálogo',
        description: error.message || 'Intenta nuevamente.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Dieta guardada en catálogo',
      description: 'La dieta actual quedó disponible en Mis Dietas.',
    });
  };

  const calcExchangeCalories = (plan: ExchangePlan): number | null => {
    const totals = getExchangePlanTotals(plan);
    return totals.kcal ? Math.round(totals.kcal) : null;
  };

  const fallbackMacroBreakdown: ExchangeMacroBreakdown = {
    carbs: Math.round(clampPercentage(patient.macro_pct_carbs ?? 45)),
    protein: Math.round(clampPercentage(patient.macro_pct_protein ?? 30)),
    fat: Math.round(clampPercentage(patient.macro_pct_fat ?? 25)),
  };

  if (tab === 'alimentos') {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        {showMacroEditor ? (
          <div className="rounded-[16px] border border-[#e2e8f0]/80 bg-[#f8f8ff] p-3.5">
            <Requerimiento
              key={`diet-macro-${macroEditorKey}`}
              patient={patient}
              onUpdate={onUpdate}
              tab="macronutrientes"
              fixedMeasurement={pendingMeasurement}
              registerAutosave={registerMacroAutosave}
              registerManualSave={registerMacroManualSave}
              macroPresentation="diet-compact"
              hideContextStats
            />

            <div className="mt-4 flex flex-wrap justify-end gap-2.5 border-t border-slate-200/70 pt-4">
              <button
                onClick={closeMacroEditor}
                className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                {pendingAction ? 'Cancelar' : 'Cerrar'}
              </button>
              {pendingAction ? (
                <button
                  onClick={() => void handleContinueAfterMacros()}
                  className="rounded-[10px] bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
                >
                  Continuar al editor
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!showMacroEditor ? (
          <>
            {/* Sin subtítulo a propósito: «Selecciona una fecha para crear,
                reutilizar o abrir la dieta» explicaba algo que el calendario de
                debajo ya enseña solo, y le robaba peso al título. */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {/* La misma manzana que marca esta sección en el sidebar: si
                    aquí saliera otro icono, parecerían dos sitios distintos. */}
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] bg-brand-50 text-brand-500">
                  <Apple className="h-[18px] w-[18px]" />
                </span>
                <h2 className="text-[21px] font-extrabold tracking-[-0.025em] text-slate-900">Por alimentos</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Se ancla al día que esté elegido en el calendario. Ese es
                    // el arreglo: antes se ponía la fecha de hoy y se perdía la
                    // semana que el nutricionista quería imprimir.
                    setWeekPrintStart(selectedCalendarDate || todayLocalDateStr());
                    setShowWeeklyPrint(true);
                  }}
                  className="flex items-center gap-1.5 rounded-[10px] border border-brand-500/20 bg-brand-50 px-3.5 py-2 text-sm font-medium text-brand-500 transition-colors hover:bg-[#e4e9fe]"
                >
                  <Printer className="h-4 w-4" />
                  {/* El botón dice qué semana va a sacar antes de pulsarlo. */}
                  Imprimir semana {formatWeekRangeShort(weekRangeOf(selectedCalendarDate || todayLocalDateStr()))}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-slate-400">Cargando...</div>
            ) : (
              <DietCalendarView
                dietPlans={dietPlans}
                patientParam={patientParam}
                onSelectedDateChange={setSelectedCalendarDate}
                onCreateFromScratch={(date: string) => openActionOrRequestMacros({ kind: 'alimentos-nuevo', date })}
                onCopyFromDate={handleCopyFromDate}
                onDeletePlan={async (planId: string) => {
                  if (!user?.id) return;
                  // Defense-in-depth: also filter by nutritionist_id so a
                  // stolen plan id can't be deleted from another account.
                  const { error } = await supabase
                    .from('diet_plans')
                    .delete()
                    .eq('id', planId)
                    .eq('nutritionist_id', user.id);

                  if (error) {
                    logger.error('Error eliminando dieta', { error: errorMessage(error) });
                    toast({
                      title: 'No se pudo eliminar la dieta',
                      description: error.message || 'Intenta nuevamente.',
                      variant: 'destructive',
                    });
                    return;
                  }

                  toast({
                    title: 'Dieta eliminada',
                    description: 'La dieta del paciente se eliminó correctamente.',
                  });
                  await load();
                }}
              />
            )}
          </>
        ) : null}

        {showWeeklyPrint ? (
          <WeeklyPrintView
            dietPlans={dietPlans}
            patientName={patientName}
            weekStartDate={weekPrintStart}
            brandLogoUrl={user?.brandLogoUrl}
            brandName={user?.brandName}
            onClose={() => setShowWeeklyPrint(false)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      {showMacroEditor ? (
        <div className="space-y-4">
          <Requerimiento
            key={`exchange-macro-${macroEditorKey}`}
            patient={patient}
            onUpdate={onUpdate}
            tab="macronutrientes"
            fixedMeasurement={pendingMeasurement}
            registerAutosave={registerMacroAutosave}
            // Sin registerManualSave el botón "Continuar al editor" no podía forzar el guardado
            // antes de navegar: si el usuario hacía clic antes de que el autosave (debounce 700ms)
            // completara, hasMacroConfiguration(patient) aún devolvía false y bloqueaba el paso.
            registerManualSave={registerMacroManualSave}
            hideMeasurementSelector
            autoSaveOnChange
            macroPresentation="exchange-clinical"
            hideContextStats
          />

          <div className="flex flex-wrap justify-end gap-2.5 border-t border-slate-200/70 pt-4">
            <button
              onClick={closeMacroEditor}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              {pendingAction ? 'Cancelar' : 'Cerrar'}
            </button>
            {pendingAction ? (
              <button
                onClick={() => void handleContinueAfterMacros()}
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Continuar al editor
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!showMacroEditor ? (
        <>
          <section className="overflow-hidden rounded-[26px] border border-[#ebedff] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9ff_100%)] shadow-[0_24px_54px_-42px_rgba(59, 95, 235,0.24)]">
            <div className="flex flex-col gap-2.5 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-[16px] font-bold tracking-[-0.02em] text-slate-900">Por intercambios</h2>
                <p className="mt-0.5 text-[12px] font-medium text-slate-400">Elige la fecha del plan y ajusta los macronutrientes.</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-slate-300" />
                  <input
                    className="h-9 w-full min-w-[210px] rounded-[16px] border border-[#e5e8f7] bg-[#fbfcff] py-2 pl-10 pr-4 text-[13px] font-medium text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-slate-400 focus:border-[#c9c7ff] focus:bg-white focus:ring-4 focus:ring-brand-500/10 sm:w-[245px]"
                    placeholder="Buscar plan..."
                    value={searchExchange}
                    onChange={(event) => setSearchExchange(event.target.value)}
                  />
                </div>

                <button
                  onClick={() => {
                    setExchangeDraftDate(todayLocalDateStr());
                    setExchangeDraftTitle(DEFAULT_EXCHANGE_PLAN_TITLE);
                    setShowExchangeDatePrompt(true);
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#6b61ff_0%,#574af4_100%)] px-5 text-[13px] font-semibold text-white shadow-[0_16px_30px_-18px_rgba(59, 95, 235,0.8)] transition-transform hover:-translate-y-[1px] hover:bg-brand-600 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Nuevo plan</span>
                </button>
              </div>
            </div>

            <div className="border-t border-[#edf0ff] bg-[#f7f8ff] px-3.5 py-3.5 sm:px-5">
              {loading ? (
                <div className="rounded-[24px] border border-[#edf0ff] bg-white px-6 py-14 text-center text-sm font-medium text-slate-400">Cargando...</div>
              ) : filteredExchange.length === 0 ? (
                <div className="rounded-[24px] border border-[#edf0ff] bg-white px-6 py-14 text-center">
                  <ArrowRightLeft className="mx-auto mb-4 h-12 w-12 text-[#d3d9f5]" />
                  <p className="text-sm font-medium text-slate-400">{searchExchange ? 'No se encontraron planes con ese nombre o fecha' : 'No hay planes por intercambios para este paciente'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredExchange.map((plan) => (
                    <ExchangePlanCard
                      key={plan.id}
                      plan={plan}
                      active={isLatest(plan)}
                      kcal={calcExchangeCalories(plan)}
                      mealCount={getExchangeMeals(plan).length}
                      macroBreakdown={buildExchangeMacroBreakdown(plan, fallbackMacroBreakdown)}
                      patientParam={patientParam}
                      formatDate={formatDate}
                      isEditing={editingExchangePlanId === plan.id}
                      editingTitle={editingExchangeTitle}
                      onEditingTitleChange={setEditingExchangeTitle}
                      onStartRename={() => startExchangeRename(plan)}
                      onSaveRename={() => void saveExchangeRename(plan)}
                      onCancelRename={cancelExchangeRename}
                      onDuplicate={() => void handleDuplicateExchange(plan)}
                      onRequestDelete={() => setExchangePlanToDelete(plan.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      <ConfirmationDialog
        open={Boolean(exchangePlanToDelete)}
        onOpenChange={(open: boolean) => {
          if (!open) setExchangePlanToDelete(null);
        }}
        title="Eliminar plan por intercambios"
        description="Esta acción quitará el plan del historial del paciente."
        confirmLabel="Eliminar"
        onConfirm={() => exchangePlanToDelete && void handleDeleteExchange(exchangePlanToDelete)}
      />

      <DatePromptModal
        open={showExchangeDatePrompt}
        title="Crear plan por intercambios"
        value={exchangeDraftDate}
        planName={exchangeDraftTitle}
        onChange={setExchangeDraftDate}
        onPlanNameChange={setExchangeDraftTitle}
        onClose={() => setShowExchangeDatePrompt(false)}
        onConfirm={() => {
          const nextExchangeTitle = exchangeDraftTitle.trim() || DEFAULT_EXCHANGE_PLAN_TITLE;
          setShowExchangeDatePrompt(false);
          openActionOrRequestMacros({ kind: 'intercambios-nuevo', date: exchangeDraftDate || todayLocalDateStr(), title: nextExchangeTitle });
        }}
        confirmLabel="Continuar"
      />
    </div>
  );
}