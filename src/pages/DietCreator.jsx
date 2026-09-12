import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { createPatientDetailUrl } from "@/utils";
import { Plus } from "lucide-react";
import { logger, errorMessage } from '@/lib/logger';
import { calcAge } from '@/lib/anthropometry';
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import { useInspection } from "@/lib/InspectionContext";
import { listRecipes } from "@/lib/catalogData";
import { prefetchFoodCatalog } from "@/lib/foodCatalogCache";
import { track } from "@/lib/analytics";
import { calculatePlanItemTotals } from "@/lib/foodNutrients";
import LeftPanel from "@/components/diet/DietSummaryPanel";
import { findRdiGroup } from "@/lib/rdi";
import { deriveDietaryRestrictions } from "@/lib/dietaryRestrictions";
import ActiveMealCard from "@/components/diet/ActiveMealCard";
import MealTabsNav from "@/components/diet/MealTabsNav";
import DietEditorToolbar from "@/components/diet/DietEditorToolbar";
import MacroEditorModal from "@/components/diet/MacroEditorModal";
import RecallFoodSearch from "@/components/ficha/dietetica/RecallFoodSearch";
import { todayLocalDateStr } from "@/lib/weekRange";
import NutrientInspectorDrawer from "@/components/diet/NutrientInspectorDrawer";
import FoodSearchModal from "@/components/diet/FoodSearchModal";
import { buildInspectorPayload } from "@/lib/inspectorPayload";
import DietPrintView from "../components/diet/DietPrintView.tsx";
import { toast } from "@/components/ui/use-toast";
import { useAutosaveOnLeave } from "@/hooks/useAutosaveOnLeave";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildFoodPlanItem } from "@/lib/dietPlanItem";
import {
  DEFAULT_MEALS,
  DEFAULT_MEAL_IDS,
  DEFAULT_DIET_PLAN_TITLE,
  buildDietPlanSnapshot,
  generateId,
  reorderMeals,
  buildPatientDisplayName,
  resolveMeasurementForPlanDate,
  buildMacroTargetsFromPatient,
} from "@/lib/dietPlan";

// loadCollection y FoodSearch viven ahora en @/components/diet/FoodSearch;
// la llamada a la USDA, en @/lib/usdaClient
// MEAL_EMOJIS, getMealEmoji, MEAL_EMOJI_OPTIONS → @/components/diet/mealEmojis
// Helpers de "item de plan de dieta" (roundNutritionValue, buildFoodPlanItem,
// resolveQuantityForUnitChange, normalizeHouseholdMeasuresForDiet) → @/lib/dietPlanItem


// ── Left Panel ─────────────────────────────────────────────────────────────────
// LeftPanel (resumen nutricional) -> @/components/diet/DietSummaryPanel

// ── Food Search ────────────────────────────────────────────────────────────────
// FoodSearch (buscador de alimentos/recetas/USDA) -> @/components/diet/FoodSearch

// ── Added Items List ───────────────────────────────────────────────────────────
// Componentes movidos a módulos propios:
//   DeferredNumberInput, UnitSelect → @/components/diet/FoodQuantityInputs
//   MealItemRow, MealItemsList      → @/components/diet/MealItemsList



