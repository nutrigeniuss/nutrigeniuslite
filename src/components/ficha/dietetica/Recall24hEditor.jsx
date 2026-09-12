import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/components/ui/use-toast";
import { useAutosaveOnLeave } from "@/hooks/useAutosaveOnLeave";
import { generateId } from "./recallItemFields";
import RecallFoodSearch from "./RecallFoodSearch";
import NutriSummary from "./NutriSummary";
import EditableMealItemRow from "./EditableMealItemRow";

const buildMealsFromMeasurement = (measurement) => {
  const recall = measurement?.recall_24h;
  if (Array.isArray(recall) && recall.length > 0) {
    return recall.map((m, i) => ({
      id: m.id || `m${i}`,
      time: m.time || "08:00",
      name: m.name || "Comida",
      items: Array.isArray(m.items) ? m.items : [],
      content: m.content || "",
    }));
  }

  return [
    { id: "m1", time: "08:00", name: "Desayuno", items: [] },
    { id: "m2", time: "13:00", name: "Almuerzo", items: [] },
  ];
};

export default function Recall24hEditor({
  measurement,
  onClose,
  onSave,
  onDelete,
  targetCalories = 0,
  registerAutosave,
  wide = false,
  embedded = false,
}) {
  const [meals, setMeals] = useState(() => buildMealsFromMeasurement(measurement));
  const [lastSavedMeals, setLastSavedMeals] = useState(() => buildMealsFromMeasurement(measurement));
  const [activeMealId, setActiveMealId] = useState(meals[0]?.id || "m1");
  const [saved, setSaved] = useState(false);

  const activeMeal = meals.find((m) => m.id === activeMealId);
  const allItems = meals.flatMap((m) => m.items);
  const twoCol = wide && allItems.length > 0;
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(meals) !== JSON.stringify(lastSavedMeals),
    [meals, lastSavedMeals],
  );

  useEffect(() => {
    const nextMeals = buildMealsFromMeasurement(measurement);
    setMeals(nextMeals);
    setLastSavedMeals(nextMeals);
    setActiveMealId(nextMeals[0]?.id || "m1");
  }, [measurement]);

  const handleAddItem = (itemData) => {
    const item = { id: generateId(), ...itemData, quantity: itemData.quantity || 1 };
    setMeals((ms) =>
      ms.map((m) => (m.id === activeMealId ? { ...m, items: [...m.items, item] } : m)),
    );
  };

  const removeItem = (mealId, itemId) => {
    setMeals((ms) =>
      ms.map((m) => (m.id === mealId ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m)),
    );
  };

  const updateMealItem = (mealId, itemId, patch) => {
    setMeals((ms) =>
      ms.map((m) =>
        m.id === mealId
          ? { ...m, items: m.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : m,
      ),
    );
  };

  const addMeal = () => {
    const newMeal = { id: generateId(), time: "12:00", name: `Comida ${meals.length + 1}`, items: [] };
    setMeals((ms) => [...ms, newMeal]);
    setActiveMealId(newMeal.id);
  };

  const removeMeal = (mealId) => {
    setMeals((ms) => {
      const next = ms.filter((m) => m.id !== mealId);
      if (activeMealId === mealId && next.length) setActiveMealId(next[0].id);
      return next;
    });
  };

  const handleSave = async (origin = "manual") => {
    // En Lite (embedded) persistimos también vacío: es borrador de calculadora.
    const hasItems = meals.some((m) => Array.isArray(m.items) && m.items.length > 0);
    if (!embedded && !hasItems) {
      toast({
        title: "Recordatorio vacío",
        description: "Agrega al menos un alimento antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    const persisted = await onSave(meals);
    if (persisted === false) return;

    setLastSavedMeals(meals);
    setSaved(true);

    if (origin === "autosave" || embedded) {
      window.setTimeout(() => setSaved(false), 1200);
      return;
    }

    toast({
      title: "Recordatorio actualizado",
      description: "Se guardó en esta ficha (sesión local).",
    });
    setTimeout(() => {
      setSaved(false);
      if (typeof onClose === "function") onClose();
    }, 1200);
  };

  // Autosave al editar (sin botones Guardar/Eliminar en modo calculadora).
  useEffect(() => {
    if (!embedded) return undefined;
    if (!hasUnsavedChanges) return undefined;
    const timer = window.setTimeout(() => {
      void handleSave("autosave");
    }, 600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on meals only
  }, [embedded, meals, hasUnsavedChanges]);

  const flushAutosave = useAutosaveOnLeave({
    hasUnsavedChanges,
    onAutosave: () => handleSave("autosave"),
  });

  useEffect(() => {
    if (!registerAutosave) return undefined;
    registerAutosave(flushAutosave);
    return () => registerAutosave(null);
  }, [flushAutosave, registerAutosave]);

  const dateLabel = measurement?.date
    ? format(new Date(`${measurement.date}T12:00:00`), "d 'de' MMMM yyyy", { locale: es })
    : "Sin fecha";

  return (
    <div
      className={
        embedded
          ? "bg-white"
          : "mt-4 rounded-[16px] border border-[#e2e8f0]/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06)]"
      }
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">Recordatorio 24h — {dateLabel}</p>
        </div>
        {!embedded && typeof onClose === "function" ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] px-3 py-2 text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            Cerrar
          </button>
        ) : null}
      </div>

      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
        {meals.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setActiveMealId(m.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-xs font-semibold transition ${
              activeMealId === m.id
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            <span>{m.name}</span>
            {m.items.length > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  activeMealId === m.id ? "bg-white/20 text-white" : "bg-brand-50 text-brand-500"
                }`}
              >
                {Math.round(m.items.reduce((s, i) => s + (i.calories || 0) * (i.quantity || 1), 0))} kcal
              </span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          onClick={addMeal}
          className="flex items-center gap-1 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-xs font-semibold text-brand-500 transition hover:bg-brand-50"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </button>
      </div>

      <div className={twoCol ? "xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-5" : ""}>
        {activeMeal ? (
          <div className="mb-4 overflow-hidden rounded-[12px] border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />
              <input
                type="time"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                value={activeMeal.time}
                onChange={(e) =>
                  setMeals((ms) =>
                    ms.map((m) => (m.id === activeMealId ? { ...m, time: e.target.value } : m)),
                  )
                }
              />
              <input
                className="flex-1 border-b border-transparent bg-transparent text-sm font-medium text-slate-700 outline-none focus:border-brand-500"
                value={activeMeal.name}
                onChange={(e) =>
                  setMeals((ms) =>
                    ms.map((m) => (m.id === activeMealId ? { ...m, name: e.target.value } : m)),
                  )
                }
              />
              {meals.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeMeal(activeMealId)}
                  className="text-slate-300 transition hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            {activeMeal.items.length > 0 ? (
              <div className="border-b border-slate-100">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="w-20 px-3 py-2 text-center">Cant.</th>
                      <th className="px-3 py-2">Alimento</th>
                      <th className="px-3 py-2 text-center">Kcal</th>
                      <th className="px-3 py-2 text-center">CHO</th>
                      <th className="px-3 py-2 text-center">PRO</th>
                      <th className="px-3 py-2 text-center">GRA</th>
                      <th className="w-8 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {activeMeal.items.map((item) => (
                      <EditableMealItemRow
                        key={item.id}
                        item={item}
                        onChange={(patch) => updateMealItem(activeMealId, item.id, patch)}
                        onRemove={() => removeItem(activeMealId, item.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="p-4">
              <RecallFoodSearch onAdd={handleAddItem} />
            </div>
          </div>
        ) : null}

        {allItems.length > 0 ? (
          <div className={twoCol ? "xl:sticky xl:top-4" : ""}>
            <NutriSummary items={allItems} meals={meals} targetCalories={targetCalories} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
