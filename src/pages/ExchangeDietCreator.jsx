import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPatientDetailUrl } from "@/utils";
import { supabase } from "@/api/supabaseClient";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  hydrateExchangeGroupsRuntime,
  subscribeToExchangeGroupsHydration,
} from "@/lib/exchangeRuntime";
import {
  EXCHANGE_GROUPS,
  DEFAULT_GROUP_KEYS,
  calcTotals,
} from "../components/exchanges/exchangeData";
import { useAutosaveOnLeave } from "@/hooks/useAutosaveOnLeave";
import { useIsMobile } from "@/hooks/use-mobile";
import { todayLocalDateStr } from "@/lib/weekRange";

// Lógica pura del plan por intercambios -> @/lib/exchangePlan
import {
  generateId,
  MAX_SCENARIO_NAME,
  MAX_SCENARIOS,
  DEFAULT_EXCHANGE_PLAN_TITLE,
  reorderItems,
  getOrderedGroups,
  buildPatientDisplayName,
  buildDefaultSelections,
  normalizeScenario,
  normalizeLoadedScenarios,
  resolveMeasurementForPlanDate,
  buildPlanSnapshot,
} from "@/lib/exchangePlan";

import { buildMacroTargetsFromPatient } from "@/lib/dietPlan";
// Componentes de UI extraídos a @/components/exchanges
import ResumenPanel from "@/components/exchanges/ResumenPanel";
import { buildExchangePrintHtml } from "@/lib/exchangePrint";
import { openHtmlPrintPreview } from "@/lib/htmlPrintPreview";
import { htmlToPdfFile } from "@/lib/pdfFromHtml";
import { resolvePatientWhatsapp } from "@/lib/fichaWhatsapp";
import { sendDietViaWhatsApp } from "@/lib/shareDietWhatsApp";
import { isSessionFichaId, resolveSessionPatientId, SESSION_FICHA_ID } from "@/lib/sessionFicha";
import ExchangeFoodIndications from "@/components/exchanges/ExchangeFoodIndications";
import ExchangeTable from "@/components/exchanges/ExchangeTable";
import ExchangeToolbar from "@/components/exchanges/ExchangeToolbar";
import ScenarioTabsBar from "@/components/exchanges/ScenarioTabsBar";
import ExchangeMacroEditorModal from "@/components/exchanges/ExchangeMacroEditorModal";
import { logger, errorMessage } from '@/lib/logger';

