import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock3, Filter, Flame, Minus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { MET_CATALOG, type MetCatalogItem } from './metCatalog.generated';
import type {
  MetCalculatorProps,
  MetDay,
  NafMode,
  QuickTemplate,
  SelectedActivity,
} from './metCalculator/types';
import {
  buildAverageCalculation,
  calcMetCorregido,
  calculateDayMetrics,
  CATEGORIES,
  CATEGORY_PRIORITY,
  createMetDay,
  DEFAULT_WEEK_DAYS,
  EMPTY_DAY_METRICS,
  ACTIVITY_GROUPS,
  getActivityGroup,
  getCategoryChipClassName,
  getCategoryLabel,
  getNextDayNumber,
  getWeekDays,
  getMaxWeekDaysFor,
  applyWeekDaysChange,
  MAX_MET_DAYS,
  normalizeSearchValue,
  QUICK_DURATION_OPTIONS,
  QUICK_TEMPLATES,
  resolveTemplateActivities,
  roundToOne,
} from './metCalculator/logic';

// =============================================================================
// Calculador de NAF por compendio MET
// =============================================================================
// Sirve para responder una sola pregunta: ¿cuánto multiplica la actividad
// física al gasto basal de este paciente? Ese multiplicador (NAF, nivel de
// actividad física) es lo que después convierte el GEB en gasto total.
//
// CÓMO SE LLEGA AL NÚMERO
//
//   1. El nutricionista arma un DÍA TIPO eligiendo actividades del compendio
//      MET (metCatalog.generated.ts) y asignándoles horas y minutos.
//   2. Cada actividad aporta MET × horas. Un MET es el gasto en reposo, así que
//      caminar a 4 MET durante 1 h "cuesta" 4 MET·h.
//   3. NAF = Σ (MET · h) / 24. Se divide entre 24 porque el día tipo debe
//      cubrir las 24 horas: por eso las plantillas rápidas suman exactamente
//      24 h, y por eso dejar horas sin asignar SUBESTIMA el NAF.
//   4. Ese NAF multiplica el GEB y da el gasto total del día.
//
// NO SE CLASIFICA EL NAF EN CATEGORÍAS. Había una escala (Sedentario, Ligero,
// Moderado…) y se retiró porque no se pudo citar su origen: sus cortes no
// coinciden con los de la FAO/OMS/UNU ni con ninguna referencia identificable.
// El NAF numérico se defiende solo, porque sale de las horas que el propio
// nutricionista cargó; una etiqueta clínica sin respaldo, no.
//
// MET BASE vs MET CORREGIDO
//
// El compendio asume que 1 MET = 1 kcal por kg y por hora, una convención que
// vale para un adulto promedio. Si se conoce el GEB real del paciente y su
// peso, se puede corregir: gasto real en reposo = GEB / (24 × peso), y el MET
// corregido es met / ese valor. En pacientes con metabolismo basal alejado del
// promedio —obesidad, adulto mayor— el NAF cambia de forma apreciable.
// El interruptor "base / corregido" solo se ofrece si hay GEB y peso; si
// faltan, se usa el MET del compendio tal cual.
//
// VARIOS DÍAS
//
// Casi nadie tiene un único día tipo: se trabaja distinto de lunes a viernes
// que el fin de semana. Se pueden crear hasta MAX_MET_DAYS perfiles y el NAF
// que se aplica es el PROMEDIO PONDERADO por los días de semana que representa
// cada uno (`weekDays`, el "× N días" de cada pestaña).
//
// Era un promedio simple, y eso afirmaba sin decirlo que el paciente vive la
// misma cantidad de días en cada perfil: con "entreno" 2.10 y "normal" 1.30
// daba 1.70, como si entrenara tres días y medio a la semana. Ponderando 2 y 5
// da 1.53 — con un basal de 1701 kcal, 289 kcal diarias de diferencia. El
// reparto arranca en × 1 para todos, que reproduce el promedio simple anterior:
// ningún requerimiento ya guardado cambia de número por actualizar.
//
// Los cálculos puros viven en ./metCalculator/logic.ts; aquí solo la interfaz.
// =============================================================================
export default function MetCalculator({ weight, basalKcal, onNAFCalculated, initialDays, onDaysChange, initialNafMode, onNafModeChange, headerExtra }: MetCalculatorProps) {
  const initialDaysRef = useRef<MetDay[] | null>(null);
  if (!initialDaysRef.current) {
    initialDaysRef.current = initialDays && initialDays.length > 0 ? initialDays : [createMetDay(1)];
  }

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('Todos');
  const [days, setDays] = useState<MetDay[]>(() => initialDaysRef.current as MetDay[]);
  const [activeDayId, setActiveDayId] = useState<string>(() => (initialDaysRef.current as MetDay[])[0].id);

  // Reporta los días al contenedor para que los persista (autoguardado).
  // Se omite la primera ejecución para no marcar cambios por la siembra inicial.
  const onDaysChangeRef = useRef(onDaysChange);
  onDaysChangeRef.current = onDaysChange;
  const skipFirstDaysSync = useRef(true);
  useEffect(() => {
    if (skipFirstDaysSync.current) {
      skipFirstDaysSync.current = false;
      return;
    }
    onDaysChangeRef.current?.(days);
  }, [days]);
  const [isCategoryPanelOpen, setIsCategoryPanelOpen] = useState(false);
  // Arranca en el modo guardado, no siempre en 'base': se dejaba en "Corregido"
  // y al volver aparecía "Sin corregir", con otro NAF y otras calorías.
  const [selectedNafMode, setSelectedNafMode] = useState<NafMode>(initialNafMode || 'base');

  // Se avisa al contenedor para que lo persista con el resto del requerimiento.
  const cambiarNafMode = (mode: NafMode) => {
    setSelectedNafMode(mode);
    onNafModeChange?.(mode);
  };
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingDayLabel, setEditingDayLabel] = useState('');
  // Fila del día con los atajos de duración abiertos. Antes salían en TODAS las
  // filas a la vez y eran la mitad del ruido del panel; ahora aparecen en la que
  // se está ajustando (y en la recién agregada, que es cuando se necesitan).
  const [durationRowId, setDurationRowId] = useState<string | null>(null);
  const categoryPanelRef = useRef<HTMLDivElement | null>(null);

  const correctedAvailable = !!(basalKcal && weight);
  const normalizedSearch = useMemo(() => normalizeSearchValue(search), [search]);
  const activeDay = days.find((day) => day.id === activeDayId) || days[0];

  useEffect(() => {
    if (!days.some((day) => day.id === activeDayId) && days[0]) {
      setActiveDayId(days[0].id);
    }
  }, [days, activeDayId]);

  const categoryCounts = useMemo(() => CATEGORIES.map((category) => ({
    category,
    count: MET_CATALOG.reduce((accumulator, item) => accumulator + (item.cat === category ? 1 : 0), 0),
  })), []);

  const orderedCategoryCounts = useMemo(() => [...categoryCounts].sort((left, right) => {
    const leftPriority = CATEGORY_PRIORITY.indexOf(left.category);
    const rightPriority = CATEGORY_PRIORITY.indexOf(right.category);

    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) return 1;
      if (rightPriority === -1) return -1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    }

    return getCategoryLabel(left.category).localeCompare(getCategoryLabel(right.category), 'es', { sensitivity: 'base' });
  }), [categoryCounts]);

  const totalCatalogCount = MET_CATALOG.length;
  const selectedCategoryCount = selectedCat === 'Todos'
    ? totalCatalogCount
    : categoryCounts.find((item) => item.category === selectedCat)?.count || 0;
  const selectedCategoryLabel = selectedCat === 'Todos' ? 'Categoría' : `${getCategoryLabel(selectedCat)} (${selectedCategoryCount})`;

  const filtered = useMemo(() => {
    return MET_CATALOG.filter((item) => {
      const matchCat = selectedCat === 'Todos' || item.cat === selectedCat;
      const matchSearch = !normalizedSearch || normalizeSearchValue(item.act).includes(normalizedSearch) || normalizeSearchValue(item.cat).includes(normalizedSearch);
      return matchCat && matchSearch;
    });
  }, [normalizedSearch, selectedCat]);

  const dayMetricsEntries = useMemo(() => {
    return days.map((day) => ({
      dayId: day.id,
      metrics: calculateDayMetrics(day.activities, basalKcal, weight),
    }));
  }, [days, basalKcal, weight]);

  const dayMetricsMap = useMemo(() => new Map(dayMetricsEntries.map((entry) => [entry.dayId, entry.metrics])), [dayMetricsEntries]);

  const activeNafMode: NafMode = selectedNafMode === 'corrected' && correctedAvailable ? 'corrected' : 'base';
  const activeDayMetrics = activeDay ? dayMetricsMap.get(activeDay.id) || EMPTY_DAY_METRICS : EMPTY_DAY_METRICS;
  const activeDayCalculation = activeNafMode === 'corrected' ? activeDayMetrics.correctedCalculation : activeDayMetrics.baseCalculation;

  // Perfiles con su cálculo del modo activo y los días de semana que representan.
  const weightedEntries = useMemo(() => dayMetricsEntries.map((entry, index) => ({
    calculation: activeNafMode === 'corrected' ? entry.metrics.correctedCalculation : entry.metrics.baseCalculation,
    weekDays: getWeekDays(days[index] ?? {}),
  })), [dayMetricsEntries, activeNafMode, days]);

  // El NAF que se aplica: promedio PONDERADO por los días de semana de cada
  // perfil. Con el reparto por defecto (× 1 en todos) da lo mismo que el
  // promedio simple de siempre.
  const averageCalculation = useMemo(
    () => buildAverageCalculation(weightedEntries),
    [weightedEntries],
  );

  // El mismo promedio SIN ponderar, solo para enseñar al lado cuánto cambia el
  // reparto. Si nadie tocó los días, los dos números son iguales y no se muestra.
  const simpleAverageNaf = useMemo(
    () => buildAverageCalculation(weightedEntries.map((entry) => ({ ...entry, weekDays: DEFAULT_WEEK_DAYS }))).naf,
    [weightedEntries],
  );

  const weekDaysTotal = useMemo(() => days.reduce((accumulator, day) => accumulator + getWeekDays(day), 0), [days]);
  const isWeighted = days.length > 1 && days.some((day) => getWeekDays(day) !== DEFAULT_WEEK_DAYS);

  // Tramos de la barra de 24 h del día activo, en el orden en que se cargaron,
  // cada uno con el tipo de actividad que le da color.
  const timeline = useMemo(() => {
    const segments = (activeDay?.activities ?? []).map((activity) => {
      const hours = (activity.hours || 0) + (activity.mins || 0) / 60;
      return {
        id: activity.id,
        act: activity.act,
        met: activity.met,
        group: getActivityGroup(activity.cat),
        hours,
        pct: (hours / 24) * 100,
      };
    }).filter((segment) => segment.hours > 0);

    const used = segments.reduce((accumulator, segment) => accumulator + segment.hours, 0);

    // Horas por tipo, SIEMPRE en el orden fijo de ACTIVITY_GROUPS y solo los que
    // aparecen ese día: es la leyenda que descifra los colores de la barra.
    const byGroup = ACTIVITY_GROUPS.map((group) => ({
      group,
      hours: segments.reduce(
        (accumulator, segment) => accumulator + (segment.group.id === group.id ? segment.hours : 0),
        0,
      ),
    })).filter((entry) => entry.hours > 0.01);

    return {
      segments,
      byGroup,
      free: Math.max(0, 24 - used),
      freePct: Math.max(0, ((24 - used) / 24) * 100),
    };
  }, [activeDay]);

  // Sin peso o sin basal no se puede corregir, asi que se cae a 'base'. NO se
  // avisa al contenedor a proposito: si se guardara, se perderia la preferencia
  // real del nutricionista, que debe volver en cuanto haya datos.
  useEffect(() => {
    if (!correctedAvailable) {
      setSelectedNafMode('base');
    }
  }, [correctedAvailable]);

  useEffect(() => {
    if (!isCategoryPanelOpen) return undefined;

    const handlePointerDown = (event: MouseEvent): void => {
      if (!categoryPanelRef.current?.contains(event.target as Node)) {
        setIsCategoryPanelOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsCategoryPanelOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCategoryPanelOpen]);

  const updateDayActivities = (dayId: string, updater: (activities: SelectedActivity[]) => SelectedActivity[]): void => {
    setDays((current) => current.map((day) => (day.id === dayId ? { ...day, activities: updater(day.activities) } : day)));
  };

  const addActivity = (item: MetCatalogItem): void => {
    if (!activeDay) return;
    updateDayActivities(activeDay.id, (activities) => {
      if (activities.find((activity) => activity.id === item.id)) return activities;
      return [...activities, { ...item, hours: 0, mins: 30 }];
    });
    setDurationRowId(item.id);
    setIsCategoryPanelOpen(false);
  };

  const removeActivity = (activityId: string): void => {
    if (!activeDay) return;
    updateDayActivities(activeDay.id, (activities) => activities.filter((activity) => activity.id !== activityId));
  };

  const clearAll = (): void => {
    if (!activeDay) return;
    updateDayActivities(activeDay.id, () => []);
  };

  const applyTemplate = (template: QuickTemplate): void => {
    if (!activeDay) return;
    const nextActivities = resolveTemplateActivities(template);
    if (nextActivities.length > 0) {
      updateDayActivities(activeDay.id, () => nextActivities);
    }
  };

  const updateTime = (activityId: string, field: 'hours' | 'mins', value: string): void => {
    if (!activeDay) return;
    updateDayActivities(activeDay.id, (activities) => activities.map((activity) => (
      activity.id === activityId ? { ...activity, [field]: Math.max(0, parseInt(value, 10) || 0) } : activity
    )));
  };

  const applyQuickDuration = (activityId: string, hours: number, mins: number): void => {
    if (!activeDay) return;
    updateDayActivities(activeDay.id, (activities) => activities.map((activity) => (
      activity.id === activityId ? { ...activity, hours, mins } : activity
    )));
  };

  const addDay = (): void => {
    if (days.length >= MAX_MET_DAYS) return;
    const nextDay = createMetDay(getNextDayNumber(days));
    setDays((current) => [...current, nextDay]);
    setActiveDayId(nextDay.id);
  };

  const removeDay = (dayId: string): void => {
    setDays((current) => {
      if (current.length <= 1) return current;
      const dayIndex = current.findIndex((day) => day.id === dayId);
      const nextDays = current.filter((day) => day.id !== dayId);

      if (dayId === activeDayId) {
        const fallbackDay = nextDays[Math.max(0, dayIndex - 1)] || nextDays[0];
        if (fallbackDay) setActiveDayId(fallbackDay.id);
      }

      if (dayId === editingDayId) {
        setEditingDayId(null);
        setEditingDayLabel('');
      }

      return nextDays;
    });
  };

  // El reparto de la semana vive en ./metCalculator/logic (applyWeekDaysChange):
  // el tope no es 7 por perfil sino 7 ENTRE TODOS.
  const changeWeekDays = (dayId: string, delta: number): void => {
    setDays((current) => applyWeekDaysChange(current, dayId, delta));
  };

  const startRenamingDay = (day: MetDay): void => {
    setActiveDayId(day.id);
    setEditingDayId(day.id);
    setEditingDayLabel(day.label);
  };

  const cancelRenamingDay = (): void => {
    setEditingDayId(null);
    setEditingDayLabel('');
  };

  const commitRenamingDay = (dayId: string): void => {
    const nextLabel = editingDayLabel.trim();

    setDays((current) => current.map((day) => (
      day.id === dayId ? { ...day, label: nextLabel || day.label } : day
    )));

    cancelRenamingDay();
  };

  const handleCategorySelect = (category: string): void => {
    setSelectedCat(category);
    setIsCategoryPanelOpen(false);
  };

  const canApply = averageCalculation.naf > 0;
  const isOver24 = activeDayMetrics.totalHours > 24.01;
  const isExact24 = Math.abs(activeDayMetrics.totalHours - 24) < 0.01;
  const remaining = roundToOne(24 - activeDayMetrics.totalHours);

  // Las plantillas se ofrecen con el NAF al que llevan y con su reparto por
  // intensidad, para elegir con criterio en vez de a ciegas.
  const templatePreviews = useMemo(() => QUICK_TEMPLATES.map((template) => {
    const activities = resolveTemplateActivities(template);
    const metrics = calculateDayMetrics(activities, basalKcal, weight);
    const calculation = activeNafMode === 'corrected' ? metrics.correctedCalculation : metrics.baseCalculation;
    // El mismo reparto por tipo que la barra grande, para que la miniatura de
    // la plantilla y el día que arma después se lean con los mismos colores.
    const byGroup = ACTIVITY_GROUPS.map((group) => ({
      group,
      hours: activities.reduce(
        (accumulator, activity) => accumulator + (getActivityGroup(activity.cat).id === group.id
          ? (activity.hours || 0) + (activity.mins || 0) / 60
          : 0),
        0,
      ),
    })).filter((entry) => entry.hours > 0.01);

    return { template, naf: calculation.naf, byGroup };
  }), [basalKcal, weight, activeNafMode]);

  // Gasto del día con el NAF que se va a aplicar. Sin GEB se estima con las
  // MET·h y el peso (1 MET·h ≈ 1 kcal/kg); sin ninguno de los dos, no hay cifra.
  const gastoKcal = averageCalculation.naf > 0
    ? basalKcal
      ? Math.round(basalKcal * averageCalculation.naf)
      : weight
        ? Math.round(averageCalculation.totalMetHours * weight)
        : null
    : null;

  const handleApply = (): void => {
    if (canApply && onNAFCalculated) {
      onNAFCalculated({
        naf: averageCalculation.naf,
        factor: averageCalculation.factor,
        mode: activeNafMode,
      });
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      {/* ── Perfiles de día ──────────────────────────────────────────────────
          Cada pestaña lleva su NAF, lo lleno que está su día (la barrita) y,
          cuando hay más de uno, cuántos días de la semana representa. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {days.map((day) => {
            const metrics = dayMetricsMap.get(day.id) || EMPTY_DAY_METRICS;
            const dayCalculation = activeNafMode === 'corrected' ? metrics.correctedCalculation : metrics.baseCalculation;
            const isActive = day.id === activeDay?.id;
            const dayPct = Math.min(100, (metrics.totalHours / 24) * 100);
            const dayBarColor = metrics.totalHours > 24.01 ? 'bg-rose-400' : metrics.totalHours >= 23.99 ? 'bg-energy-500' : 'bg-brand-400';
            const dayWeek = getWeekDays(day);
            // Tope de ESTE perfil: la semana menos lo que ya ocupan los demás.
            const topeSemana = getMaxWeekDaysFor(days, day.id);

            return (
              <div
                key={day.id}
                className={`group inline-flex min-w-[128px] flex-col gap-1.5 rounded-xl border px-2.5 py-1.5 transition-colors ${isActive ? 'border-brand-300 bg-white shadow-sm ring-1 ring-brand-100' : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-1.5">
                  {editingDayId === day.id ? (
                    <input
                      type="text"
                      value={editingDayLabel}
                      onChange={(event) => setEditingDayLabel(event.target.value)}
                      onBlur={() => commitRenamingDay(day.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitRenamingDay(day.id);
                        if (event.key === 'Escape') cancelRenamingDay();
                      }}
                      autoFocus
                      className="w-24 rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs font-semibold text-brand-700 outline-none ring-2 ring-brand-100"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveDayId(day.id)}
                        onDoubleClick={() => startRenamingDay(day)}
                        title="Doble clic para renombrar"
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`}
                      >
                        <span>{day.label}</span>
                        {dayCalculation.naf > 0 ? (
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${isActive ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {dayCalculation.naf.toFixed(2)}
                          </span>
                        ) : null}
                      </button>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startRenamingDay(day);
                        }}
                        className={`rounded-full p-0.5 transition-all ${isActive ? 'text-brand-500 opacity-0 group-hover:opacity-100 hover:bg-brand-50' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500'}`}
                        aria-label={`Renombrar ${day.label}`}
                        title={`Renombrar ${day.label}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {days.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeDay(day.id)}
                          className="ml-auto text-slate-300 transition-colors hover:text-rose-400"
                          aria-label={`Eliminar ${day.label}`}
                          title={`Eliminar ${day.label}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                {/* Cuánto de las 24 h lleva cubiertas este perfil */}
                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-1 rounded-full transition-all ${dayBarColor}`} style={{ width: `${dayPct}%` }} />
                </div>

                {/* Días de la semana que representa: solo tiene sentido si hay
                    más de un perfil que promediar. */}
                {days.length > 1 ? (
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => changeWeekDays(day.id, -1)}
                      disabled={dayWeek <= DEFAULT_WEEK_DAYS}
                      aria-label={`Menos días para ${day.label}`}
                      className={`flex h-4 w-4 items-center justify-center rounded-md border transition-colors ${dayWeek <= DEFAULT_WEEK_DAYS ? 'cursor-not-allowed border-slate-100 text-slate-200' : 'border-brand-100 text-brand-600 hover:bg-brand-50'}`}
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="text-[10px] font-bold tabular-nums text-slate-500" title="Días de la semana que representa este perfil">
                      × {dayWeek} {dayWeek === 1 ? 'día' : 'días'}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeWeekDays(day.id, 1)}
                      disabled={dayWeek >= topeSemana}
                      aria-label={`Más días para ${day.label}`}
                      title={dayWeek >= topeSemana ? 'La semana ya tiene sus siete días repartidos' : undefined}
                      className={`flex h-4 w-4 items-center justify-center rounded-md border transition-colors ${dayWeek >= topeSemana ? 'cursor-not-allowed border-slate-100 text-slate-200' : 'border-brand-100 text-brand-600 hover:bg-brand-50'}`}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addDay}
            disabled={days.length >= MAX_MET_DAYS}
            title={`Máximo ${MAX_MET_DAYS} días para el promedio`}
            className={`inline-flex items-center gap-1.5 rounded-xl border border-dashed px-2.5 py-2 text-xs font-semibold transition-colors ${days.length >= MAX_MET_DAYS ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300' : 'border-brand-200 bg-white text-brand-700 hover:bg-brand-50'}`}
          >
            <Plus className="h-4 w-4" /> Añadir día
          </button>
        </div>

        {/* Estado del día activo. Con el día vacío no se muestra: la barra ya
            dice "24 h por asignar" y el contador "0 h de 24"; un tercer
            cartel diciendo lo mismo era ruido. */}
        <div className="flex flex-wrap items-center gap-2">
          {activeDayMetrics.totalHours > 0 ? (
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isOver24
                ? 'border-rose-200 bg-rose-50 text-rose-600'
                : isExact24
                  ? 'border-energy-200 bg-energy-50 text-energy-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500'}`}
            >
              {isExact24 ? <Check className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
              {isOver24
                ? 'Supera las 24 h'
                : isExact24
                  ? 'Día completo'
                  : `Faltan ${remaining} h`}
            </div>
          ) : null}
          {headerExtra}
        </div>
      </div>

      {/* Alto atado a la ventana para que TODO el calculador entre en pantalla sin
          desplazar la página: lo que se desplaza es cada lista por dentro. El
          descuento son las pestañas de la ficha, la barra del paciente, las
          pestañas de día y la barra de resultado. */}
      <div className="order-3 grid divide-y divide-slate-100 xl:order-2 xl:h-[calc(100vh-355px)] xl:min-h-[340px] xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)] xl:divide-x xl:divide-y-0">

        {/* ── Catálogo ─────────────────────────────────────────────────────── */}
        <div className="order-2 flex min-h-0 min-w-0 flex-col xl:order-1">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-800">Catálogo de actividades</p>
              <span className="tabular-nums text-[11px] font-semibold text-slate-400">
                {filtered.length === totalCatalogCount ? `${totalCatalogCount} actividades` : `${filtered.length} de ${totalCatalogCount}`}
              </span>
            </div>

            <div ref={categoryPanelRef} className="mt-2.5 space-y-2.5">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar actividad... (ej: correr, yoga)"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setIsCategoryPanelOpen((current) => !current)}
                  aria-expanded={isCategoryPanelOpen}
                  aria-haspopup="dialog"
                  className={`inline-flex h-[42px] w-full items-center justify-between rounded-xl border bg-white px-3 text-[13px] font-medium transition-all ${isCategoryPanelOpen ? 'border-slate-900 text-slate-700 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Filter className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <span className="truncate">{selectedCategoryLabel}</span>
                  </span>
                  {isCategoryPanelOpen ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-slate-500" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />}
                </button>
              </div>

              <div
                aria-hidden={!isCategoryPanelOpen}
                className={`grid transition-all duration-200 ease-out ${isCategoryPanelOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}`}
              >
                <div className="overflow-hidden">
                  <div className={`rounded-[20px] border border-slate-200 bg-slate-50/45 px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.07)] transition-transform duration-200 ease-out ${isCategoryPanelOpen ? 'translate-y-0' : '-translate-y-1'}`}>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCategorySelect('Todos')}
                        className={getCategoryChipClassName(selectedCat === 'Todos')}
                      >
                        Todas ({totalCatalogCount})
                      </button>
                      {orderedCategoryCounts.map(({ category, count }) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => handleCategorySelect(category)}
                          className={getCategoryChipClassName(selectedCat === category)}
                        >
                          {getCategoryLabel(category)} ({count})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-medium text-slate-400">Sin coincidencias</p>
                <p className="mt-1 text-xs text-slate-300">Prueba con otra búsqueda o cambia la categoría.</p>
              </div>
            ) : filtered.map((item) => {
              const isAdded = activeDay?.activities.some((activity) => activity.id === item.id);
              const metCorr = correctedAvailable ? calcMetCorregido(item.met, basalKcal as number, weight as number) : null;

              return (
                <div
                  key={item.id}
                  onDoubleClick={() => { if (!isAdded) addActivity(item); }}
                  className={`group flex items-center gap-3 border-b border-slate-50 px-4 py-2 transition-colors ${isAdded ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}
                >
                  {/* Insignia MET con la escala de intensidad del compendio */}
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[12px] font-extrabold tabular-nums ${
                    item.met >= 8 ? 'bg-coral-50 text-coral-700 ring-1 ring-coral-100'
                    : item.met >= 5 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100'
                    : item.met >= 3 ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-100'
                    : 'bg-brand-50 text-brand-600 ring-1 ring-brand-100'
                  }`}>
                    {item.met}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] leading-snug ${isAdded ? 'font-semibold text-brand-700' : 'text-slate-700'}`}>{item.act}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                      <span>{getCategoryLabel(item.cat)}</span>
                      {metCorr != null ? <span className="font-medium text-brand-600">corr. {metCorr.toFixed(2)}</span> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (!isAdded) addActivity(item); }}
                    disabled={isAdded}
                    aria-label={isAdded ? `${item.act} ya está en el día` : `Agregar ${item.act}`}
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all ${isAdded ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500 group-hover:bg-brand-500 group-hover:text-white'}`}
                  >
                    {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            Doble clic para agregar al día.
          </div>
        </div>

        {/* ── El día ───────────────────────────────────────────────────────── */}
        <div className="order-1 flex min-h-0 min-w-0 flex-col bg-slate-50/25 xl:order-2">

          {/* Barra de las 24 h: el NAF sale de repartirlas, así que es lo
              primero que se ve. El color es el de la intensidad de cada
              actividad, la misma escala que la insignia MET del catálogo. */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {activeDay?.label} · sus 24 horas
              </p>
              <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                {roundToOne(activeDayMetrics.totalHours)} h de 24 repartidas
              </span>
            </div>

            {timeline.segments.length ? (
              /* Sin texto dentro. Los nombres y las horas ya están en la lista
                 de abajo, y meterlos también aquí llenaba la barra de letra
                 diminuta y recortada. Cada bloque dice lo suyo al pasar el
                 cursor, y al pulsarlo abre esa actividad en la lista. */
              <div className="flex h-5 gap-[3px] overflow-hidden rounded-full">
                {timeline.segments.map((segment) => {
                  const isOpen = durationRowId === segment.id;
                  return (
                    <button
                      key={segment.id}
                      type="button"
                      onClick={() => setDurationRowId(isOpen ? null : segment.id)}
                      style={{ width: `${segment.pct}%`, backgroundColor: segment.group.color }}
                      title={`${segment.group.label} · ${segment.act} · ${roundToOne(segment.hours)} h · MET ${segment.met}`}
                      aria-label={`${segment.act}, ${roundToOne(segment.hours)} horas`}
                      className={`overflow-hidden transition-all hover:brightness-110 ${isOpen ? 'ring-2 ring-inset ring-slate-900' : ''}`}
                    />
                  );
                })}
                {timeline.freePct > 0.4 ? (
                  <div
                    style={{
                      width: `${timeline.freePct}%`,
                      backgroundImage: 'repeating-linear-gradient(135deg, #f1f5f9 0 6px, #e8edf3 6px 12px)',
                    }}
                    title={`Faltan ${remaining} h por asignar`}
                    className="overflow-hidden"
                  />
                ) : null}
              </div>
            ) : (
              <div
                style={{ backgroundImage: 'repeating-linear-gradient(135deg, #f1f5f9 0 6px, #e8edf3 6px 12px)' }}
                className="flex h-5 items-center justify-center rounded-full"
              >
                <span className="text-[11px] font-bold text-slate-400">24 h por asignar</span>
              </div>
            )}

            {/* Sin eje de horas (0-6-12-18-24). Parecía un reloj y no lo es: los
                bloques van en el orden en que se cargaron, no por hora del día.
                Lo que hace falta saber -cuánto se lleva repartido- está en el
                contador de arriba, y las horas de cada bloque, en la lista. */}

            {/* Leyenda: descifra los colores de la barra y, de paso, resume el
                día por tipo de actividad ("8 h de trabajo, 8 h de descanso").
                Solo salen los tipos que ese día existen, y siempre en el mismo
                orden. El texto va en tinta normal: el color lo lleva el punto,
                no la letra. */}
            <div className={`mt-1.5 flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-slate-500 ${timeline.segments.length ? 'flex' : 'hidden'}`}>
              {timeline.byGroup.map(({ group, hours }) => (
                <span key={group.id} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-4 rounded-full" style={{ backgroundColor: group.color }} />
                  {group.label} {roundToOne(hours)} h
                </span>
              ))}
              {timeline.free > 0.05 ? (
                <span className="inline-flex items-center gap-1.5 text-slate-400">
                  <span
                    className="h-2.5 w-4 rounded-full border border-slate-200"
                    style={{ backgroundImage: 'repeating-linear-gradient(135deg, #f8fafc 0 4px, #e2e8f0 4px 8px)' }}
                  /> Sin asignar {roundToOne(timeline.free)} h
                </span>
              ) : null}
            </div>
          </div>

          {activeDay?.activities.length ? (
            <>
              <div className="flex items-center justify-between gap-3 px-4 pb-1 pt-2.5">
                <p className="text-[13px] font-semibold text-slate-700">
                  {activeDay.activities.length} {activeDay.activities.length === 1 ? 'actividad' : 'actividades'} en el día
                </p>
                <button
                  type="button"
                  onClick={clearAll}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-rose-500"
                >
                  <Trash2 className="h-3 w-3" /> Vaciar
                </button>
              </div>

              <div className="min-h-0 flex-1 divide-y divide-slate-50 overflow-y-auto">
                {activeDay.activities.map((activity) => {
                  const metCorr = correctedAvailable ? calcMetCorregido(activity.met, basalKcal as number, weight as number) : null;
                  const hours = (activity.hours || 0) + (activity.mins || 0) / 60;
                  const metToUse = activeNafMode === 'corrected' ? (metCorr ?? activity.met) : activity.met;
                  const metHours = roundToOne(metToUse * hours);
                  const group = getActivityGroup(activity.cat);
                  const isOpen = durationRowId === activity.id;

                  return (
                    <div key={activity.id} className={`px-4 py-2 transition-colors ${isOpen ? 'bg-brand-50/40' : 'bg-white'}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="h-7 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: group.color }} title={group.label} />

                        <button
                          type="button"
                          onClick={() => setDurationRowId(isOpen ? null : activity.id)}
                          title={`${activity.act} — clic para los atajos de duración`}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className={`truncate text-[13px] font-semibold ${isOpen ? 'text-brand-700' : 'text-slate-800'}`}>{activity.act}</p>
                          <p className="truncate text-[11px] text-slate-400">
                            MET {activity.met}
                            {metCorr != null ? <> · corr. <span className="font-medium text-brand-600">{metCorr.toFixed(2)}</span></> : null}
                            {' · '}{getCategoryLabel(activity.cat)}
                          </p>
                        </button>

                        <div className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl border bg-white px-2 py-1 ${isOpen ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200'}`}>
                          <input
                            type="number"
                            min="0"
                            value={activity.hours}
                            onChange={(event) => updateTime(activity.id, 'hours', event.target.value)}
                            aria-label={`Horas de ${activity.act}`}
                            className="medida-input w-8 border-0 bg-transparent p-0 text-center text-[13px] font-bold tabular-nums text-slate-700 outline-none"
                          />
                          <span className="text-[11px] text-slate-400">h</span>
                          <input
                            type="number"
                            min="0"
                            max="59"
                            value={activity.mins}
                            onChange={(event) => updateTime(activity.id, 'mins', event.target.value)}
                            aria-label={`Minutos de ${activity.act}`}
                            className="medida-input w-8 border-0 bg-transparent p-0 text-center text-[13px] font-bold tabular-nums text-slate-700 outline-none"
                          />
                          <span className="text-[11px] text-slate-400">min</span>
                        </div>

                        <span className="flex-shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold tabular-nums text-brand-600">
                          {metHours.toFixed(1)} MET·h
                        </span>

                        <button
                          type="button"
                          onClick={() => removeActivity(activity.id)}
                          aria-label={`Quitar ${activity.act}`}
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {isOpen ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 pl-3.5">
                          {QUICK_DURATION_OPTIONS.map((option) => {
                            const isSelected = activity.hours === option.hours && activity.mins === option.mins;
                            return (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => applyQuickDuration(activity.id, option.hours, option.mins)}
                                className={`rounded-lg border px-2 py-0.5 text-[10.5px] font-bold transition-colors ${isSelected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300 hover:text-brand-700'}`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Día vacío: las plantillas rápidas mandan aquí, que es cuando
               sirven, con el NAF y el reparto al que llevan. */
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              <p className="text-[15px] font-bold text-slate-900">Empieza por un día tipo</p>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {templatePreviews.map(({ template, naf, byGroup }) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="group flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_6px_18px_rgba(59,95,235,0.14)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13.5px] font-bold text-slate-800 transition-colors group-hover:text-brand-700">{template.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-slate-600 transition-colors group-hover:bg-brand-50 group-hover:text-brand-700">
                        {naf.toFixed(2)}
                      </span>
                    </div>
                    {/* El reparto de intensidad dice más que cualquier frase: se
                        ve de un golpe cuánto del día es reposo y cuánto no. */}
                    <div className="flex h-2 gap-px overflow-hidden rounded-full">
                      {byGroup.map(({ group, hours }) => (
                        <span key={group.id} style={{ width: `${(hours / 24) * 100}%`, backgroundColor: group.color }} />
                      ))}
                    </div>
                    <span className="text-[11px] leading-snug text-slate-500">{template.description}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-semibold text-slate-400">o búscala en el catálogo</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Resultado ────────────────────────────────────────────────────────
          Todo lo que antes estaba repartido en cuatro tarjetas de la columna
          derecha: el NAF, las MET·h, las horas, el gasto, el modo y el botón. */}
      {/* En celular esta barra sube justo debajo de las pestañas de día: el
          cálculo es lo que se viene a ver, y dejarlo al final obligaba a
          desplazar 1111 actividades para llegar a él. En pantalla ancha vuelve
          a su sitio, al pie de las dos columnas. */}
      <div className="order-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-[#fafbfd] px-4 py-3 xl:order-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700">
              {days.length > 1
                ? `${isWeighted ? 'NAF ponderado' : 'NAF promedio'} · ${days.length} perfiles`
                : 'NAF del día'}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-[30px] font-extrabold leading-none tabular-nums text-slate-900">
                {averageCalculation.naf > 0 ? averageCalculation.naf.toFixed(2) : <span className="text-slate-300">—</span>}
              </p>
              {isWeighted && simpleAverageNaf !== averageCalculation.naf ? (
                <span className="text-[11px] font-semibold tabular-nums text-slate-400" title="Lo que daría contando todos los perfiles por igual">
                  (sin ponderar: {simpleAverageNaf.toFixed(2)})
                </span>
              ) : null}
            </div>
          </div>

          <span className="hidden h-9 w-px bg-slate-200 sm:block" />

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">MET·h{days.length > 1 ? ' promedio' : ''}</p>
            <p className="mt-0.5 text-[17px] font-extrabold tabular-nums text-slate-800">
              {(days.length > 1 ? averageCalculation.totalMetHours : activeDayCalculation.totalMetHours).toFixed(1)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {days.length > 1 ? 'Semana cubierta' : 'Horas cubiertas'}
            </p>
            {days.length > 1 ? (
              <p className={`mt-0.5 text-[17px] font-extrabold tabular-nums ${weekDaysTotal === 7 ? 'text-energy-600' : 'text-slate-800'}`}>
                {weekDaysTotal} / 7 días
              </p>
            ) : (
              <p className={`mt-0.5 text-[17px] font-extrabold tabular-nums ${isOver24 ? 'text-rose-500' : isExact24 ? 'text-energy-600' : 'text-slate-800'}`}>
                {Number.isInteger(activeDayMetrics.totalHours) ? activeDayMetrics.totalHours : activeDayMetrics.totalHours.toFixed(1)} / 24
              </p>
            )}
          </div>

          {/* El gasto en kcal es el RESULTADO de todo lo anterior: lo que el
              nutricionista se lleva a la dieta. Va destacado en su propia
              tarjeta, no como un dato más de la fila.
              Se multiplica por el NAF que se va a aplicar, NO por el "Factor
              AF": el factor es ese NAF redondeado a un escalón clásico y solo
              sirve de etiqueta. Con un NAF de 1.21 y un basal de 1742, el
              factor anunciaba 2090 kcal y al aplicarlo salían 2108. */}
          {(weight || basalKcal) ? (
            <div className="flex items-center gap-3 rounded-2xl border border-coral-200 bg-coral-50/70 px-4 py-2 shadow-[0_2px_12px_rgba(255,92,87,0.14)]">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-coral-700 ring-1 ring-coral-100">
                <Flame className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-coral-700">
                  {days.length > 1 ? 'Gasto estimado' : 'Gasto del día'}
                </p>
                <p className="mt-0.5 text-[26px] font-extrabold leading-none tabular-nums text-coral-700">
                  {gastoKcal !== null ? gastoKcal : '—'}
                  <span className="ml-1 text-[14px] font-bold">kcal</span>
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {correctedAvailable ? (
            <div
              className="flex items-center gap-1 rounded-full bg-slate-100 p-1"
              title="El MET del compendio asume 1 kcal/kg/h. Corregido lo reexpresa sobre el metabolismo real del paciente."
            >
              <button
                type="button"
                onClick={() => cambiarNafMode('base')}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${activeNafMode === 'base' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                MET del compendio
              </button>
              <button
                type="button"
                onClick={() => cambiarNafMode('corrected')}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${activeNafMode === 'corrected' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Corregido por GEB
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className={`rounded-full px-5 py-2.5 text-sm font-bold transition ${canApply ? 'bg-coral-500 text-white shadow-[0_8px_18px_rgba(255,92,87,0.28)] hover:bg-coral-600' : 'cursor-not-allowed bg-slate-100 text-slate-400'}`}
          >
            Aplicar NAF
          </button>
        </div>
      </div>
    </div>
  );
}
