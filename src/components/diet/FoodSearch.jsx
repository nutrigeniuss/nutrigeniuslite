import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { hydrateFoodNutrients, listFoods } from "@/lib/catalogData";
import { isFoodVisibleForCountry } from "@/lib/countries";
import { prefetchFoodCatalog, readFoodCatalogCache } from "@/lib/foodCatalogCache";
import { buildFoodReferenceView } from "@/lib/foodNutrients";
import { buildFoodPlanItem, buildFoodUnitOptions, getDefaultQuantityForUnit, normalizeHouseholdMeasuresForDiet, roundNutritionValue } from "@/lib/dietPlanItem";
import { normalizeSearchText } from "@/lib/searchText";
import { DeferredNumberInput, UnitSelect } from "@/components/diet/FoodQuantityInputs";
import { highlightMatch, scoreByRelevance } from "@/components/foods/FoodSearchHelpers";
import { EquivalentGramsField } from "@/components/foods/EquivalentGramsField";
import { FoodResultsTableHead, MacroValueCell } from "@/components/foods/FoodResultsTableHead";

/** Buscador LOCAL de alimentos (sin recetas ni USDA). */

export default function FoodSearch({ onAdd }) {
  const { user } = useAuth();
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemState, setItemState] = useState({});
  const [added, setAdded] = useState({});
  const [allFoods, setAllFoods] = useState(() => readFoodCatalogCache() || []);
  const [allFoodsLoaded, setAllFoodsLoaded] = useState(() => {
    const cached = readFoodCatalogCache();
    return Array.isArray(cached) && cached.length > 0;
  });
  const [foodSearch, setFoodSearch] = useState("");
  const [debouncedFoodSearch, setDebouncedFoodSearch] = useState("");
  const [foodPage, setFoodPage] = useState(1);
  const [foodsTotal, setFoodsTotal] = useState(0);
  const FOOD_PAGE_SIZE = 25;
  const searchInputRef = useRef(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      const isEditable = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (isEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      prefetchFoodCatalog()
        .then((data) => {
          if (cancelled) return;
          setAllFoods(data || []);
          setAllFoodsLoaded(true);
        })
        .catch(() => {
          if (!cancelled) setAllFoodsLoaded(true);
        });
    };
    refresh();
    const onLocal = () => refresh();
    window.addEventListener("ng-local-foods-changed", onLocal);
    return () => {
      cancelled = true;
      window.removeEventListener("ng-local-foods-changed", onLocal);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedFoodSearch(foodSearch), 150);
    return () => clearTimeout(timer);
  }, [foodSearch]);

  useEffect(() => {
    setFoodPage(1);
  }, [foodSearch]);

  useEffect(() => {
    if (!allFoodsLoaded) return;
    const term = normalizeSearchText(foodSearch);
    if (!term) {
      setFoods([]);
      setFoodsTotal(0);
      setLoading(false);
      return;
    }
    const filtered = allFoods.filter(
      (f) => f?.name
        && normalizeSearchText(f.name).includes(term)
        && isFoodVisibleForCountry(f, user?.country, user?.id),
    );
    const offset = (foodPage - 1) * FOOD_PAGE_SIZE;
    setFoods(filtered.slice(offset, offset + FOOD_PAGE_SIZE));
    setFoodsTotal(filtered.length);
    setLoading(false);
  }, [allFoodsLoaded, allFoods, foodSearch, foodPage, user?.country, user?.id]);

  useEffect(() => {
    if (allFoodsLoaded) return;
    const term = debouncedFoodSearch.trim();
    if (!term) {
      setFoods([]);
      setFoodsTotal(0);
      return;
    }
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const offset = (foodPage - 1) * FOOD_PAGE_SIZE;
        const result = await listFoods(user?.id, {
          limit: FOOD_PAGE_SIZE,
          offset,
          searchTerm: term,
          includeMasterCatalog: true,
          country: user?.country,
        });
        if (!mounted) return;
        setFoods(result.data || []);
        setFoodsTotal(result.data?.length || 0);
      } catch {
        if (mounted) {
          setFoods([]);
          setFoodsTotal(0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [allFoodsLoaded, user?.id, user?.country, debouncedFoodSearch, foodPage]);

  const processedFoods = useMemo(() => foods
    .filter((food) => Boolean(food?.id) && Boolean(food?.name))
    .map((food) => {
      const referenceFood = buildFoodReferenceView(food, 100);
      return {
        ...referenceFood,
        household_measures: normalizeHouseholdMeasuresForDiet(food.household_measures),
      };
    }), [foods]);

  const filteredFoods = useMemo(() => {
    if (!foodSearch.trim()) return processedFoods;
    return [...processedFoods]
      .sort((a, b) => scoreByRelevance(a.name, foodSearch) - scoreByRelevance(b.name, foodSearch));
  }, [processedFoods, foodSearch]);

  const getState = (id) => itemState[id] || { quantity: 100, unitIndex: 0 };
  const getUnits = (food) => buildFoodUnitOptions(food);
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
      totalGrams,
      unit,
    };
  };

  const handleAddFood = async (food) => {
    const st = getState(food.id);
    const hydrated = await hydrateFoodNutrients(food, user?.id);
    const source = hydrated === food ? food : {
      ...buildFoodReferenceView(hydrated, 100),
      household_measures: normalizeHouseholdMeasuresForDiet(hydrated.household_measures),
    };
    onAdd(buildFoodPlanItem(source, st.quantity, st.unitIndex));
    setAdded((a) => ({ ...a, [food.id]: true }));
    setTimeout(() => setAdded((a) => {
      const c = { ...a };
      delete c[food.id];
      return c;
    }), 1500);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-3 pt-3 sm:px-6">
          <div className="relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 pb-3 pt-1 text-sm font-semibold text-brand-500">
            Mis Alimentos
            <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{allFoods.length}</span>
            <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-t bg-brand-500" />
          </div>
        </div>

        {allFoods.length === 0 ? (
          <div className="mx-6 mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            No hay base de alimentos. Sube la maestra en Maestro o agrega en Mis Alimentos.
          </div>
        ) : null}

        <div className="px-6 pb-3 pt-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="h-5 w-5 text-[var(--ng-brand-600)]" />
            </div>
            <input
              ref={searchInputRef}
              data-autofocus
              type="text"
              placeholder="Buscar alimento... (presiona / para enfocar)"
              value={foodSearch}
              onChange={(e) => setFoodSearch(e.target.value)}
              className="block w-full rounded-xl border border-[#dde3f0]/80 bg-[#f7f8ff] py-3 pl-12 pr-20 text-sm font-semibold text-slate-800 shadow-sm transition placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
            {foodSearch ? (
              <button
                type="button"
                onClick={() => {
                  setFoodSearch("");
                  searchInputRef.current?.focus();
                }}
                className="absolute inset-y-0 right-12 flex items-center text-slate-400 hover:text-slate-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {foodSearch.trim() ? (
        <div className="flex-1 overflow-y-auto px-3 pb-4 sm:px-6">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left">
              <FoodResultsTableHead quantityLabel="Cant." compactOnMobile />
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-sm text-slate-400">Cargando...</td></tr>
                ) : filteredFoods.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-300">Sin resultados para tu búsqueda</td></tr>
                ) : filteredFoods.map((food) => {
                  const st = getState(food.id);
                  const units = getUnits(food);
                  const scaled = scaleFood(food);
                  const currentUnit = units[st.unitIndex] || units[0];
                  const isAdded = added[food.id];
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
                          onCommit={(v) => setItemState((s) => ({ ...s, [food.id]: { ...getState(food.id), quantity: v } }))}
                          className="w-16 rounded-lg border border-slate-200 bg-white p-1.5 text-center text-sm font-bold text-slate-700 outline-none transition hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                        />
                      </td>
                      <td className="p-2 sm:p-3">
                        <p className="text-sm font-semibold leading-tight text-slate-800">{highlightMatch(food.name, foodSearch)}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          {units.length > 1 ? (
                            <UnitSelect
                              options={units}
                              value={st.unitIndex}
                              onChange={(nextUnitIndex) => {
                                const nextUnit = units[nextUnitIndex] || units[0];
                                setItemState((s) => ({
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
                              setItemState((s) => ({
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
                      <td className="p-2 text-right sm:p-3">
                        <button
                          type="button"
                          onClick={() => void handleAddFood(food)}
                          aria-label="Añadir alimento"
                          className={`inline-flex h-8 w-8 transform items-center justify-center rounded-full text-sm font-bold shadow-sm transition hover:scale-105 ${isAdded ? "bg-emerald-500 text-white" : "bg-gradient-to-br from-brand-500 to-[#6c63ff] text-white hover:from-brand-600 hover:to-[#5b53f0]"}`}
                        >
                          {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {foodsTotal > FOOD_PAGE_SIZE ? (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                <span>
                  Mostrando {(foodPage - 1) * FOOD_PAGE_SIZE + 1}–{Math.min(foodPage * FOOD_PAGE_SIZE, foodsTotal)} de {foodsTotal}
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setFoodPage((p) => Math.max(1, p - 1))} disabled={foodPage === 1} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Anterior</button>
                  <span className="font-semibold text-slate-700">{foodPage} / {Math.max(1, Math.ceil(foodsTotal / FOOD_PAGE_SIZE))}</span>
                  <button type="button" onClick={() => setFoodPage((p) => Math.min(Math.max(1, Math.ceil(foodsTotal / FOOD_PAGE_SIZE)), p + 1))} disabled={foodPage >= Math.ceil(foodsTotal / FOOD_PAGE_SIZE)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
