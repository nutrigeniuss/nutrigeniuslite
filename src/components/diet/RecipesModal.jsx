import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, Plus, ChefHat, Apple, Check, Globe, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";
import { useAuth } from "@/lib/AuthContext";
import { listAccessibleFoods, listRecipes } from "@/lib/catalogData";
import { scaleFoodNutrientsForPlan } from "@/lib/foodNutrients";
import { processFoodsForSearch, getFoodUnits } from "@/lib/foodDisplay";
import { normalizeSearchText } from "@/lib/searchText";
import { toast } from "@/components/ui/use-toast";
import { searchUsdaFoods, getUsdaUnits } from "@/lib/usdaClient";


export default function RecipesModal({ onClose, onAdd, mealName }) {
  const { user } = useAuth();
  const [foods, setFoods] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("alimentos");
  const [itemState, setItemState] = useState({});
  const [added, setAdded] = useState({});

  // Separate search per tab
  const [foodSearch, setFoodSearch] = useState("");
  const [recipeSearch, setRecipeSearch] = useState("");
  const [usdaSearch, setUsdaSearch] = useState("");

  // USDA search state
  const [offResults, setOffResults] = useState([]);
  const [offLoading, setOffLoading] = useState(false);
  const [offSearched, setOffSearched] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [foodsResult, recipesResult] = await Promise.all([
          listAccessibleFoods(200),
          user?.id ? listRecipes(user.id, 100) : Promise.resolve({ data: [], source: "supabase" }),
        ]);

        setFoods(foodsResult.data || []);

        // Este modal se usa para construir planes privados, así que las recetas
        // visibles aquí deben salir solo del catálogo del nutricionista actual.
        setRecipes(recipesResult.data || []);
      } catch (error) {
        logger.error("Error cargando catálogo del modal de recetas:", { error: error instanceof Error ? error.message : String(error) });
        setFoods([]);
        setRecipes([]);
        toast({
          title: "No se pudo cargar el catálogo",
          description: error?.message || "Intenta nuevamente.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [user?.id]);

  const getState = (id) => itemState[id] || { quantity: 100, unitIndex: 0 };
  const setQty = (id, qty) =>
    setItemState(s => ({ ...s, [id]: { ...getState(id), quantity: parseFloat(qty) || 0 } }));
  const setUnitIdx = (id, idx) =>
    setItemState(s => ({ ...s, [id]: { ...getState(id), unitIndex: idx } }));

  // Unidades = "gramos" + medidas caseras reales del registro (limpiadas).
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
      totalGrams,
      unit,
    };
  };

  // Normalizamos macros a base por 100 g y respetamos las medidas caseras
  // reales; el helper cubre también datos legados con filas duplicadas.
  const processedFoods = useMemo(() => processFoodsForSearch(foods), [foods]);

  const filteredFoods = useMemo(() =>
    processedFoods.filter(f => normalizeSearchText(f.name).includes(normalizeSearchText(foodSearch))),
    [processedFoods, foodSearch]
  );

  const filteredRecipes = useMemo(() =>
    recipes.filter(r => normalizeSearchText(r.name).includes(normalizeSearchText(recipeSearch))),
    [recipes, recipeSearch]
  );

  // USDA FoodData Central search
  useEffect(() => {
    if (tab !== "usda") return;
    if (!usdaSearch.trim()) { setOffResults([]); setOffSearched(false); return; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setOffLoading(true);
      setOffSearched(true);
      setOffResults(await searchUsdaFoods(usdaSearch));
      setOffLoading(false);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [usdaSearch, tab]);

  // Parse USDA food nutrients (per 100g)
  const parseUSDAFood = (food) => {
    const get = (id) => {
      const n = food.foodNutrients?.find(n => n.nutrientId === id);
      return n?.value || 0;
    };
    return {
      calories: Math.round(get(1008) * 10) / 10,   // Energy kcal
      protein:  Math.round(get(1003) * 10) / 10,   // Protein
      carbs:    Math.round(get(1005) * 10) / 10,   // Carbs
      fat:      Math.round(get(1004) * 10) / 10,   // Total fat
      fiber:    Math.round(get(1079) * 10) / 10,   // Fiber
      sodium:   Math.round(get(1093) * 10) / 10,   // Sodium mg
    };
  };

  // Get ALL serving sizes from USDA food measures
  const handleAddFood = (food) => {
    const { calories, protein, carbs, fat, totalGrams, unit } = scaleFood(food);
    const st = getState(food.id);
    const nutrientPayload = scaleFoodNutrientsForPlan(food, totalGrams / (food.portion_grams || 100));
    const unitLabel = unit.isHousehold
      ? `${st.quantity} ${unit.label} (${Math.round(totalGrams)}g)`
      : `${st.quantity}g`;
    onAdd({
      name: food.name,
      quantity: 1,
      unit: unitLabel,
      calories,
      protein,
      carbs,
      fat,
      ...nutrientPayload,
    });
    setAdded(a => ({ ...a, [food.id]: true }));
    setTimeout(() => setAdded(a => { const c = { ...a }; delete c[food.id]; return c; }), 1500);
  };

  const handleAddRecipe = (recipe) => {
    const st = itemState[recipe.id] || { quantity: 1 };
    onAdd({
      name: recipe.name,
      quantity: st.quantity || 1,
      unit: "porción",
      calories: (recipe.calories_per_serving || 0) * (st.quantity || 1),
      protein: (recipe.protein_per_serving || 0) * (st.quantity || 1),
      carbs: (recipe.carbs_per_serving || 0) * (st.quantity || 1),
      fat: (recipe.fat_per_serving || 0) * (st.quantity || 1),
      fiber: (recipe.fiber_per_serving || 0) * (st.quantity || 1),
      sodium: (recipe.sodium_per_serving || 0) * (st.quantity || 1),
      is_recipe: true,
    });
    setAdded(a => ({ ...a, [recipe.id]: true }));
    setTimeout(() => setAdded(a => { const c = { ...a }; delete c[recipe.id]; return c; }), 1500);
  };

  // Shared column header
  const TableHead = ({ quantityLabel = "Cantidad" }) => (
    <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 z-10">
      <tr>
        <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-16">{quantityLabel}</th>
        <th className="text-left px-2 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide w-32">Unidad</th>
        <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Alimento</th>
        <th className="text-right px-2 py-2.5 text-xs font-semibold text-orange-400 uppercase tracking-wide w-14">kcal</th>
        <th className="text-right px-2 py-2.5 text-xs font-semibold text-amber-400 uppercase tracking-wide w-14">GRA</th>
        <th className="text-right px-2 py-2.5 text-xs font-semibold text-brand-500 uppercase tracking-wide w-14">CHO</th>
        <th className="text-right px-2 py-2.5 text-xs font-semibold text-brand-500 uppercase tracking-wide w-14">PRO</th>
        <th className="w-10"></th>
      </tr>
    </thead>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col" style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-800 text-sm">
            Agregar a: <span className="text-brand-500">{mealName}</span>
          </h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        {/* Tabs + per-tab search bar (all in one row) */}
        <div className="flex-shrink-0 border-b border-slate-100">
          {/* Tab pills */}
          <div className="flex gap-0 px-5 pt-2">
            {[
              { key: "alimentos", label: "Mis Alimentos", icon: Apple, color: "teal", count: filteredFoods.length },
              { key: "recetas",   label: "Mis Recetas",   icon: ChefHat, color: "violet", count: filteredRecipes.length },
              { key: "usda",      label: "Base USDA",     icon: Globe, color: "blue", count: offResults.length },
            ].map(t => {
              const active = tab === t.key;
              const colors = {
                teal:   { active: "border-brand-500 text-brand-500 bg-brand-50/60",   badge: "bg-[#e2e8ff] text-brand-500" },
                violet: { active: "border-brand-500 text-brand-500 bg-brand-50/60", badge: "bg-[#e2e8ff] text-brand-500" },
                blue:   { active: "border-blue-500 text-blue-600 bg-blue-50/60",   badge: "bg-blue-100 text-blue-600" },
              }[t.color];
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all -mb-px rounded-t-lg ${
                    active ? colors.active : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                  {active && t.count > 0 && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${colors.badge}`}>{t.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Per-tab search input */}
          <div className="px-5 py-3">
            {tab === "alimentos" && (
              <div className="relative">
                <Apple className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                <input autoFocus type="text" placeholder="Buscar en mis alimentos..." value={foodSearch}
                  onChange={e => setFoodSearch(e.target.value)}
                  className="w-full pl-9 pr-24 py-2.5 text-sm border border-[#c7d0fc] rounded-xl bg-brand-50/30 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-all" />
                {foodSearch && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-500 font-semibold">{filteredFoods.length} resultados</span>}
              </div>
            )}
            {tab === "recetas" && (
              <div className="relative">
                <ChefHat className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-400" />
                <input autoFocus type="text" placeholder="Buscar en mis recetas..." value={recipeSearch}
                  onChange={e => setRecipeSearch(e.target.value)}
                  className="w-full pl-9 pr-24 py-2.5 text-sm border border-[#c7d0fc] rounded-xl bg-brand-50/30 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-all" />
                {recipeSearch && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-500 font-semibold">{filteredRecipes.length} resultados</span>}
              </div>
            )}
            {tab === "usda" && (
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                <input autoFocus type="text" placeholder="Buscar en base de datos USDA (300k+ alimentos)..." value={usdaSearch}
                  onChange={e => setUsdaSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-blue-200 rounded-xl bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── USDA TAB ── */}
          {tab === "usda" && (
            offLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Buscando alimentos...
              </div>
            ) : !offSearched ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Globe className="w-10 h-10 text-blue-200" />
                <p className="text-sm font-medium text-slate-500">Base de datos USDA</p>
                <p className="text-xs text-slate-400">Escribe para buscar entre más de 300,000 alimentos</p>
              </div>
            ) : offResults.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">No se encontraron resultados</div>
            ) : (
              <table className="w-full text-sm">
                <TableHead />
                <tbody>
                  {offResults.map((food, idx) => {
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
                      <tr key={food.fdcId} className={`border-b border-slate-50 hover:bg-brand-50/40 transition-colors ${idx % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                        {/* Quantity */}
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number" min="0" step={unit.isHousehold ? 0.5 : 10}
                            value={st.quantity}
                            onChange={e => setItemState(s => ({ ...s, [stateKey]: { ...st, quantity: parseFloat(e.target.value) || 0 } }))}
                            className="w-14 text-right text-sm font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                          />
                        </td>
                        {/* Unit selector */}
                        <td className="px-2 py-2">
                          <div>
                            <select
                              value={st.unitIndex}
                              onChange={e => setItemState(s => ({ ...s, [stateKey]: { ...st, unitIndex: parseInt(e.target.value) } }))}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-full max-w-[130px]"
                            >
                              {units.map((u, i) => <option key={i} value={i}>{u.label}</option>)}
                            </select>
                            {unit.isHousehold && (
                              <p className="text-[10px] text-slate-400 mt-0.5 pl-1">{Math.round(totalGrams)}g</p>
                            )}
                          </div>
                        </td>
                        {/* Food name */}
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-700 text-sm leading-tight">{food.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{food.brandOwner || food.dataType || "USDA"}</p>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-orange-500 text-sm">{Math.round(parsed.calories * factor)}</td>
                        <td className="px-2 py-2 text-right text-amber-500 text-sm">{Math.round(parsed.fat * factor * 10) / 10}g</td>
                        <td className="px-2 py-2 text-right text-brand-500 text-sm">{Math.round(parsed.carbs * factor * 10) / 10}g</td>
                        <td className="px-2 py-2 text-right text-brand-500 text-sm">{Math.round(parsed.protein * factor * 10) / 10}g</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => {
                              const unitLabel = unit.isHousehold
                                ? `${st.quantity} ${unit.label} (${Math.round(totalGrams)}g)`
                                : `${st.quantity}g`;
                              onAdd({
                                name: food.description,
                                quantity: 1,
                                unit: unitLabel,
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
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all shadow-sm ${isAdded ? "bg-emerald-500" : "bg-brand-500 hover:bg-brand-500"}`}
                          >
                            {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* ── MIS ALIMENTOS TAB ── */}
          {tab === "alimentos" && (
            loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">Cargando...</div>
            ) : filteredFoods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <Apple className="w-10 h-10 text-[#c7d0fc]" />
                <p className="text-sm font-medium">{foods.length === 0 ? "Sin alimentos en el catálogo" : "Sin resultados"}</p>
                {foodSearch && <p className="text-xs">Intenta con otro nombre</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <TableHead />
                <tbody>
                  {filteredFoods.map((food, idx) => {
                    const st = getState(food.id);
                    const units = getUnits(food);
                    const scaled = scaleFood(food);
                    const currentUnit = units[st.unitIndex] || units[0];
                    const isAdded = added[food.id];
                    return (
                      <tr key={food.id} className={`border-b border-slate-50 hover:bg-brand-50/40 transition-colors ${idx % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                        {/* Quantity */}
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step={currentUnit.isHousehold ? 0.5 : 10}
                            value={st.quantity}
                            onChange={e => setQty(food.id, e.target.value)}
                            className="w-14 text-right text-sm font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                          />
                        </td>
                        {/* Unit selector */}
                        <td className="px-2 py-2">
                          <div>
                            <select
                              value={st.unitIndex}
                              onChange={e => setUnitIdx(food.id, parseInt(e.target.value))}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-400 w-full max-w-[130px]"
                            >
                              {units.map((u, i) => (
                                <option key={i} value={i}>{u.label}</option>
                              ))}
                            </select>
                            {currentUnit.isHousehold && (
                              <p className="text-[10px] text-slate-400 mt-0.5 pl-1">≈ {Math.round(scaled.totalGrams)}g</p>
                            )}
                          </div>
                        </td>
                        {/* Food name */}
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-700 text-sm leading-tight">{food.name}</p>
                          {food.category && <p className="text-xs text-slate-400 mt-0.5">{food.category}</p>}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-orange-500 text-sm">{scaled.calories}</td>
                        <td className="px-2 py-2 text-right text-amber-500 text-sm">{scaled.fat}g</td>
                        <td className="px-2 py-2 text-right text-brand-500 text-sm">{scaled.carbs}g</td>
                        <td className="px-2 py-2 text-right text-brand-500 text-sm">{scaled.protein}g</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleAddFood(food)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all shadow-sm ${isAdded ? "bg-emerald-500" : "bg-brand-500 hover:bg-brand-500"}`}
                          >
                            {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}

          {/* ── RECETAS TAB ── */}
          {tab === "recetas" && (
            loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">Cargando...</div>
            ) : filteredRecipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                <ChefHat className="w-10 h-10 text-[#c7d0fc]" />
                <p className="text-sm font-medium">{recipes.length === 0 ? "Sin recetas guardadas" : "Sin resultados"}</p>
                {recipeSearch && <p className="text-xs">Intenta con otro nombre</p>}
              </div>
            ) : (
              <table className="w-full text-sm">
                <TableHead quantityLabel="Porciones" />
                <tbody>
                  {filteredRecipes.map((recipe, idx) => {
                    const qty = itemState[recipe.id]?.quantity ?? 1;
                    const isAdded = added[recipe.id];
                    return (
                      <tr key={recipe.id} className={`border-b border-slate-50 hover:bg-brand-50/40 transition-colors ${idx % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={qty}
                            onChange={e => setItemState(s => ({ ...s, [recipe.id]: { quantity: parseFloat(e.target.value) || 1 } }))}
                            className="w-14 text-right text-sm font-semibold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <span className="text-xs text-slate-400 px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 inline-block">porción</span>
                        </td>
                        <td className="px-4 py-2">
                          <p className="font-medium text-slate-700 text-sm leading-tight">{recipe.name}</p>
                          {recipe.category && <p className="text-xs text-slate-400 mt-0.5">{recipe.category}</p>}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold text-orange-500 text-sm">{Math.round((recipe.calories_per_serving || 0) * qty)}</td>
                        <td className="px-2 py-2 text-right text-amber-500 text-sm">{Math.round((recipe.fat_per_serving || 0) * qty * 10) / 10}g</td>
                        <td className="px-2 py-2 text-right text-brand-500 text-sm">{Math.round((recipe.carbs_per_serving || 0) * qty * 10) / 10}g</td>
                        <td className="px-2 py-2 text-right text-brand-500 text-sm">{Math.round((recipe.protein_per_serving || 0) * qty * 10) / 10}g</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleAddRecipe(recipe)}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-white transition-all shadow-sm ${isAdded ? "bg-emerald-500" : "bg-brand-500 hover:bg-brand-500"}`}
                          >
                            {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>
    </div>
  );
}