// ── Main DietCreator ───────────────────────────────────────────────────────────
export default function DietCreator() {
  const { user } = useAuth();
  // Modo inspección (titular Pro+): el editor es de SOLO LECTURA.
  const { isInspecting } = useInspection();
  const isMobile = useIsMobile();
  const urlParams      = new URLSearchParams(window.location.search);
  const patientId      = urlParams.get("patientId") || "";
  const patientNameUrl = urlParams.get("patientName") || "Paciente";
  const targetCalUrl   = parseInt(urlParams.get("targetCal")) || 2000;
  const initialDate    = urlParams.get("date") || todayLocalDateStr();
  const initialPlanId  = urlParams.get("planId") || "";

  const navigate = useNavigate();

  const [title, setTitle]                     = useState("Plan Alimentario");
  const [date, setDate]                       = useState(initialDate);
  const [meals, setMeals]                     = useState(DEFAULT_MEALS);
  // Estado de macros objetivo (editables desde el panel flotante y modal)
  const [macros, setMacros] = useState({
    calories: targetCalUrl,
    protein: Math.round(targetCalUrl * 0.15 / 4),
    carbs: Math.round(targetCalUrl * 0.55 / 4),
    fat: Math.round(targetCalUrl * 0.30 / 9),
  });
  const [targetCalories, setTargetCalories] = useState(targetCalUrl); // para compatibilidad
  const [patientRecord, setPatientRecord] = useState(null);
  const [showMacroEditor, setShowMacroEditor] = useState(false);
  const [activeMealId, setActiveMealId]       = useState(DEFAULT_MEALS[0].id);
  const [saving, setSaving]                   = useState(false);
  const [showPrint, setShowPrint]             = useState(false);
  const [currentPlanId, setCurrentPlanId]       = useState(initialPlanId);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  // Lite excludes clinical AI assistant — no showAssistant state.
  const [isDesktopSummaryCollapsed, setIsDesktopSummaryCollapsed] = useState(false);
  // Nutrient Inspector state. Holds a reference (mealId + itemId or
  // recipe instanceId), never the item itself — that way the inspector
  // re-derives from the current `meals` state and stays in sync when the
  // user edits quantity/unit while the panel is open.
  const [inspector, setInspector] = useState(null);
  // Food Search modal — opens via the floating "+ Agregar" button.
  // Stays open after each add (iterative workflow: 5-10 foods per meal).
  // Centered (NutriMind-style) instead of side drawer because the table
  // with all macro columns needs more horizontal space than a side panel.
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  // Recipes catalog — lazy-loaded the first time the user opens the
  // print view. Used to render the "Recetario" pages after the meal
  // plan. Cached for the rest of the session.
  const [printRecipes, setPrintRecipes] = useState(null);
  const [resolvedPatientName, setResolvedPatientName] = useState(patientNameUrl || "Paciente");
  const [patientValidationState, setPatientValidationState] = useState(patientId ? "loading" : "idle");
  const patientToastLockRef = useRef(false);
  const macroAutosaveRef = useRef(null);
  const isSavingRef = useRef(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() => buildDietPlanSnapshot({
    title: DEFAULT_DIET_PLAN_TITLE,
    date: initialDate,
    macros: {
      calories: targetCalUrl,
      protein: Math.round(targetCalUrl * 0.15 / 4),
      carbs: Math.round(targetCalUrl * 0.55 / 4),
      fat: Math.round(targetCalUrl * 0.30 / 9),
    },
    meals: DEFAULT_MEALS,
    patientId,
    patientName: patientNameUrl || "Paciente",
  }));

  const showPatientValidationToast = useCallback((title, description, variant = "destructive") => {
    if (patientToastLockRef.current) {
      return;
    }

    patientToastLockRef.current = true;
    toast({
      id: "diet-creator-patient-validation",
      title,
      description,
      variant,
    });

    window.setTimeout(() => {
      patientToastLockRef.current = false;
    }, 2200);
  }, []);

  const openPrintPreview = () => {
    setShowPrint(true);
  };

  // Calienta el catálogo de alimentos apenas se abre el editor (no al abrir el
  // modal): así, cuando el usuario abra el buscador por primera vez, los alimentos
  // ya están en memoria y la primera búsqueda es instantánea. El prefetch está
  // deduplicado, por lo que el propio buscador reutiliza esta misma petición.
  useEffect(() => {
    if (!user?.id) return;
    void prefetchFoodCatalog();
  }, [user?.id]);

  const syncPlanIdInUrl = useCallback((planId) => {
    const params = new URLSearchParams(window.location.search);
    params.set("planId", planId);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, []);

  useEffect(() => {
    if (!currentPlanId) return;
    supabase
      .from("diet_plans")
      .select("*")
      .eq("id", currentPlanId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          logger.error('Error cargando plan nutricional', { error: errorMessage(error) });
          toast({
            title: "No se pudo cargar la dieta",
            description: error.message || "Intenta nuevamente.",
            variant: "destructive",
          });
          return;
        }

        const plan = data;
        if (!plan) return;
        setTitle(plan.title || "Plan Alimentario");
        setDate(plan.date || initialDate);
        setTargetCalories(plan.target_calories || targetCalUrl);
        setMacros({
          calories: plan.target_calories || targetCalUrl,
          protein: plan.target_protein || Math.round((plan.target_calories || targetCalUrl) * 0.15 / 4),
          carbs: plan.target_carbs || Math.round((plan.target_calories || targetCalUrl) * 0.55 / 4),
          fat: plan.target_fat || Math.round((plan.target_calories || targetCalUrl) * 0.30 / 9),
        });
        if (Array.isArray(plan.meals) && plan.meals.length) {
          setMeals(plan.meals);
          setActiveMealId(plan.meals[0].id);
        }
        setLastSavedSnapshot(buildDietPlanSnapshot({
          title: plan.title || DEFAULT_DIET_PLAN_TITLE,
          date: plan.date || initialDate,
          macros: {
            calories: plan.target_calories || targetCalUrl,
            protein: plan.target_protein || Math.round((plan.target_calories || targetCalUrl) * 0.15 / 4),
            carbs: plan.target_carbs || Math.round((plan.target_calories || targetCalUrl) * 0.55 / 4),
            fat: plan.target_fat || Math.round((plan.target_calories || targetCalUrl) * 0.30 / 9),
          },
          meals: Array.isArray(plan.meals) && plan.meals.length ? plan.meals : DEFAULT_MEALS,
          patientId,
          patientName: patientId ? (plan.patient_name || patientNameUrl || "Paciente") : (patientNameUrl || "Paciente"),
        }));
      });
  }, [currentPlanId, initialDate, targetCalUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadPatientContext = async () => {
      if (!patientId) {
        setPatientRecord(null);
        setResolvedPatientName(patientNameUrl || "Paciente");
        setPatientValidationState("idle");
        return;
      }

      if (!user?.id) {
        setPatientValidationState("loading");
        return;
      }

      setPatientValidationState("loading");

      // La validación debe seguir las políticas RLS reales del servidor.
      // Filtrar otra vez por nutritionist_id en frontend puede marcar como inválido
      // un paciente que sí es accesible para la sesión actual.
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
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
      setResolvedPatientName(buildPatientDisplayName(data) || patientNameUrl || "Paciente");
      setPatientValidationState("valid");
    };

    void loadPatientContext();

    return () => {
      cancelled = true;
    };
  }, [patientId, patientNameUrl, user?.id]);

  const activeMeasurement = useMemo(
    () => resolveMeasurementForPlanDate(patientRecord?.measurements, date),
    [date, patientRecord]
  );

  // RDI del paciente (según edad/sexo) para comparar los micronutrientes de la dieta.
  const rdiGroup = useMemo(() => {
    // Edad EN LA FECHA DEL PLAN, no la de hoy. Los grupos de RDI van por tramos
    // de edad, así que con la edad actual un plan guardado cambia de objetivos
    // de micronutrientes al cumplir años el paciente: exactamente lo que dice
    // el comentario de aquí abajo que no debe pasar, "un plan impreso y
    // entregado a la paciente cambiaría a su espalda".
    const ageYears = calcAge(patientRecord?.birth_date, date);
    return findRdiGroup({
      ageYears: ageYears === null ? null : Math.floor(ageYears),
      sex: patientRecord?.gender || patientRecord?.sex,
    });
  }, [patientRecord, date]);

  // Restricciones dietéticas derivadas (diagnósticos + intolerancias) para recordarlas mientras se arma el plan.
  const dietaryRestrictions = useMemo(() => deriveDietaryRestrictions(patientRecord), [patientRecord]);

  // ── Objetivo del plan frente al requerimiento vigente ──────────────────────
  //
  // Un plan YA GUARDADO conserva las calorías con las que se creó, y eso es lo
  // correcto: si se recalculara solo, un plan impreso y entregado a la paciente
  // cambiaría a su espalda.
  //
  // Pero si después se recalcula el requerimiento —se aplica un NAF, se cambia
  // de fórmula, se mete un déficit— el plan se queda con el número viejo y nada
  // lo dice. Se sigue trabajando sobre un objetivo que ya no es el del paciente.
  //
  // Así que no se toca nada, pero se avisa y se ofrece actualizarlo de un clic.
  const objetivoVigente = useMemo(
    () => (patientRecord ? buildMacroTargetsFromPatient(patientRecord, activeMeasurement, null) : null),
    [patientRecord, activeMeasurement],
  );
  const objetivoDesfasado = Boolean(
    currentPlanId
    && objetivoVigente?.calories
    && macros.calories
    && Math.round(objetivoVigente.calories) !== Math.round(macros.calories),
  );

  useEffect(() => {
    if (currentPlanId || !patientRecord) {
      return;
    }

    const nextTargets = buildMacroTargetsFromPatient(patientRecord, activeMeasurement, targetCalUrl);
    setMacros(nextTargets);
    setTargetCalories(nextTargets.calories);
  }, [activeMeasurement, currentPlanId, patientRecord, targetCalUrl]);

  useEffect(() => {
    setTargetCalories(macros.calories);
  }, [macros.calories]);

  // Usar macros objetivo editables
  const targets = macros;

  const currentSnapshot = useMemo(() => buildDietPlanSnapshot({
    title,
    date,
    macros,
    meals,
    patientId,
    patientName: patientId ? resolvedPatientName : patientNameUrl,
  }), [date, macros, meals, patientId, patientNameUrl, resolvedPatientName, title]);

  const hasPersistableContent = useMemo(() => {
    if (currentPlanId) {
      return true;
    }

    const hasCustomTitle = title.trim() !== DEFAULT_DIET_PLAN_TITLE;
    const hasMealItems = meals.some((meal) => Array.isArray(meal.items) && meal.items.length > 0);
    const hasMealChanges = meals.some((meal, index) => {
      const defaultMeal = DEFAULT_MEALS[index];
      if (!defaultMeal) {
        return true;
      }

      return meal.name !== defaultMeal.name || meal.time !== defaultMeal.time;
    });

    return hasCustomTitle || hasMealItems || hasMealChanges;
  }, [currentPlanId, meals, title]);

  const hasUnsavedChanges = hasPersistableContent && currentSnapshot !== lastSavedSnapshot;

  const totals = useMemo(() => calculatePlanItemTotals(meals.flatMap((meal) => meal.items)), [meals]);

  // Lazy-load recipes catalog when the print view opens — needed by the
  // "Recetario" pages. Cached after the first load (printRecipes !== null).
  useEffect(() => {
    if (!showPrint || printRecipes !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await listRecipes(user?.id);
        if (!cancelled) setPrintRecipes(result?.data || []);
      } catch (error) {
        logger.error("No se pudieron cargar recetas para impresión", { error: error instanceof Error ? error.message : String(error) });
        if (!cancelled) setPrintRecipes([]);
      }
    })();
    return () => { cancelled = true; };
  }, [showPrint, printRecipes, user?.id]);

  // Resolves the inspector reference ({ kind, mealId, itemId?, instanceId? })
  // into a display payload by walking current `meals`. Re-runs when the user
  // edits qty/unit while the drawer is open → drawer stays in sync.
  const inspectorPayload = useMemo(() => {
    if (!inspector) return null;
    const meal = meals.find((m) => m.id === inspector.mealId);
    if (!meal) return null;

    if (inspector.kind === "recipe") {
      const items = meal.items.filter((i) => i.recipe_group?.instance_id === inspector.instanceId);
      if (items.length === 0) return null;
      const group = items[0].recipe_group;
      return buildInspectorPayload(items, {
        kind: "recipe",
        title: group?.name || "Receta",
        imageUrl: group?.image_url,
      });
    }

    const item = meal.items.find((i) => i.id === inspector.itemId);
    if (!item) return null;
    return buildInspectorPayload([item], { kind: "item" });
  }, [inspector, meals]);

  const updateMeal = useCallback((updated) => {
    setMeals(ms => ms.map(m => m.id === updated.id ? updated : m));
  }, []);

  const addMeal = () => {
    const newMeal = { id: generateId(), name: `Tiempo ${meals.length + 1}`, time: "", items: [] };
    setMeals(ms => [...ms, newMeal]);
    setActiveMealId(newMeal.id);
  };

  // Reordenar los tiempos arrastrando sus tabs. El orden del array `meals` es
  // el que se guarda, se imprime y se manda a la IA, así que mover un tab es un
  // cambio real del plan (queda "sin guardar" como cualquier otra edición).
  const handleReorderMeals = useCallback((fromIndex, toIndex) => {
    setMeals(ms => reorderMeals(ms, fromIndex, toIndex));
  }, []);

  const deleteMeal = (mealId) => {
    setMeals(ms => {
      const next = ms.filter(m => m.id !== mealId);
      if (activeMealId === mealId && next.length) setActiveMealId(next[0].id);
      return next;
    });
  };

  const handleItemAdd = (itemData) => {
    const item = { id: generateId(), ...itemData, quantity: itemData.quantity || 1 };
    setMeals(ms => ms.map(m => m.id === activeMealId ? { ...m, items: [...m.items, item] } : m));
  };

  /** Adapta el buscador de Dietética (mismo UI) al formato de ítem de dieta. */
  const handleRecallSearchAdd = (item) => {
    if (item?.source === "food" && item.food) {
      handleItemAdd(buildFoodPlanItem(item.food, item.unitQuantity ?? 100, item.unitIndex ?? 0));
      return;
    }
    // USDA u otros: ya vienen con macros listos
    handleItemAdd({
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sodium: item.sodium,
      totalGrams: item.totalGrams,
    });
  };

  const persistPlan = useCallback(async (origin = "manual") => {
    if (isSavingRef.current || (origin === "autosave" && !hasPersistableContent)) {
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
        "La dieta sí se guardará, pero el paciente de la URL no pudo confirmarse con tu sesión actual."
      );
    }

    // Regla de negocio: una sola dieta por alimentos por paciente y fecha.
    // Solo aplica al CREAR (insert). Al editar un plan existente no se revisa.
    // Las dietas de catálogo (patient_id null) quedan fuera por el filtro de patient_id.
    if (!currentPlanId && patientId) {
      const { data: existingForDate, error: dupError } = await supabase
        .from("diet_plans")
        .select("id")
        .eq("nutritionist_id", user?.id || null)
        .eq("patient_id", patientId)
        .eq("date", date)
        .limit(1);
      if (!dupError && existingForDate && existingForDate.length > 0) {
        if (origin === "manual") {
          toast({
            title: "Ya existe una dieta para esta fecha",
            description: "Solo puede haber una dieta por alimentos por día para este paciente. Abre la existente o elige otra fecha.",
            variant: "destructive",
          });
        }
        return false;
      }
    }

    isSavingRef.current = true;
    setSaving(true);
    const normalizedTitle = title.trim() || DEFAULT_DIET_PLAN_TITLE;
    const data = {
      nutritionist_id: user?.id || null,
      title: normalizedTitle, patient_id: patientId, patient_name: patientId ? resolvedPatientName : patientNameUrl, date,
      target_calories: macros.calories, target_protein: macros.protein,
      target_carbs: macros.carbs, target_fat: macros.fat, meals,
    };

    // Defense-in-depth: scope the UPDATE to the current nutritionist so a
    // stolen plan id can never be exploited to overwrite someone else's
    // plan from an authenticated session. INSERT doesn't need it because
    // nutritionist_id is set inside the payload and validated by RLS.
    const result = currentPlanId
      ? await supabase.from("diet_plans").update(data).eq("id", currentPlanId).eq("nutritionist_id", user.id).select().single()
      : await supabase.from("diet_plans").insert([data]).select().single();

    if (result.error) {
      logger.error('Error guardando plan nutricional', { error: result.error?.message });
      isSavingRef.current = false;
      setSaving(false);
      if (origin === "manual") {
        toast({
          title: "No se pudo guardar la dieta",
          description: result.error.message || "Intenta nuevamente.",
          variant: "destructive",
        });
      }
      return false;
    }

    if (!currentPlanId && result.data?.id) {
      // Primera persistencia del plan (insert): activación clave del producto.
      track("diet_created");
      setCurrentPlanId(result.data.id);
      syncPlanIdInUrl(result.data.id);
    }

    if (title !== normalizedTitle) {
      setTitle(normalizedTitle);
    }

    setLastSavedSnapshot(buildDietPlanSnapshot({
      title: normalizedTitle,
      date,
      macros,
      meals,
      patientId,
      patientName: patientId ? resolvedPatientName : patientNameUrl,
    }));
    isSavingRef.current = false;
    setSaving(false);

    if (origin === "manual") {
      toast({ title: "Dieta guardada", description: "Los cambios se guardaron correctamente." });
    }

    return true;
  }, [currentPlanId, date, hasPersistableContent, macros, meals, patientId, patientNameUrl, patientValidationState, resolvedPatientName, showPatientValidationToast, syncPlanIdInUrl, title, user?.id]);

  const flushAutosave = useAutosaveOnLeave({
    hasUnsavedChanges,
    onAutosave: () => persistPlan("autosave"),
  });

  // Volver a la ficha. Guarda antes de salir (el router no dispara
  // beforeunload) y deja marcada la pestaña Dieta→Alimentos para que al
  // remontar ConsultDetail no caiga en la primera pestaña antropométrica.
  const handleBackToPatient = () => {
    try {
      sessionStorage.setItem("ng_lite_ficha_tab", "alimentos");
    } catch {
      /* private mode / quota — el navigate sigue igual */
    }
    void flushAutosave();
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/app");
    }
  };

  useEffect(() => {
    if (!hasUnsavedChanges || saving) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void persistPlan("autosave");
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [hasUnsavedChanges, persistPlan, saving]);

  const handlePatientRequirementUpdate = useCallback(async (updates) => {
    if (!patientId) return;

    const { data, error } = await supabase
      .from("patients")
      .update(updates)
      .eq("id", patientId)
      .select("*")
      .single();

    if (error) {
      logger.error('Error actualizando macros del paciente desde dieta por alimentos', { error: errorMessage(error) });
      toast({
        title: "No se pudieron actualizar los macronutrientes",
        description: error.message || "Intenta nuevamente.",
        variant: "destructive",
      });
      return;
    }

    const nextMeasurement = resolveMeasurementForPlanDate(data.measurements, date);
    const nextTargets = buildMacroTargetsFromPatient(data, nextMeasurement, targetCalUrl);
    setPatientRecord(data);
    setResolvedPatientName(buildPatientDisplayName(data) || patientNameUrl || "Paciente");
    setMacros(nextTargets);
    setTargetCalories(nextTargets.calories);
  }, [date, patientId, patientNameUrl, targetCalUrl]);

  const handleCloseMacroEditor = async () => {
    if (macroAutosaveRef.current) {
      await macroAutosaveRef.current();
    }

    setShowMacroEditor(false);
  };

  const activeMeal = meals.find(m => m.id === activeMealId);
  const activeMealCal = activeMeal
    ? Math.round(activeMeal.items.reduce((s, i) => s + (i.calories || 0) * (i.quantity || 1), 0))
    : 0;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#f8f8ff" }}>
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        /* Spinners "bajo demanda": ocultos hasta que el input recibe foco. */
        input[type=number].with-spinners::-webkit-inner-spin-button,
        input[type=number].with-spinners::-webkit-outer-spin-button {
          -webkit-appearance: inner-spin-button;
          opacity: 0;
          margin: 0;
        }
        input[type=number].with-spinners:focus::-webkit-inner-spin-button,
        input[type=number].with-spinners:focus::-webkit-outer-spin-button {
          opacity: 1;
        }
        input[type=number].with-spinners { -moz-appearance: textfield; }
        input[type=number].with-spinners:focus { -moz-appearance: number-input; }
        /* Indicador del picker de hora: visible y con cursor de mano para que
           el usuario sepa que puede hacer clic y abrir el selector. */
        input[type="time"]::-webkit-calendar-picker-indicator {
          opacity: 0.55;
          cursor: pointer;
          filter: invert(40%);
        }
        input[type="time"]:hover::-webkit-calendar-picker-indicator { opacity: 1; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>

      {/* LEFT PANEL */}

      {!isMobile ? (
        <LeftPanel totals={totals} targets={targets} meals={meals} patientId={patientId}
          rdiTargets={rdiGroup?.targets || null} rdiLabel={rdiGroup?.label || null}
          onPrint={openPrintPreview}
          collapsed={isDesktopSummaryCollapsed}
          onToggleCollapse={() => setIsDesktopSummaryCollapsed((current) => !current)} />
      ) : null}

      {isMobile && showMobileSummary ? (
        <>
          <button type="button" className="fixed inset-0 z-30 bg-slate-950/35" onClick={() => setShowMobileSummary(false)} aria-label="Cerrar resumen" />
          <div className="fixed inset-y-0 left-0 z-40 md:hidden">
            <LeftPanel
              totals={totals}
              targets={targets}
              meals={meals}
              patientId={patientId}
              rdiTargets={rdiGroup?.targets || null}
              rdiLabel={rdiGroup?.label || null}
              onPrint={openPrintPreview}
              onClose={() => setShowMobileSummary(false)}
            />
          </div>
        </>
      ) : null}

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#f8f8ff]">

        {/* ── Barra superior: título + navegación de fecha + botones de acción ── */}
        <DietEditorToolbar
          isMobile={isMobile}
          patientId={patientId}
          onBack={handleBackToPatient}
          title={title}
          onTitleChange={setTitle}
          date={date}
          onDateChange={setDate}
          onShowMobileSummary={() => setShowMobileSummary(true)}
          onShowMacroEditor={() => setShowMacroEditor(true)}
          macroEditorDisabled={!patientRecord}
          restrictions={dietaryRestrictions}
          onPrint={openPrintPreview}
          readOnly={isInspecting}
        />

        {/* Aviso de objetivo desfasado. No cambia nada por su cuenta: el
            nutricionista decide si este plan debe seguir el requerimiento nuevo
            o quedarse como está. */}
        {objetivoDesfasado && !isInspecting ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
            <p className="text-[12.5px] leading-snug text-amber-800">
              Este plan usa <strong>{Math.round(macros.calories)} kcal</strong>, pero el requerimiento
              actual del paciente es de <strong>{Math.round(objetivoVigente.calories)} kcal</strong>.
            </p>
            <button
              type="button"
              onClick={() => {
                setMacros(objetivoVigente);
                setTargetCalories(objetivoVigente.calories);
              }}
              className="whitespace-nowrap rounded-[10px] border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
            >
              Usar {Math.round(objetivoVigente.calories)} kcal
            </button>
          </div>
        ) : null}

        {/* ── Barra de progreso de calorías del día: feedback inmediato del
            avance hacia el objetivo sin tener que mirar el sidebar. ── */}
        <div className="flex-shrink-0 h-1 w-full bg-slate-100">
          <div
            className={`h-full transition-all duration-500 ${
              targets.calories > 0 && totals.calories > targets.calories
                ? "bg-coral-500"
                : "bg-gradient-to-r from-brand-500 to-brand-400"
            }`}
            style={{ width: `${targets.calories > 0 ? Math.min(Math.round((totals.calories / targets.calories) * 100), 100) : 0}%` }}
          />
        </div>

        {/* ── Tabs de tiempos de comida ── */}
        <MealTabsNav
          meals={meals}
          activeMealId={activeMealId}
          defaultMealIds={DEFAULT_MEAL_IDS}
          onSelectMeal={setActiveMealId}
          onDeleteMeal={deleteMeal}
          onAddMeal={addMeal}
          onReorderMeals={handleReorderMeals}
          readOnly={isInspecting}
        />

        {/* ── Contenido principal con scroll ──
            El pb-28 en móvil deja aire bajo el último alimento: si no, los
            botones flotantes ("Agregar alimento" y el asistente) tapan la
            última fila y no hay forma de verla. */}
        <div className="flex-1 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-6">
          <div className="max-w-4xl mx-auto space-y-4">

            {activeMeal && (
              <ActiveMealCard
                key={activeMeal.id}
                meal={activeMeal}
                mealCalories={activeMealCal}
                onUpdateMeal={updateMeal}
                onDeleteMeal={deleteMeal}
                onInspect={setInspector}
                onOpenFoodSearch={() => setFoodModalOpen(true)}
                readOnly={isInspecting}
              />
            )}

          </div>
        </div>
      </main>

      <MacroEditorModal
        open={showMacroEditor}
        patient={patientRecord}
        date={date}
        activeMeasurement={activeMeasurement}
        onClose={() => void handleCloseMacroEditor()}
        onUpdate={handlePatientRequirementUpdate}
        registerAutosave={(handler) => {
          macroAutosaveRef.current = handler;
        }}
      />

      {showPrint && (
        <DietPrintView title={title} date={date} patientName={patientNameUrl}
          meals={meals} targetCalories={targetCalories}
          recipes={printRecipes || []}
          brandLogoUrl={user?.brandLogoUrl} brandName={user?.brandName}
          onClose={() => setShowPrint(false)} />
      )}

      {/* Nutrient Inspector — overlay panel. Re-derives from `meals` on
          every change so qty/unit edits while the panel is open are
          reflected immediately. */}
      <NutrientInspectorDrawer payload={inspectorPayload} onClose={() => setInspector(null)} />

      {/* Floating Add button — always visible at viewport bottom-right
          when a meal is active. Click opens the centered FoodSearchModal;
          the modal stays open after each add so the nutritionist can
          pile up several foods without close/reopen friction. */}
      {activeMeal ? (
        <>
          {/* FAB solo cuando la comida ya tiene alimentos: si está vacía, el
              launchpad del estado vacío ya ofrece el acceso (evita botón duplicado). */}
          {activeMeal.items.length > 0 && !foodModalOpen && !isInspecting ? (
            <button
              type="button"
              onClick={() => setFoodModalOpen(true)}
              className="fixed z-40 bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] right-4 inline-flex min-h-12 touch-manipulation items-center gap-2 rounded-full bg-brand-500 px-4 py-3 text-sm font-bold text-white shadow-xl shadow-brand-500/30 transition-all hover:bg-brand-600 active:scale-95 sm:bottom-24 sm:right-6 sm:px-5"
              aria-label="Agregar alimento al tiempo de comida"
            >
              <Plus className="w-4 h-4" />
              <span className="sm:hidden">Agregar</span>
              <span className="hidden sm:inline">Agregar alimento</span>
            </button>
          ) : null}

          <FoodSearchModal
            open={foodModalOpen}
            onClose={() => setFoodModalOpen(false)}
            title={`Agregar a ${activeMeal.name}`}
          >
            <RecallFoodSearch onAdd={handleRecallSearchAdd} />
          </FoodSearchModal>
        </>
      ) : null}
    </div>
  );
}