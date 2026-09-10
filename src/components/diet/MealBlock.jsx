import React, { useState } from "react";
import { Pencil, Trash2, Plus, ChefHat, GripVertical, Clock, X, Check, ChevronDown, ChevronRight } from "lucide-react";
import { logger } from "@/lib/logger";
import { supabase } from "@/api/supabaseClient";

export default function MealBlock({ meal, onUpdate, onDelete, onAddItem, onInsertAfter }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(meal.name);
  const [collapsed, setCollapsed] = useState(false);
  const [editingQty, setEditingQty] = useState(null);
  const [expandedRecipes, setExpandedRecipes] = useState({}); // itemId -> Recipe data
  const [loadingRecipe, setLoadingRecipe] = useState({}); // itemId -> bool

  const toggleRecipeExpand = async (item) => {
    if (!item.is_recipe) return;
    if (expandedRecipes[item.id] !== undefined) {
      // collapse
      setExpandedRecipes(prev => { const c = { ...prev }; delete c[item.id]; return c; });
      return;
    }
    setLoadingRecipe(prev => ({ ...prev, [item.id]: true }));
    const { data, error } = await supabase
      .from("recipes")
      .select("*")
      .eq("name", item.name)
      .limit(1);
    if (error) {
      logger.error("Error cargando receta expandida:", { error: error.message });
    }
    const match = data?.[0] || null;
    setExpandedRecipes(prev => ({ ...prev, [item.id]: match || null }));
    setLoadingRecipe(prev => ({ ...prev, [item.id]: false }));
  };

  const totalCals = meal.items.reduce((s, i) => s + (i.calories * (i.quantity || 1)), 0);

  const saveName = () => {
    onUpdate({ ...meal, name: nameInput });
    setEditingName(false);
  };

  const updateItemQty = (itemId, qty) => {
    const updated = meal.items.map(i => i.id === itemId ? { ...i, quantity: parseFloat(qty) || 1 } : i);
    onUpdate({ ...meal, items: updated });
  };

  const removeItem = (itemId) => {
    onUpdate({ ...meal, items: meal.items.filter(i => i.id !== itemId) });
  };

  const updateTime = (time) => {
    onUpdate({ ...meal, time });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <GripVertical className="w-4 h-4 text-slate-300 cursor-grab flex-shrink-0" />

        <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-brand-500 transition-colors">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {editingName ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveName()}
              className="text-sm font-semibold text-slate-700 border-b-2 border-brand-400 bg-transparent outline-none flex-1"
            />
            <button onClick={saveName} className="text-brand-500 hover:text-brand-500">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setEditingName(false); setNameInput(meal.name); }} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-700 truncate">{meal.name}</h3>
            <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 hover:!opacity-100 text-slate-400 hover:text-brand-500 transition-all">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
          <Clock className="w-3 h-3 text-slate-400" />
          <input
            type="time"
            value={meal.time || ""}
            onChange={e => updateTime(e.target.value)}
            className="text-xs text-slate-500 bg-transparent border-none outline-none w-16"
          />
        </div>

        {!collapsed && (
          <span className="text-xs font-medium text-brand-500 bg-brand-50 px-2 py-0.5 rounded-full">
            {Math.round(totalCals)} kcal
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => onAddItem(meal.id)}
            title="Agregar receta"
            className="w-7 h-7 rounded-lg bg-brand-50 hover:bg-[#e2e8ff] flex items-center justify-center text-brand-500 transition-colors"
          >
            <ChefHat className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onInsertAfter(meal.id)}
            title="Insertar tiempo de comida"
            className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-brand-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(meal.id)}
            title="Eliminar"
            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="px-4 py-2">
          {meal.items.length === 0 ? (
            <div
              onClick={() => onAddItem(meal.id)}
              className="flex items-center justify-center gap-2 py-4 text-slate-300 text-xs cursor-pointer hover:text-brand-400 transition-colors rounded-xl hover:bg-brand-50/50 border-2 border-dashed border-slate-100 hover:border-[#c7d0fc] my-1"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar receta o alimento</span>
            </div>
          ) : (
            <div className="space-y-1 py-1">
              {meal.items.map(item => {
                const qty = item.quantity || 1;
                const itemCals = item.calories * qty;
                const isExpanded = expandedRecipes[item.id] !== undefined;
                const recipeData = expandedRecipes[item.id];
                const isLoading = loadingRecipe[item.id];

                return (
                  <div key={item.id} className="rounded-xl overflow-hidden border border-slate-100 mb-1">
                    {/* Item row */}
                    <div className="group flex items-center gap-3 py-1.5 px-2 hover:bg-slate-50 transition-colors">
                      {/* Expand button for recipes */}
                      {item.is_recipe ? (
                        <button
                          onClick={() => toggleRecipeExpand(item)}
                          className="w-5 h-5 rounded-md bg-gradient-to-br from-[#e2e8ff] to-emerald-100 flex items-center justify-center flex-shrink-0 hover:bg-[#c7d0fc] transition-colors"
                          title="Ver ingredientes"
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3 text-brand-500" /> : <ChefHat className="w-3 h-3 text-brand-500" />}
                        </button>
                      ) : (
                        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        </div>
                      )}

                      <span className="text-sm text-slate-600 flex-1 min-w-0 truncate">
                        {item.name}
                        {item.is_recipe && <span className="ml-1 text-[10px] text-brand-400 font-medium">(receta)</span>}
                      </span>

                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <span className="text-brand-500">P:{Math.round((item.protein || 0) * qty)}g</span>
                        <span className="text-brand-500">C:{Math.round((item.carbs || 0) * qty)}g</span>
                        <span className="text-amber-500">G:{Math.round((item.fat || 0) * qty)}g</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {editingQty === item.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus type="number" step="0.5" min="0.5"
                              defaultValue={qty}
                              onBlur={e => { updateItemQty(item.id, e.target.value); setEditingQty(null); }}
                              onKeyDown={e => { if (e.key === "Enter") { updateItemQty(item.id, e.target.value); setEditingQty(null); } }}
                              className="w-12 text-xs border border-[#93a7ff] rounded-md px-1 py-0.5 outline-none text-center"
                            />
                            <span className="text-xs text-slate-400">x</span>
                          </div>
                        ) : (
                          <button onClick={() => setEditingQty(item.id)} className="text-xs px-2 py-0.5 rounded-md bg-slate-100 hover:bg-brand-50 hover:text-brand-500 text-slate-500 transition-colors">
                            {qty}x
                          </button>
                        )}
                        <span className="text-xs font-medium text-orange-500 w-14 text-right">{Math.round(itemCals)} kcal</span>
                      </div>

                      <button onClick={() => removeItem(item.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Recipe ingredients expanded */}
                    {item.is_recipe && isExpanded && (
                      <div className="bg-brand-50/60 border-t border-[#e2e8ff] px-4 py-2">
                        {isLoading ? (
                          <p className="text-xs text-slate-400 py-1">Cargando ingredientes...</p>
                        ) : !recipeData ? (
                          <p className="text-xs text-slate-400 py-1 italic">No se encontró la receta en el catálogo.</p>
                        ) : (
                          <>
                            {/* Recipe image if available */}
                            {recipeData.image_url && (
                              <div className="mb-2 flex items-center gap-2">
                                <img src={recipeData.image_url} alt={recipeData.name} className="w-16 h-16 rounded-lg object-cover border border-[#e2e8ff]" />
                                <div>
                                  <p className="text-xs font-semibold text-brand-600">{recipeData.name}</p>
                                  {recipeData.servings && <p className="text-[10px] text-slate-400">{recipeData.servings} porción(es) por receta</p>}
                                </div>
                              </div>
                            )}
                            <p className="text-[10px] font-semibold text-brand-500 uppercase tracking-wide mb-1.5">
                              Ingredientes · {recipeData.servings || 1} porción(es)
                            </p>
                            <div className="space-y-1">
                              {(recipeData.ingredients || []).length === 0 ? (
                                <p className="text-xs text-slate-400 italic">Sin ingredientes registrados</p>
                              ) : (
                                recipeData.ingredients.map((ing, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600">{ing.name}</span>
                                    <span className="text-slate-400 font-medium">
                                      {ing.quantity} {ing.unit}
                                      {ing.calories ? <span className="ml-1 text-orange-400">· {Math.round(ing.calories)} kcal</span> : ""}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                            {recipeData.instructions && (
                              <details className="mt-2">
                                <summary className="text-[10px] text-brand-500 font-semibold cursor-pointer">Ver preparación</summary>
                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed whitespace-pre-line">{recipeData.instructions}</p>
                              </details>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => onAddItem(meal.id)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-500 py-1 px-2 rounded-lg hover:bg-brand-50 transition-all w-full"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar ingrediente</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}