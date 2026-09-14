import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Check, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { hydrateFoodNutrients } from "@/lib/catalogData";
import { clearFoodCatalogCache, prefetchFoodCatalog, readFoodCatalogCache } from "@/lib/foodCatalogCache";
import { isFoodVisibleForCountry } from "@/lib/countries";
import { normalizeSearchText } from "@/lib/searchText";
import { processFoodsForSearch, getFoodUnits } from "@/lib/foodDisplay";
import {
  DeferredNumberInput,
  UnitSelect,
  highlightMatch,
  scoreByRelevance,
  getDefaultQuantityForUnit,
  roundNutritionValue,
} from "@/components/foods/FoodSearchHelpers";
import FoodFormModal from "@/components/foods/FoodFormModal";
import { toast } from "@/components/ui/use-toast";
import { computeFoodItemFields } from "./recallItemFields";
import { logger, errorMessage } from '@/lib/logger';
import { searchUsdaFoods, getUsdaUnits } from "@/lib/usdaClient";
import { EquivalentGramsField } from "@/components/foods/EquivalentGramsField";
import { FoodResultsTableHead, MacroValueCell } from "@/components/foods/FoodResultsTableHead";

// ── Food Search Engine (espejo del buscador de DietCreator) ─────────────────────
// Buscador de alimentos/USDA del recordatorio 24h. Extraído de
// Recall24hEditor.jsx. Llama `onAdd(item)` al agregar un alimento.
export default function RecallFoodSearch({ onAdd }) {
  const { user } = useAuth();
  const userId = user?.id || "";
  // Arranca vacío; hidrata desde caché scopeada al userId (sin fugas entre cuentas).
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("alimentos");
  const [itemState, setItemState] = useState({});
  const [added, setAdded] = useState({});
  const [foodSearch, setFoodSearch] = useState("");
  const [usdaSearch, setUsdaSearch] = useState("");
  const [offResults, setOffResults] = useState([]);
  const [offLoading, setOffLoading] = useState(false);
  const [offSearched, setOffSearched] = useState(false);
  const [showCreateFood, setShowCreateFood] = useState(false);
  const searchTimer = useRef(null);
  // Ref para enfocar el input cuando se presiona "/" (mismo atajo que en DietCreator).
  const searchInputRef = useRef(null);

  // Atajo de teclado "/" para enfocar el buscador, igual que el creador de dietas.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const isEditable = target instanceof HTMLElement && (
        target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable
      );
      if (isEditable) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    const loadCatalog = async () => {
      const cached = readFoodCatalogCache(userId);
      if (cached?.length) {
        setFoods(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const foodsData = await prefetchFoodCatalog(userId);
        setFoods(foodsData || []);
      } catch (error) {
        logger.error('Error cargando catálogo del recordatorio 24h', { error: errorMessage(error) });
        toast({
          title: "No se pudo cargar el catálogo",
          description: error?.message || "Intenta nuevamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadCatalog();
  }, [userId]);

  useEffect(() => {
    if (tab !== "usda") return;
    if (!usdaSearch.trim()) { setOffResults([]); setOffSearched(false); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setOffLoading(true); setOffSearched(true);
      // Se conservan los 20 resultados de esta pantalla (el resto pide 25):
      // el recordatorio de 24 h se usa mucho desde el celular.
      setOffResults(await searchUsdaFoods(usdaSearch, { pageSize: 20 }));
      setOffLoading(false);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [usdaSearch, tab]);

  // Macros por 100 g + medidas caseras reales (helper compartido). El filtro por
  // país va aquí (antes se hacía al cargar): base nacional + USDA/INT + propios.
  const processedFoods = useMemo(
    () => processFoodsForSearch(foods.filter((f) => isFoodVisibleForCountry(f, user?.country, user?.id))),
    [foods, user?.country, user?.id],
  );

  // Filtrado + orden por relevancia: prefijo > palabra > inclusión. Normalizamos
  // sin tildes para que "higado" encuentre "hígado", igual que el creador de dietas.
  const filteredFoods = useMemo(() => {
    const q = normalizeSearchText(foodSearch);
    return processedFoods
      .filter((f) => normalizeSearchText(f.name).includes(q))
      .sort((a, b) => scoreByRelevance(a.name, foodSearch) - scoreByRelevance(b.name, foodSearch));
  }, [processedFoods, foodSearch]);

  const getState = (id) => itemState[id] || { quantity: 100, unitIndex: 0 };
  const getUnits = (food) => getFoodUnits(food);
  const scaleFood = (food) => {
    const st = getState(food.id);
    const units = getUnits(food);
    const unit = units[st.unitIndex] || units[0];
    const totalGrams = unit.isHousehold ? st.quantity * unit.grams : st.quantity;
    const factor = totalGrams / (food.portion_grams || 100);
    return {
      calories: Math.round((food.calories || 0) * factor * 10) / 10,
      protein: Math.round((food.protein || 0) * factor * 10) / 10,
      carbs: Math.round((food.carbs || 0) * factor * 10) / 10,
      fat: Math.round((food.fat || 0) * factor * 10) / 10,
      totalGrams, unit,
    };
  };

  const parseUSDAFood = (food) => {
    const get = (id) => { const n = food.foodNutrients?.find(n => n.nutrientId === id); return n?.value || 0; };
    return {
      calories: Math.round(get(1008) * 10) / 10,
      protein: Math.round(get(1003) * 10) / 10,
      carbs: Math.round(get(1005) * 10) / 10,
      fat: Math.round(get(1004) * 10) / 10,
      fiber: Math.round(get(1079) * 10) / 10,
      sodium: Math.round(get(1093) * 10) / 10,
    };
  };

  const handleAddFood = async (food) => {
    const st = getState(food.id);
    // Agregar al instante; hidratar micros no debe congelar el clic.
    let source = food;
    const rawLite = foods.find((f) => f.id === food.id);
    const fields = computeFoodItemFields(source, st.unitIndex, st.quantity);
    onAdd({ source: "food", food: source, name: source.name, quantity: 1, ...fields });
    setAdded((a) => ({ ...a, [food.id]: true }));
    setTimeout(() => setAdded((a) => { const c = { ...a }; delete c[food.id]; return c; }), 1500);

    if (rawLite?._lite) {
      void hydrateFoodNutrients(rawLite, user?.id).then((full) => {
        if (!full || full === rawLite) return;
        // Solo precalienta caché de detalle; el ítem ya está en la comida.
      });
    }
  };

  const currentSearch = tab === "alimentos" ? foodSearch : usdaSearch;
  const setCurrentSearch = tab === "alimentos" ? setFoodSearch : setUsdaSearch;

  const TABS = [
    { key: "alimentos", label: "Mis Alimentos", count: processedFoods.length },
    { key: "usda", label: "Base USDA", count: null },
  ];

  return (
    <div className="flex flex-col">
      {/* Tabs estilo "segmented" con contador como pill — mismo formato que DietCreator. */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 pb-3 pt-1 text-sm font-semibold transition ${
                isActive ? "text-brand-500" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
              {t.count != null ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold transition ${
                    isActive ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.count}
                </span>
              ) : null}
              {isActive ? (
                <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-t bg-brand-500" />
              ) : null}
            </button>
          );
        })}
        {tab === "alimentos" ? (
          <button
            type="button"
            onClick={() => setShowCreateFood(true)}
            className="mb-2 ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-brand-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="sm:hidden">Crear</span>
            <span className="hidden sm:inline">Crear alimento</span>
          </button>
        ) : null}
      </div>

      {/* Search con icono, atajo "/" y botón limpiar — espejo del buscador de dietas. */}
      <div className="relative mb-3">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[var(--ng-brand-600)]" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder={
            tab === "usda"
              ? "Buscar en base USDA (300k+ alimentos)..."
              : "Buscar alimento... (presiona / para enfocar)"
          }
          value={currentSearch}
          onChange={(e) => setCurrentSearch(e.target.value)}
          className="block w-full rounded-xl border border-[#dde3f0]/80 bg-[#f7f8ff] py-3 pl-12 pr-20 text-sm font-semibold text-slate-800 shadow-sm transition placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
        />
        {currentSearch ? (
          <button
            type="button"
            onClick={() => {
              setCurrentSearch("");
              searchInputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-12 flex items-center text-slate-400 hover:text-slate-600"
            aria-label="Limpiar búsqueda"
            title="Limpiar"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
          <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-sm">
            /
          </kbd>
        </div>
      </div>

      {/* Resultados: misma tabla que el creador de dietas. En celular se
          ocultan CHO/PRO/FAT (compactOnMobile) para que el botón + no se
          salga de la pantalla — era el bug reportado en móvil. */}
      {currentSearch.trim() && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <FoodResultsTableHead quantityLabel="Cant." compactOnMobile />
              <tbody className="divide-y divide-slate-100">
                {/* ALIMENTOS */}
                {tab === "alimentos" && (
                  loading ? (
                    <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-400">Cargando...</td></tr>
                  ) : filteredFoods.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-300">{foods.length === 0 ? "Sin alimentos en el catálogo" : "Sin resultados para tu búsqueda"}</td></tr>
                  ) : filteredFoods.map(food => {
                    const st = getState(food.id);
                    const units = getUnits(food);
                    const scaled = scaleFood(food);
                    const currentUnit = units[st.unitIndex] || units[0];
                    const isAdded = added[food.id];
                    // Gramos equivalentes cuando la unidad seleccionada es casera.
                    const equivalentGrams = currentUnit?.isHousehold
                      ? roundNutritionValue((Number(st.quantity) || 0) * currentUnit.grams)
                      : null;
                    return (
                      <tr key={food.id} className="group transition hover:bg-slate-50/80">
                        <td className="p-2 text-center sm:p-3">
                          <DeferredNumberInput
                            min={0}
                            step={currentUnit.isHousehold ? 0.5 : 10}
                            value={st.quantity}
                            displayPrecision={2}
                            onCommit={(v) => setItemState(s => ({ ...s, [food.id]: { ...getState(food.id), quantity: v } }))}
                            className="w-14 rounded-lg border border-slate-200 bg-white p-1.5 text-center text-sm font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 sm:w-16"
                          />
                        </td>
                        <td className="p-2 sm:p-3">
                          <p className="text-sm font-semibold leading-tight text-slate-800">{highlightMatch(food.name, foodSearch)}</p>
                          {/* Unidad + gramos equivalentes editables (mismo patrón que DietCreator) */}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {units.length > 1 ? (
                              <UnitSelect
                                options={units}
                                value={st.unitIndex}
                                onChange={(nextUnitIndex) => {
                                  const nextUnit = units[nextUnitIndex] || units[0];
                                  setItemState(s => ({
                                    ...s,
                                    [food.id]: {
                                      ...getState(food.id),
                                      unitIndex: nextUnitIndex,
                                      quantity: getDefaultQuantityForUnit(nextUnit),
                                    },
                                  }));
                                }}
                                ariaLabel={`Unidad de ${food.name}`}
                              />
                            ) : null}
                            <EquivalentGramsField
                              grams={equivalentGrams}
                              unitGrams={currentUnit?.grams}
                              onQuantityChange={(nextQuantity) =>
                                setItemState(s => ({
                                  ...s,
                                  [food.id]: { ...getState(food.id), quantity: nextQuantity },
                                }))
                              }
                            />
                          </div>
                        </td>
                        <td className="p-2 text-center text-sm font-bold tabular-nums text-slate-800 sm:p-3">{scaled.calories}</td>
                        <MacroValueCell macro="carbs" value={scaled.carbs} hideOnMobile />
                        <MacroValueCell macro="protein" value={scaled.protein} hideOnMobile />
                        <MacroValueCell macro="fat" value={scaled.fat} hideOnMobile />
                        <td className="sticky right-0 bg-white/95 p-2 text-right backdrop-blur-[2px] sm:static sm:bg-transparent sm:p-3 sm:backdrop-blur-none">
                          <button
                            type="button"
                            onClick={() => handleAddFood(food)}
                            aria-label="Añadir alimento"
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm transition hover:scale-105 ${isAdded ? "bg-emerald-500 text-white" : "bg-gradient-to-br from-brand-500 to-[#6c63ff] text-white hover:from-brand-600 hover:to-[#5b53f0]"}`}
                          >
                            {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}

                {/* USDA */}
                {tab === "usda" && (
                  offLoading ? (
                    <tr><td colSpan={7} className="p-8 text-center"><div className="flex items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Buscando en USDA...</div></td></tr>
                  ) : !offSearched ? (
                    <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-300">Escribe para buscar en la base USDA</td></tr>
                  ) : offResults.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-300">Sin resultados</td></tr>
                  ) : offResults.map(food => {
                    const parsed = parseUSDAFood(food);
                    const stateKey = `usda_${food.fdcId}`;
                    const units = getUsdaUnits(food);
                    const defaultQty = units.length > 1 ? 1 : 100;
                    const st = itemState[stateKey] || { quantity: defaultQty, unitIndex: units.length > 1 ? 1 : 0 };
                    const unit = units[st.unitIndex] || units[0];
                    const totalGrams = unit.isHousehold ? st.quantity * unit.grams : st.quantity;
                    const factor = totalGrams / 100;
                    const isAdded = added[stateKey];
                    return (
                      <tr key={food.fdcId} className="transition hover:bg-slate-50/80">
                        <td className="p-2 text-center sm:p-3">
                          <DeferredNumberInput
                            min={0}
                            step={unit.isHousehold ? 0.5 : 10}
                            value={st.quantity}
                            displayPrecision={2}
                            onCommit={(v) => setItemState(s => ({ ...s, [stateKey]: { ...st, quantity: v } }))}
                            className="w-14 rounded-lg border border-slate-200 bg-white p-1.5 text-center text-sm font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 sm:w-16"
                          />
                        </td>
                        <td className="p-2 sm:p-3">
                          <p className="text-sm font-semibold leading-tight text-slate-800">{highlightMatch(food.description, usdaSearch)}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1">
                            {units.length > 1 ? (
                              <UnitSelect
                                options={units}
                                value={st.unitIndex}
                                onChange={(nextUnitIndex) => {
                                  const nextUnit = units[nextUnitIndex] || units[0];
                                  setItemState(s => ({
                                    ...s,
                                    [stateKey]: { ...st, unitIndex: nextUnitIndex, quantity: getDefaultQuantityForUnit(nextUnit) },
                                  }));
                                }}
                                ariaLabel={`Unidad de ${food.description}`}
                              />
                            ) : (
                              <span className="text-[11px] text-slate-400">{food.brandOwner || food.dataType || "USDA"}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-center text-sm font-bold tabular-nums text-slate-800 sm:p-3">{Math.round(parsed.calories * factor)}</td>
                        <MacroValueCell macro="carbs" value={parsed.carbs * factor} hideOnMobile />
                        <MacroValueCell macro="protein" value={parsed.protein * factor} hideOnMobile />
                        <MacroValueCell macro="fat" value={parsed.fat * factor} hideOnMobile />
                        <td className="sticky right-0 bg-white/95 p-2 text-right backdrop-blur-[2px] sm:static sm:bg-transparent sm:p-3 sm:backdrop-blur-none">
                          <button
                            type="button"
                            onClick={() => {
                              const unitLabel = unit.isHousehold ? `${st.quantity} ${unit.label} (${Math.round(totalGrams)}g)` : `${st.quantity}g`;
                              onAdd({ name: food.description, quantity: 1, unit: unitLabel,
                                calories: Math.round(parsed.calories * factor * 10) / 10,
                                protein: Math.round(parsed.protein * factor * 10) / 10,
                                carbs: Math.round(parsed.carbs * factor * 10) / 10,
                                fat: Math.round(parsed.fat * factor * 10) / 10,
                                fiber: Math.round(parsed.fiber * factor * 10) / 10,
                                sodium: Math.round(parsed.sodium * factor * 10) / 10,
                              });
                              setAdded(a => ({ ...a, [stateKey]: true }));
                              setTimeout(() => setAdded(a => { const c = { ...a }; delete c[stateKey]; return c; }), 1500);
                            }}
                            aria-label="Añadir alimento USDA"
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow-sm transition hover:scale-105 ${isAdded ? "bg-emerald-500 text-white" : "bg-gradient-to-br from-brand-500 to-[#6c63ff] text-white hover:from-brand-600 hover:to-[#5b53f0]"}`}
                          >
                            {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateFood ? (
        <FoodFormModal
          food={null}
          nutritionistId={user?.id}
          onClose={() => setShowCreateFood(false)}
          onSaved={() => {
            setShowCreateFood(false);
            clearFoodCatalogCache(userId);
            void prefetchFoodCatalog(userId)
              .then((next) => setFoods(next || []))
              .catch((error) => {
                logger.error('Error refrescando catálogo tras crear alimento', { error: errorMessage(error) });
              });
          }}
        />
      ) : null}
    </div>
  );
}