// ─── Main page ───────────────────────────────────────────────────────────────
export default function ExchangeDietCreator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const urlParams = new URLSearchParams(window.location.search);
  const initialPlanId = urlParams.get("planId") || "";
  const rawPatientId = urlParams.get("patientId") || "";
  const patientId = resolveSessionPatientId(rawPatientId);
  const isSessionPatient = isSessionFichaId(rawPatientId);
  const patientName = urlParams.get("patientName") || "Paciente";
  const targetKcal = parseInt(urlParams.get("targetCal") || "2000");
  const requestedDate = urlParams.get("date") || "";
  const initialDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayLocalDateStr();
  const initialTitle = (urlParams.get("title") || "").trim() || DEFAULT_EXCHANGE_PLAN_TITLE;
  const initialScenariosRef = useRef(null);

  if (!initialScenariosRef.current) {
    initialScenariosRef.current = [normalizeScenario()];
  }

  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(initialDate);
  const [scenarios, setScenarios] = useState(() => initialScenariosRef.current);
  const [activeScenarioId, setActiveScenarioId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  // Tick que se incrementa cuando termina la hidratación del catálogo desde Supabase.
  // Sirve para forzar un re-render local que recalcule los useMemo dependientes de los grupos.
  const [, setCatalogVersion] = useState(0);
  const [tab, setTab] = useState("tabla");
  const [currentPlanId, setCurrentPlanId] = useState(initialPlanId);
  const [resolvedPatientName, setResolvedPatientName] = useState(patientName || "Paciente");
  const [patientValidationState, setPatientValidationState] = useState(
    isSessionPatient ? "idle" : (rawPatientId ? "loading" : "idle"),
  );
  const [patientRecord, setPatientRecord] = useState(null);
  const [showMacroEditor, setShowMacroEditor] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [whatsAppBusy, setWhatsAppBusy] = useState(false);
  // Colapsar el panel de resumen nutricional en desktop (igual que "por alimentos").
  const [isDesktopSummaryCollapsed, setIsDesktopSummaryCollapsed] = useState(false);
  const [foodSearchByGroup, setFoodSearchByGroup] = useState({});
  const [draggedGroupKey, setDraggedGroupKey] = useState("");
  const [dragOverGroupKey, setDragOverGroupKey] = useState("");
  const patientToastLockRef = React.useRef(false);
  const isSavingRef = useRef(false);
  const macroAutosaveRef = useRef(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => buildPlanSnapshot({
    title: initialTitle,
    date: initialDate,
    scenarios: initialScenariosRef.current,
    activeScenarioId: "",
  }));

  // Hidrata el catálogo de intercambios desde Supabase al montar el componente y
  // se mantiene escuchando para refrescar la vista cuando el admin publique cambios.
  useEffect(() => {
    void hydrateExchangeGroupsRuntime();
    const unsubscribe = subscribeToExchangeGroupsHydration(() => {
      setCatalogVersion((tick) => tick + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (scenarios.length === 0) {
      const fallbackScenario = normalizeScenario();
      setScenarios([fallbackScenario]);
      setActiveScenarioId(fallbackScenario.key);
      return;
    }

    if (!activeScenarioId || !scenarios.some((scenario) => scenario.key === activeScenarioId)) {
      setActiveScenarioId(scenarios[0].key);
    }
  }, [activeScenarioId, scenarios]);

  const showPatientValidationToast = React.useCallback((title, description, variant = "destructive") => {
    if (patientToastLockRef.current) {
      return;
    }

    patientToastLockRef.current = true;
    toast({
      id: "exchange-diet-creator-patient-validation",
      title,
      description,
      variant,
    });

    window.setTimeout(() => {
      patientToastLockRef.current = false;
    }, 2200);
  }, []);

  const syncPlanIdInUrl = (planId) => {
    const params = new URLSearchParams(window.location.search);
    params.set("planId", planId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (!currentPlanId) return;

    supabase
      .from("exchange_diets")
      .select("*")
      .eq("id", currentPlanId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          logger.error('Error cargando plan por intercambios', { error: errorMessage(error) });
          toast({
            title: "No se pudo cargar el plan por intercambios",
            description: error.message || "Intenta nuevamente.",
            variant: "destructive",
          });
          return;
        }

        if (!data) return;

        setTitle(data.title || DEFAULT_EXCHANGE_PLAN_TITLE);
        setDate(data.date || todayLocalDateStr());
        const nextScenarios = normalizeLoadedScenarios(data.scenarios, {
          meals: data.meals,
          active_group_keys: data.active_group_keys,
          food_list_selections: data.food_list_selections,
        });

        setScenarios(nextScenarios);
        const nextActiveScenarioId = (
          typeof data.active_scenario_key === "string" && nextScenarios.some((scenario) => scenario.key === data.active_scenario_key)
            ? data.active_scenario_key
            : nextScenarios[0].key
        );
        setActiveScenarioId(nextActiveScenarioId);
        setLastSavedSnapshot(buildPlanSnapshot({
          title: data.title || DEFAULT_EXCHANGE_PLAN_TITLE,
          date: data.date || todayLocalDateStr(),
          scenarios: nextScenarios,
          activeScenarioId: nextActiveScenarioId,
        }));
      });
  }, [currentPlanId]);

  const currentSnapshot = useMemo(() => buildPlanSnapshot({
    title,
    date,
    scenarios,
    activeScenarioId,
  }), [activeScenarioId, date, scenarios, title]);

  const hasUnsavedChanges = currentSnapshot !== lastSavedSnapshot;

  useEffect(() => {
    if (hasUnsavedChanges) {
      setSaved(false);
    }
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let cancelled = false;

    const loadPatientContext = async () => {
      if (isSessionPatient) {
        setPatientRecord(null);
        setResolvedPatientName(patientName || "Paciente");
        setPatientValidationState("idle");
        return;
      }

      if (!rawPatientId) {
        setPatientRecord(null);
        setResolvedPatientName(patientName || "Paciente");
        setPatientValidationState("idle");
        return;
      }

      if (!user?.id) {
        setPatientValidationState("loading");
        return;
      }

      setPatientValidationState("loading");

      // La validación debe reflejar el acceso resuelto por RLS, no un filtro
      // adicional en frontend que puede ser más restrictivo de lo real.
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", rawPatientId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        logger.error('Error cargando contexto del paciente', { error: errorMessage(error) });
        setPatientRecord(null);
        setResolvedPatientName("");
        setPatientValidationState("invalid");
        return;
      }

      if (!data) {
        setPatientRecord(null);
        setResolvedPatientName("");
        setPatientValidationState("invalid");
        return;
      }

      setPatientRecord(data);
      setResolvedPatientName(buildPatientDisplayName(data) || patientName || "Paciente");
      setPatientValidationState("valid");
    };

    void loadPatientContext();

    return () => {
      cancelled = true;
    };
  }, [isSessionPatient, patientId, patientName, rawPatientId, user?.id]);

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.key === activeScenarioId) || scenarios[0] || null,
    [activeScenarioId, scenarios]
  );
  const activeMeasurement = useMemo(
    () => resolveMeasurementForPlanDate(patientRecord?.measurements, date),
    [date, patientRecord]
  );
  const resolvedTargetKcal = activeMeasurement?.requirement?.target_calories || patientRecord?.target_calories || targetKcal;
  // Objetivos de macros REALES del paciente (target_carbs/protein/fat guardados
  // en su requerimiento) para el panel lateral. Antes el panel los recalculaba
  // con un split fijo 55/15/30 e ignoraba lo que el nutricionista establecía.
  const resolvedMacroTargets = useMemo(
    () => buildMacroTargetsFromPatient(patientRecord, activeMeasurement, resolvedTargetKcal),
    [patientRecord, activeMeasurement, resolvedTargetKcal],
  );
  const meals = activeScenario?.meals || [];
  const activeGroupKeys = activeScenario?.active_group_keys || DEFAULT_GROUP_KEYS;
  const selections = activeScenario?.food_list_selections || buildDefaultSelections();
  const activeGroups = useMemo(() => getOrderedGroups(activeGroupKeys), [activeGroupKeys]);
  const allUsedFoodGroups = useMemo(
    () => EXCHANGE_GROUPS.filter((group) => scenarios.some((scenario) => {
      if (!(scenario.active_group_keys || []).includes(group.key)) {
        return false;
      }

      return (scenario.meals || []).some((meal) => parseFloat(meal.exchanges?.[group.key] || 0) > 0);
    })),
    [scenarios]
  );
  const mergedFoodSelections = useMemo(
    () => allUsedFoodGroups.reduce((acc, group) => {
      const selectedIds = new Set();

      scenarios.forEach((scenario) => {
        if (!(scenario.active_group_keys || []).includes(group.key)) return;

        const scenarioSelections = scenario.food_list_selections || buildDefaultSelections();
        (scenarioSelections[group.key] || []).forEach((foodId) => selectedIds.add(foodId));
      });

      return {
        ...acc,
        [group.key]: Array.from(selectedIds),
      };
    }, {}),
    [allUsedFoodGroups, scenarios]
  );
  const totals = useMemo(() => calcTotals(meals, activeGroups), [meals, activeGroups]);

  const groupColTotals = activeGroups.map(g => ({
    group: g,
    total: meals.reduce((s, m) => s + parseFloat(m.exchanges?.[g.key] || 0), 0)
  }));
  const isCompactTable = activeGroups.length >= 7;
  const isUltraCompactTable = activeGroups.length >= 9;
  // Ancho de la primera columna. Antes seguía SOLO al número de grupos, sin
  // mirar la pantalla: con pocos grupos pedía 228 px, que en un celular de 393
  // son el 58 % del ancho y dejaban sitio para apenas dos columnas de datos.
  //
  // No se resuelve con un interruptor "móvil sí / móvil no": eso deja mal justo
  // los tamaños intermedios (una tablet de 700 px o una ventana a media
  // pantalla). Se usa `clamp`, que es continuo: la columna pide el 30 % del
  // ancho disponible, nunca baja de 112 px —lo justo para el nombre de la
  // comida y su hora— y nunca pasa del ancho cómodo de escritorio.
  //
  //   393 px  → 118 px   ·  600 px → 180 px  ·  ≥760 px → el máximo de siempre
  //
  // La columna es fija (sticky) en pantallas estrechas, así que al desplazarse
  // de lado se sigue viendo a qué comida corresponde cada fila.
  const firstColumnMax = isUltraCompactTable ? 156 : isCompactTable ? 178 : 228;
  const firstColumnWidth = `clamp(100px, 26vw, ${firstColumnMax}px)`;

  const updateActiveScenario = (updater) => {
    if (!activeScenario) return;

    setScenarios((current) => current.map((scenario) => {
      if (scenario.key !== activeScenario.key) return scenario;
      return normalizeScenario(updater(scenario));
    }));
  };

  const updateExchange = (mealId, groupKey, val) =>
    updateActiveScenario((scenario) => ({
      ...scenario,
      meals: (scenario.meals || []).map((meal) => meal.id === mealId ? { ...meal, exchanges: { ...meal.exchanges, [groupKey]: val } } : meal),
    }));

  const addMeal = () => updateActiveScenario((scenario) => ({
    ...scenario,
    meals: [...(scenario.meals || []), {
      id: generateId(), name: `Comida ${(scenario.meals || []).length + 1}`, time: "",
      exchanges: EXCHANGE_GROUPS.reduce((acc, g) => ({ ...acc, [g.key]: 0 }), {})
    }],
  }));

  const removeMeal = (id) => updateActiveScenario((scenario) => ({
    ...scenario,
    meals: (scenario.meals || []).filter((meal) => meal.id !== id),
  }));
  const addGroup = (key) => {
    if (activeGroupKeys.includes(key)) return;
    updateActiveScenario((scenario) => ({
      ...scenario,
      active_group_keys: [...(scenario.active_group_keys || []), key],
    }));
  };
  const removeGroup = (key) => updateActiveScenario((scenario) => ({
    ...scenario,
    active_group_keys: (scenario.active_group_keys || []).filter((groupKey) => groupKey !== key),
  }));

  const reorderActiveGroups = (sourceKey, destinationKey) => {
    if (!sourceKey || !destinationKey || sourceKey === destinationKey) return;

    updateActiveScenario((scenario) => {
      const groupKeys = [...(scenario.active_group_keys || [])];
      const sourceIndex = groupKeys.indexOf(sourceKey);
      const destinationIndex = groupKeys.indexOf(destinationKey);

      if (sourceIndex === -1 || destinationIndex === -1 || sourceIndex === destinationIndex) {
        return scenario;
      }

      // El orden de active_group_keys es la fuente de verdad para render y guardado.
      return {
        ...scenario,
        active_group_keys: reorderItems(groupKeys, sourceIndex, destinationIndex),
      };
    });
  };

  const moveGroupByOffset = (groupKey, direction) => {
    updateActiveScenario((scenario) => {
      const groupKeys = [...(scenario.active_group_keys || [])];
      const sourceIndex = groupKeys.indexOf(groupKey);
      const destinationIndex = sourceIndex + direction;

      if (
        sourceIndex === -1 ||
        destinationIndex < 0 ||
        destinationIndex >= groupKeys.length
      ) {
        return scenario;
      }

      return {
        ...scenario,
        active_group_keys: reorderItems(groupKeys, sourceIndex, destinationIndex),
      };
    });
  };

  const clearGroupDragState = () => {
    setDraggedGroupKey("");
    setDragOverGroupKey("");
  };

  const handleGroupDragStart = (event, groupKey) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", groupKey);
    setDraggedGroupKey(groupKey);
    setDragOverGroupKey(groupKey);
    setShowGroupPicker(false);
  };

  const handleGroupDragEnter = (groupKey) => {
    if (!draggedGroupKey || draggedGroupKey === groupKey) return;
    setDragOverGroupKey(groupKey);
  };

  const handleGroupDrop = (groupKey) => {
    reorderActiveGroups(draggedGroupKey, groupKey);
    clearGroupDragState();
  };

  const handleMoveGroupClick = (event, groupKey, direction) => {
    event.preventDefault();
    event.stopPropagation();
    moveGroupByOffset(groupKey, direction);
  };

  const updateFoodSelectionsForUsedGroups = (groupKey, nextValue) => {
    setScenarios((current) => current.map((scenario) => {
      if (!(scenario.active_group_keys || []).includes(groupKey)) {
        return scenario;
      }

      const currentSelections = scenario.food_list_selections || buildDefaultSelections();
      const currentGroup = currentSelections[groupKey] || [];
      const nextGroup = typeof nextValue === "function" ? nextValue(currentGroup, scenario) : nextValue;

      return normalizeScenario({
        ...scenario,
        food_list_selections: {
          ...currentSelections,
          [groupKey]: nextGroup,
        },
      });
    }));
  };

  const updateFoodSearch = (groupKey, value) => {
    setFoodSearchByGroup((current) => ({
      ...current,
      [groupKey]: value,
    }));
  };

  const handleDuplicateScenario = () => {
    if (!activeScenario) return;

    if (scenarios.length >= MAX_SCENARIOS) {
      toast({
        title: "Límite alcanzado",
        description: "Solo se permiten hasta 3 tablas por plan de intercambios.",
      });
      return;
    }

    const nextScenario = normalizeScenario({
      meals: activeScenario.meals,
      active_group_keys: activeScenario.active_group_keys,
      food_list_selections: activeScenario.food_list_selections,
    });
    const nextTableNumber = scenarios.length + 1;

    setScenarios((current) => [...current, nextScenario]);
    setActiveScenarioId(nextScenario.key);
    toast({
      title: `Tabla ${nextTableNumber} creada`,
      description: "Se replicó la tabla activa para que puedas ajustar otro escenario.",
    });
  };

  // El nombre viaja dentro del escenario, así que se guarda con el plan sin
  // tocar nada más: `buildPlanSnapshot` ya normaliza cada escenario, y al
  // cambiar el nombre el plan queda marcado como modificado y el autoguardado
  // se dispara solo.
  const handleRenameScenario = (scenarioKey, nextName) => {
    setScenarios((current) => current.map((scenario) => (
      scenario.key === scenarioKey
        ? { ...scenario, name: (nextName || "").trim().slice(0, MAX_SCENARIO_NAME) }
        : scenario
    )));
  };

  const handleRemoveScenario = (scenarioKey) => {
    if (scenarios.length <= 1) {
      toast({
        title: "No se puede eliminar",
        description: "El plan debe conservar al menos una tabla.",
      });
      return;
    }

    const scenarioIndex = scenarios.findIndex((scenario) => scenario.key === scenarioKey);
    if (scenarioIndex <= 0) {
      toast({
        title: "Tabla protegida",
        description: "Tabla 1 se mantiene como base del plan y no se elimina.",
      });
      return;
    }

    const nextScenarios = scenarios.filter((scenario) => scenario.key !== scenarioKey);
    const nextActiveScenario = activeScenarioId === scenarioKey
      ? nextScenarios[Math.max(0, scenarioIndex - 1)]
      : nextScenarios.find((scenario) => scenario.key === activeScenarioId) || nextScenarios[0];

    setScenarios(nextScenarios);
    setActiveScenarioId(nextActiveScenario?.key || nextScenarios[0]?.key || "");
    toast({
      title: `Tabla ${scenarioIndex + 1} eliminada`,
      description: "La tabla creada se quitó correctamente del plan.",
    });
  };

  const handlePrint = () => {
    const html = buildExchangePrintHtml({
      scenarios,
      activeScenario,
      activeGroups,
      meals,
      totalsKcal: totals.kcal,
      title,
      patientName: resolvedPatientName || patientName,
      date,
      allUsedFoodGroups,
      mergedFoodSelections,
      brandLogoUrl: user?.brandLogoUrl,
      brandName: user?.brandName,
    });
    const opened = openHtmlPrintPreview({
      html,
      title: 'Vista previa · Plan por intercambios',
      downloadName: 'plan-intercambios.html',
    });
    if (!opened) {
      toast({
        title: 'No se pudo abrir la vista previa',
        description: 'Se descargó el HTML del plan. Ábrelo para imprimir.',
        variant: 'destructive',
      });
    }
  };

  const handleWhatsApp = async () => {
    if (whatsAppBusy) return;
    setWhatsAppBusy(true);
    const phoneRaw = resolvePatientWhatsapp(
      new URLSearchParams(window.location.search).get("whatsapp"),
    );
    try {
      // Snapshot sync del HTML; el await (PDF) va dentro de sendDietViaWhatsApp
      // después de abrir la pestaña (gesto del toque).
      const html = buildExchangePrintHtml({
        scenarios,
        activeScenario,
        activeGroups,
        meals,
        totalsKcal: totals.kcal,
        title,
        patientName: resolvedPatientName || patientName,
        date,
        allUsedFoodGroups,
        mergedFoodSelections,
        brandLogoUrl: user?.brandLogoUrl,
        brandName: user?.brandName,
      });

      const result = await sendDietViaWhatsApp({
        phoneRaw,
        patientName: resolvedPatientName || patientName,
        planTitle: title,
        getPdfFile: () => htmlToPdfFile(html, `${title || 'plan-intercambios'}.pdf`),
      });

      if (!result.ok && result.reason === 'missing-phone') {
        toast({
          title: 'Falta el celular del paciente',
          description: 'En la ficha: Editar → WhatsApp / celular (ej. 999 888 777).',
          variant: 'destructive',
        });
        return;
      }
      if (!result.ok) {
        toast({
          title: 'WhatsApp abierto',
          description: result.message || 'El PDF no se generó; usa PDF / Imprimir y adjúntalo al chat.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Listo para enviar',
        description: 'Se descargó el PDF y se abrió el chat. Adjúntalo en WhatsApp.',
      });
    } finally {
      setWhatsAppBusy(false);
    }
  };

  const persistPlan = useCallback(async (origin = "manual") => {
    if (isSavingRef.current) {
      return false;
    }

    const patientValidationPending = patientId && patientValidationState === "loading";
    const patientValidationFailed = patientId && patientValidationState === "invalid";

    if (origin === "manual" && patientValidationPending) {
      showPatientValidationToast(
        "Validando paciente",
        "Seguiremos con el guardado mientras terminamos de comprobar el contexto del paciente.",
        "default"
      );
    }

    if (origin === "manual" && patientValidationFailed) {
      showPatientValidationToast(
        "No se pudo validar el paciente",
        "El plan sí se guardará, pero el paciente de la URL no pudo confirmarse con tu sesión actual."
      );
    }

    // Regla de negocio: un solo plan por intercambios por paciente y fecha.
    // Solo aplica al CREAR (insert). Al editar un plan existente no se revisa.
    // Los planes de catálogo (patient_id null) quedan fuera por el filtro de patient_id.
    if (!currentPlanId && patientId) {
      const { data: existingForDate, error: dupError } = await supabase
        .from("exchange_diets")
        .select("id")
        .eq("nutritionist_id", user?.id || null)
        .eq("patient_id", patientId)
        .eq("date", date)
        .limit(1);
      if (!dupError && existingForDate && existingForDate.length > 0) {
        if (origin === "manual") {
          toast({
            title: "Ya existe un plan por intercambios para esta fecha",
            description: "Solo puede haber un plan por intercambios por día para este paciente. Abre el existente o elige otra fecha.",
            variant: "destructive",
          });
        }
        return false;
      }
    }

    isSavingRef.current = true;
    setSaving(true);
    const normalizedTitle = title.trim() || DEFAULT_EXCHANGE_PLAN_TITLE;
    const scenarioPayload = scenarios.map((scenario) => normalizeScenario(scenario));
    const payload = {
      nutritionist_id: user?.id || null,
      title: normalizedTitle,
      patient_id: patientId || SESSION_FICHA_ID,
      patient_name: resolvedPatientName || patientName,
      date,
      meals,
      food_list_selections: selections,
      active_group_keys: activeGroupKeys,
      scenarios: scenarioPayload,
      active_scenario_key: activeScenario?.key || null,
    };

    // Defense-in-depth: scope the UPDATE to the current nutritionist so a
    // stolen plan id can never be exploited to overwrite someone else's
    // exchange plan from an authenticated session.
    const result = currentPlanId
      ? await supabase.from("exchange_diets").update(payload).eq("id", currentPlanId).eq("nutritionist_id", user.id).select().single()
      : await supabase.from("exchange_diets").insert([payload]).select().single();

    if (result.error) {
      logger.error('Error guardando plan por intercambios', { error: result.error?.message });
      isSavingRef.current = false;
      setSaving(false);
      if (origin === "manual") {
        toast({
          title: "No se pudo guardar el plan por intercambios",
          description: result.error.message || "Intenta nuevamente.",
          variant: "destructive",
        });
      }
      return false;
    }

    if (!currentPlanId && result.data?.id) {
      setCurrentPlanId(result.data.id);
      syncPlanIdInUrl(result.data.id);
    }

    if (title !== normalizedTitle) {
      setTitle(normalizedTitle);
    }

    setLastSavedSnapshot(buildPlanSnapshot({
      title: normalizedTitle,
      date,
      scenarios: scenarioPayload,
      activeScenarioId: activeScenario?.key || activeScenarioId,
    }));
    isSavingRef.current = false;
    setSaving(false);

    if (origin === "manual") {
      setSaved(true);
      toast({ title: "Plan guardado", description: "Los cambios se guardaron correctamente." });
      window.setTimeout(() => setSaved(false), 3000);
    }

    return true;
  }, [activeGroupKeys, activeScenario?.key, activeScenarioId, currentPlanId, date, meals, patientId, patientName, patientValidationState, resolvedPatientName, scenarios, selections, showPatientValidationToast, title, user?.id]);

  const flushAutosave = useAutosaveOnLeave({
    hasUnsavedChanges,
    onAutosave: () => persistPlan("autosave"),
  });

  useEffect(() => {
    if (!hasUnsavedChanges || saving) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void persistPlan("autosave");
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [hasUnsavedChanges, persistPlan, saving]);

  // Se retiró `handleSave`: era el manejador del botón "Guardar" de la barra,
  // que ya no existe porque el plan se autoguarda solo. `persistPlan` sigue
  // siendo quien graba, llamado desde el autoguardado.
  const handlePatientRequirementUpdate = useCallback(async (updates) => {
    if (!patientId) return;

    const { data, error } = await supabase
      .from("patients")
      .update(updates)
      .eq("id", patientId)
      .select("*")
      .single();

    if (error) {
      logger.error('Error actualizando macros del paciente desde intercambios', { error: errorMessage(error) });
      toast({
        title: "No se pudieron actualizar los macronutrientes",
        description: error.message || "Intenta nuevamente.",
        variant: "destructive",
      });
      return;
    }

    setPatientRecord(data);
    setResolvedPatientName(buildPatientDisplayName(data) || patientName || "Paciente");
  }, [patientId, patientName]);

  const handleCloseMacroEditor = async () => {
    if (macroAutosaveRef.current) {
      await macroAutosaveRef.current();
    }

    setShowMacroEditor(false);
  };

  const handleBackToPatient = async () => {
    try {
      sessionStorage.setItem("ng_lite_ficha_tab", "intercambios");
    } catch {
      /* ignore */
    }
    void flushAutosave();
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/app");
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,#ffffff_0%,#f5f4ff_36%,#eef4ff_100%)]">
      {tab === "tabla" ? (
        <div className={`hidden flex-shrink-0 flex-col overflow-hidden border-r border-[#e8e5ff] bg-[#fcfbff] transition-[width] duration-200 xl:flex ${isDesktopSummaryCollapsed ? 'w-[4.25rem]' : 'w-[280px]'}`}>
          <ResumenPanel
            totals={totals}
            targetKcal={resolvedTargetKcal}
            macroTargets={resolvedMacroTargets}
            activeGroups={activeGroups}
            groupColTotals={groupColTotals}
            meals={meals}
            date={date}
            collapsed={isDesktopSummaryCollapsed}
            onToggleCollapse={() => setIsDesktopSummaryCollapsed((current) => !current)}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

      {/* ── Header ── */}
      <ExchangeToolbar
        isMobile={isMobile}
        patientId={patientId}
        patientRecord={patientRecord}
        date={date}
        setDate={setDate}
        tab={tab}
        setTab={setTab}
        onBack={() => void handleBackToPatient()}
        onShowMacroEditor={() => setShowMacroEditor(true)}
        onPrint={handlePrint}
        onWhatsApp={() => void handleWhatsApp()}
        whatsAppBusy={whatsAppBusy}
        onShowMobileSummary={() => setShowMobileSummary(true)}
      />

      {isMobile && showMobileSummary ? (
        <>
          <button type="button" className="fixed inset-0 z-30 bg-slate-950/35" onClick={() => setShowMobileSummary(false)} aria-label="Cerrar resumen" />
          <div className="fixed inset-y-0 left-0 z-40 w-[18rem] max-w-[85vw] border-r border-slate-200 bg-white shadow-2xl md:hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <p className="text-[15px] font-bold text-slate-700">Resumen del Día</p>
              <button
                type="button"
                onClick={() => setShowMobileSummary(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 transition hover:bg-slate-50"
                aria-label="Cerrar resumen"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="h-[calc(100%-73px)] overflow-y-auto">
              <ResumenPanel
                totals={totals}
                targetKcal={resolvedTargetKcal}
                macroTargets={resolvedMacroTargets}
                activeGroups={activeGroups}
                groupColTotals={groupColTotals}
                meals={meals}
                date={date}
              />
            </div>
          </div>
        </>
      ) : null}

      {showMacroEditor && patientRecord ? (
        <ExchangeMacroEditorModal
          date={date}
          patient={patientRecord}
          activeMeasurement={activeMeasurement}
          onClose={() => void handleCloseMacroEditor()}
          onUpdate={handlePatientRequirementUpdate}
          registerAutosave={(handler) => { macroAutosaveRef.current = handler; }}
        />
      ) : null}

      {tab === "tabla" ? (
        <ScenarioTabsBar
          isCompactTable={isCompactTable}
          scenarios={scenarios}
          activeScenario={activeScenario}
          setActiveScenarioId={setActiveScenarioId}
          handleRemoveScenario={handleRemoveScenario}
          handleDuplicateScenario={handleDuplicateScenario}
          handleRenameScenario={handleRenameScenario}
        />
      ) : null}

      {tab === "tabla" ? (
        <ExchangeTable
          isMobile={isMobile}
          firstColumnWidth={firstColumnWidth}
          isCompactTable={isCompactTable}
          isUltraCompactTable={isUltraCompactTable}
          showGroupPicker={showGroupPicker}
          setShowGroupPicker={setShowGroupPicker}
          activeGroupKeys={activeGroupKeys}
          addGroup={addGroup}
          activeGroups={activeGroups}
          draggedGroupKey={draggedGroupKey}
          dragOverGroupKey={dragOverGroupKey}
          removeGroup={removeGroup}
          handleGroupDragEnter={handleGroupDragEnter}
          handleGroupDragStart={handleGroupDragStart}
          clearGroupDragState={clearGroupDragState}
          handleGroupDrop={handleGroupDrop}
          handleMoveGroupClick={handleMoveGroupClick}
          meals={meals}
          updateActiveScenario={updateActiveScenario}
          updateExchange={updateExchange}
          removeMeal={removeMeal}
          addMeal={addMeal}
          groupColTotals={groupColTotals}
        />
      ) : (
        /* ── Alimentos tab (extraído a ExchangeFoodIndications) ── */
        <ExchangeFoodIndications
          allUsedFoodGroups={allUsedFoodGroups}
          mergedFoodSelections={mergedFoodSelections}
          foodSearchByGroup={foodSearchByGroup}
          updateFoodSearch={updateFoodSearch}
          updateFoodSelectionsForUsedGroups={updateFoodSelectionsForUsedGroups}
        />
      )}
      </div>
    </div>
  );
}