import React, { useState, useRef, useEffect } from "react";
import { X, Plus, Trash2, Search } from "lucide-react";
import { logger } from "@/lib/logger";
import { toast } from "@/components/ui/use-toast";
import { createFoodRevision, saveFood } from "@/lib/catalogData";
import { FOOD_CATEGORIES, normalizeFoodCategory } from "@/lib/foodCategories";
import { buildFoodReferenceView, FIXED_NUTRIENTS, OPTIONAL_NUTRIENTS } from "@/lib/foodNutrients";

const HOUSEHOLD_MEASURES = [
  "Cucharadita llena", "Cucharada llena", "Taza loza al ras", "Taza loza llena",
  "Taza plástico al ras", "Taza plástico llena", "Taza fierro enlozado al ras", "Taza fierro enlozado llena",
  "Cucharadita colmada", "Cucharada colmada", "Taza pequeña (250 ml)", "Tenedor colmado",
  "Cucharón chino lleno", "Cucharón chino colmado", "Cucharón llano lleno", "Cucharón llano colmado",
  "Espumadera llena", "Espumadera colmada", "Taza de acero al ras", "Taza de acero llena",
  "Taza de loza al ras", "Taza de loza llena", "Taza plástica al ras", "Taza plástica llena",
  "Porción pequeña", "Porción mediana", "Porción grande", "Taza fierro esmaltada al ras",
  "Taza fierro esmaltada llena", "Taza de acero colmada", "Puño (L:16.7 cm; A:7.6 cm; D:8.8 cm)",
  "Vaso pequeño de vidrio", "Taza de fierro enlozado al ras", "Taza de fierro enlozado llena",
  "Puño cerrado (L:17.4 cm; A:7.9 cm; D:10.4 cm)", "Taza de acero colmada*", "Cucharada colmada*",
  "Cucharadita al ras", "Cucharada al ras", "Taza pequeña", "Unidad", "Taza de loza lleno",
  "Tenedor lleno", "Paquete de 12 unidades cuadradas", "Unidad cuadrada", "Paquete de 8 unidades cuadradas",
  "Taza de plástico al ras", "Taza de plástico llena", "Taza de fierro enlozado lleno",
  "Puño (L:16.7 cm A:7.6 cm D:8.8 cm)", "Puñado (L:16.7 cm A:7.6 cm D:8.8 cm)", "Gramos",
  "Taza de acero ras", "Taza de acero", "Cucharada llena cruda", "Taza pequeña llena",
  "Cucharadas llenas cruda", "Unidad mediana", "Tajada (9.7 cm de largo; 9 cm de ancho; 1.3 cm de grosor)",
  "Puño cerrado (L:17.4 cm; A:7.9 cm; D:10.4 cm)", "Cucharada colmada cruda", "Paquete",
  "Paquete (4 unidades)", "Cucharadita llena", "Cucharadas llena cruda", "Unidad pequeña",
  "Unidad grande", "Cabeza pequeña", "Cabeza mediana", "Diente pequeño", "Diente mediano",
  "Cabeza mediana con hojas", "Ramita pequeña", "Ramita mediana", "Ramita grande",
  "Atado mediano", "Atado pequeño", "Trozo pequeño", "Cucharadita", "Atado (7 ataditos)",
  "Atadito", "Tira", "Rodaja pequeña", "Rodaja mediana", "Rodaja grande",
  "Taza de fierro enlozado colmada", "Trozo mediano", "Trozo grande", "Atado grande",
  "Unidad mediana cruda", "Unidad pequeña cruda", "Agua de coco de unidad mediana",
  "Tajada de unidad mediana", "Vaso de vidrio pequeño", "Cucharadita llena. jugo",
  "Cucharadita llena. jugo colado", "Cucharada llena. jugo", "Cucharada llena. jugo colado",
  "Gajo de unidad mediana", "Unidad mediana 30 cm", "Tajada de unidad pequeña",
  "Tajada de unidad grande", "Cucharadas llena", "Rodaja de unidad mediana",
  "Rodaja fina de unidad mediana (tipo chifle)", "Tajada mediana", "Unidades mediana",
  "14 unidades medianas o 1/3 taza", "Unidad grande cruda", "Unidad extra grande",
  "Cubo mediano", "Cubo grande", "cucharada llena de cubos", "Porción para entrada",
  "Rebanada de unidad mediana", "Porción para fritura", "Porción para aderezos",
  "Porción para ensaladas", "Porción", "Puñado", "Porción mediana gruesa para untar",
  "Porción grande gruesa para untar", "Media mitad mediana", "Filete mediano",
  "Unidad (cabeza, cola, sin espinazo y espina)", "Unidad (sin cabeza, cola, espinazo y espinas)",
  "Trozo de parte superior", "Trozo de parte inferior", "Taza de fierro lleno",
  "Taza plástico lleno", "Taza pequeña (250ml)", "Taza de acero picada",
  "Taza pequeña (250 ml) picada", "Cucharada llena cocida", "Cucharada colmada cocida",
  "Filete pequeño", "Filete grande", "Taza de acero (280 ml)", "Rebanada",
  "Tajada delgada", "Filete trozo", "Pierna mediana", "Puño",
  "Vaso grande de vidrio al ras", "Tajada pequeña delgada", "Tajada mediana delgada",
  "Tajada grande delgada", "Tajada mediana delgada molde", "Vaso pequeño de vidrio al ras",
  "Lata", "Taza de loza", "Taza de loza colmada", "Taza de plástico colmada",
  "Cucharadita ras", "Unidad tipo \"tapa\"", "Unidad tipo \"bola\"", "Porción para guiso",
  "Taza loza ras", "Taza Plástico ras", "Taza fierro enlozado ras", "Taza Fierro enlozado lleno",
  "Puño cerrado(L:16.7 cm A:7.6 cm D:8.8 cm)", "Puñado(L:16.7 cm A:7.6 cm D:8.8 cm)",
  "Unidad pequeña sin cáscara", "Unidad mediana sin cáscara", "Unidad grande sin cáscara",
  "Cucharon colmado", "Cucharón lleno", "Unidad pequeña cocida",
  "Rodaja pequeña(4 cm diámetro x 1 cm grosor aprox.)", "Rodaja mediana(6 cm diámetro x 1 cm grosor aprox.)",
  "Rodaja grande(7 cm diámetro x 1 cm grosor aprox.)", "Porción de rodajas(6 rodajas medianas)",
  "Unidad pequeña(6 cm largo)", "Unidad mediana(8 cm largo)", "Unidad grande(10 cm largo)",
  "Taza de acero llena de cubitos", "Puñado de bastones(L:16.7 cm A:7.6 cm D:8.8 cm)",
  "1 trozo pequeño(3.6 cm largo x 5.3 cm diámetro)", "1 trozo mediano(5.6 cm largo x 6.6cm diámetro)",
  "1 trozo grande(8 cm largo x 7.8 cm diámetro)", "Rodaja pequeña cocida",
  "Unidad pequeña(8 cm largo)", "Unidad mediana(10 cm largo)", "Unidad grande(14 cm largo)",
  "Porción para salchipapa", "taza cocida", "taza cocido", "cucharadas crudas",
  "cucharadas colmadas crudas", "cucharadas llenas crudas", "mazorca cruda",
  "unidades medianas cocidas", "unidades pequeñas cocidas", "pequeña cocida",
  "unidades", "tazas crudos", "tazas cocidos", "taza crudo", "cucharadas llenas", "taza",
  "unidades medianas", "unidades pequeñas", "unidades grandes", "unidad crudo",
  "unidades pequeñas crudas", "unidades grandes crudas", "unidades medianas crudas",
  "cucharada", "trozo pequeño", "filete", "taza picada", "cucharadas llenas cocidas",
  "cucharadas colmadas cocidas", "tira delgada", "medias mitades medianas",
];

const toOptionalNumber = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const parseNumericInputValue = (rawValue) => {
  if (rawValue === "") return "";
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : "";
};

const isInvalidNonNegative = (value) => value !== "" && (!Number.isFinite(value) || value < 0);
const REFERENCE_GRAMS = 100;

const InputField = ({ label, value, onChange, unit, onRemove }) => (
  <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
    <label className="text-sm text-slate-600 flex-1 pr-2">{label}</label>
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value ?? ""}
        onChange={e => onChange(parseNumericInputValue(e.target.value))}
        placeholder="0"
        className="w-24 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-right bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white transition-all"
      />
      {unit && <span className="text-xs text-slate-400 w-10">{unit}</span>}
      {onRemove && (
        <button onClick={onRemove} className="w-5 h-5 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center transition-colors ml-1">
          <X className="w-2.5 h-2.5 text-slate-400 hover:text-red-500" />
        </button>
      )}
    </div>
  </div>
);

function NutrientPicker({ addedKeys, onAdd }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const available = OPTIONAL_NUTRIENTS.filter(
    n => !addedKeys.includes(n.key) && n.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative mt-1">
      <div
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 cursor-pointer hover:border-brand-500/40 transition-colors"
      >
        <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onClick={e => { e.stopPropagation(); setOpen(true); }}
          placeholder="Añadir otro nutriente..."
          className="flex-1 text-sm bg-transparent focus:outline-none text-slate-600 placeholder-slate-400"
        />
      </div>
      {open && available.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {available.map(n => (
            <button
              key={n.key}
              onClick={() => { onAdd(n); setSearch(""); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-500 transition-colors border-b border-slate-50 last:border-0"
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FoodFormModal({ food, onClose, onSaved, nutritionistId = undefined }) {
  const editableFood = food ? buildFoodReferenceView(food, REFERENCE_GRAMS) : null;

  // Build initial extra nutrients from existing food data
  const getInitialExtras = () => {
    if (!editableFood) return [];
    return OPTIONAL_NUTRIENTS.filter((n) => {
      const parsedValue = toOptionalNumber(editableFood[n.key]);
      return parsedValue !== "" && parsedValue !== 0;
    });
  };

  const [form, setForm] = useState({
    name: editableFood?.name || "",
    category: normalizeFoodCategory(editableFood?.category || ""),
    portion_grams: REFERENCE_GRAMS,
    calories: editableFood?.calories ?? "",
    protein: editableFood?.protein ?? "",
    available_carbs: editableFood?.available_carbs ?? editableFood?.carbs ?? "",
    fat: editableFood?.fat ?? "",
    household_measures: editableFood?.household_measures || [],
    notes: editableFood?.notes || "",
    // extra nutrients stored as key-value
    ...OPTIONAL_NUTRIENTS.reduce((acc, n) => {
      if (editableFood?.[n.key] !== undefined) acc[n.key] = editableFood[n.key];
      return acc;
    }, {}),
  });
  const [extraNutrients, setExtraNutrients] = useState(getInitialExtras);
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setCarbs = (value) => setForm(f => ({ ...f, carbs: value, available_carbs: value }));

  const addNutrient = (n) => setExtraNutrients(prev => [...prev, n]);
  const removeNutrient = (key) => {
    setExtraNutrients(prev => prev.filter(n => n.key !== key));
    setForm(f => { const copy = { ...f }; delete copy[key]; return copy; });
  };

  const [measureSearch, setMeasureSearch] = useState({});
  const [measureOpen, setMeasureOpen] = useState({});

  const addMeasure = () => set("household_measures", [...form.household_measures, { name: "", quantity: 1, weight_grams: "" }]);
  const removeMeasure = (i) => set("household_measures", form.household_measures.filter((_, idx) => idx !== i));
  const updateMeasure = (i, key, val) => {
    const arr = [...form.household_measures];
    arr[i] = { ...arr[i], [key]: val };
    set("household_measures", arr);
  };

  const selectMeasure = (i, name) => {
    updateMeasure(i, "name", name);
    setMeasureSearch(s => ({ ...s, [i]: name }));
    setMeasureOpen(o => ({ ...o, [i]: false }));
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      toast({
        title: "Falta el nombre del alimento",
        description: "Ingresa un nombre antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    const portionGrams = REFERENCE_GRAMS;
    if (!Number.isFinite(portionGrams) || portionGrams <= 0) {
      toast({
        title: "Porción inválida",
        description: "La porción en gramos debe ser mayor que cero.",
        variant: "destructive",
      });
      return;
    }

    const nutrientFields = [...FIXED_NUTRIENTS, ...extraNutrients];
    for (const nutrient of nutrientFields) {
      const parsedValue = toOptionalNumber(form[nutrient.key]);
      if (isInvalidNonNegative(parsedValue)) {
        toast({
          title: "Valor nutricional inválido",
          description: `${nutrient.label} debe ser un número válido mayor o igual a cero.`,
          variant: "destructive",
        });
        return;
      }
    }

    for (const measure of form.household_measures) {
      const hasAnyValue = (measure.name || "").trim() || measure.quantity !== "" || measure.weight_grams !== "";
      if (!hasAnyValue) continue;

      const quantity = toOptionalNumber(measure.quantity);
      const weightGrams = toOptionalNumber(measure.weight_grams);

      if (!(measure.name || "").trim()) {
        toast({
          title: "Medida casera incompleta",
          description: "Cada medida casera debe tener un nombre.",
          variant: "destructive",
        });
        return;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast({
          title: "Cantidad inválida",
          description: `La cantidad de la medida casera \"${measure.name}\" debe ser mayor que cero.`,
          variant: "destructive",
        });
        return;
      }

      if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
        toast({
          title: "Peso inválido",
          description: `Los gramos de la medida casera \"${measure.name}\" deben ser mayores que cero.`,
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    const data = {
      ...form,
      name: trimmedName,
      category: normalizeFoodCategory(form.category),
      portion_grams: portionGrams,
      carbs: toOptionalNumber(form.available_carbs ?? form.carbs),
      available_carbs: toOptionalNumber(form.available_carbs ?? form.carbs),
      household_measures: form.household_measures
        .filter(m => (m.name || "").trim())
        .map(m => ({
          ...m,
          name: m.name.trim(),
          quantity: Number(m.quantity),
          weight_grams: Number(m.weight_grams),
        })),
    };

    nutrientFields.forEach((nutrient) => {
      data[nutrient.key] = toOptionalNumber(form[nutrient.key]);
    });

    // Si el nutricionista edita un alimento YA APROBADO (que pasó al maestro),
    // no puede modificarlo directamente. En su lugar creamos una "revisión":
    // una copia propia pendiente enlazada al maestro, que el admin evaluará.
    const isRevisionOfApproved = Boolean(nutritionistId) && Boolean(food?.id) && food?.review_status === "approved";

    try {
      if (isRevisionOfApproved) {
        await createFoodRevision(data, food.id, nutritionistId);
      } else {
        await saveFood(data, food?.id, nutritionistId);
      }
    } catch (error) {
      logger.error(food?.id ? "Error actualizando alimento:" : "Error creando alimento:", { error: error instanceof Error ? error.message : String(error) });
      setSaving(false);
      toast({
        title: food?.id ? "No se pudo actualizar el alimento" : "No se pudo crear el alimento",
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        variant: "destructive",
      });
      return;
    }
    setSaving(false);
    toast(
      isRevisionOfApproved
        ? {
            title: "Revisión enviada",
            description: `Tu cambio a "${trimmedName}" quedó pendiente de aprobación. El alimento publicado no se modifica hasta que el administrador lo apruebe.`,
          }
        : {
            title: food ? "Alimento actualizado" : "Alimento creado",
            description: `${trimmedName} se guardó correctamente.`,
          },
    );
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-semibold text-slate-800">{food ? "Editar alimento" : "Nuevo alimento"}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Nombre */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Nombre del alimento *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Ej. Arroz blanco cocido"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:bg-white transition-all"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Grupo de alimento</label>
            <select
              value={form.category}
              onChange={e => set("category", e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-slate-600"
            >
              <option value="">Seleccionar categoría</option>
              {FOOD_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Detalle nutricional */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Detalle nutricional por cada</label>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <input
                  type="number"
                  value={form.portion_grams}
                  readOnly
                  className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-center text-sm bg-slate-100 text-slate-500"
                />
                gramos
              </div>
            </div>
            <p className="mb-3 text-xs leading-5 text-slate-400">
              Esta ficha siempre se edita por 100 gramos. La opción gramos sigue disponible al usar el alimento en dietas o recetas.
            </p>
            <div className="bg-slate-50 rounded-2xl px-4 py-1">
              {/* Fixed nutrients */}
              {FIXED_NUTRIENTS.map(n => (
                <InputField
                  key={n.key}
                  label={n.label}
                  value={form[n.key]}
                  onChange={v => n.key === "available_carbs" ? setCarbs(v) : set(n.key, v)}
                  unit={n.unit}
                />
              ))}
              {/* Extra added nutrients */}
              {extraNutrients.map(n => (
                <InputField
                  key={n.key}
                  label={n.label}
                  value={form[n.key]}
                  onChange={v => n.key === "available_carbs" ? setCarbs(v) : set(n.key, v)}
                  unit={n.unit}
                  onRemove={n.key === "available_carbs" ? undefined : () => removeNutrient(n.key)}
                />
              ))}
            </div>

            {/* Nutrient picker */}
            <NutrientPicker
              addedKeys={extraNutrients.map(n => n.key)}
              onAdd={addNutrient}
            />
          </div>

          {/* Medidas caseras */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Medidas caseras (opcional)</label>
            <div className="space-y-2">
              {form.household_measures.map((m, i) => {
                const searchVal = measureSearch[i] !== undefined ? measureSearch[i] : m.name;
                const filtered = HOUSEHOLD_MEASURES.filter(hm =>
                  hm.toLowerCase().includes(searchVal.toLowerCase())
                );
                return (
                  <div key={i} className="flex items-start gap-2">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      placeholder="Cant."
                      value={m.quantity ?? 1}
                      onChange={e => updateMeasure(i, "quantity", parseFloat(e.target.value) || 1)}
                      className="w-16 text-sm border border-slate-200 rounded-xl px-2 py-2 text-center bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 flex-shrink-0"
                    />
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Buscar o escribir medida casera..."
                        value={searchVal}
                        onChange={e => {
                          setMeasureSearch(s => ({ ...s, [i]: e.target.value }));
                          updateMeasure(i, "name", e.target.value);
                          setMeasureOpen(o => ({ ...o, [i]: true }));
                        }}
                        onFocus={() => setMeasureOpen(o => ({ ...o, [i]: true }))}
                        onBlur={() => setTimeout(() => setMeasureOpen(o => ({ ...o, [i]: false })), 150)}
                        className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                      />
                      {measureOpen[i] && filtered.length > 0 && (
                        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-44 overflow-y-auto">
                          {filtered.slice(0, 30).map(hm => (
                            <button
                              key={hm}
                              type="button"
                              onMouseDown={() => selectMeasure(i, hm)}
                              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-500 transition-colors border-b border-slate-50 last:border-0"
                            >
                              {hm}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="g"
                      value={m.weight_grams}
                      onChange={e => updateMeasure(i, "weight_grams", parseNumericInputValue(e.target.value))}
                      className="w-20 text-sm border border-slate-200 rounded-xl px-2 py-2 text-center bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 flex-shrink-0"
                    />
                    <span className="text-xs text-slate-400 mt-2.5 flex-shrink-0">g</span>
                    <button onClick={() => removeMeasure(i)} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors mt-0.5 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                );
              })}
              <button onClick={addMeasure} className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-500 font-medium py-1">
                <Plus className="w-3.5 h-3.5" /> Añadir medida casera
              </button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Notas</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Observaciones adicionales..."
              rows={2}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
            className="flex-1 py-2.5 text-sm text-white bg-brand-500 hover:bg-brand-600 rounded-xl font-medium transition-colors disabled:opacity-40"
          >
            {saving ? "Guardando..." : food ? "Actualizar" : "Añadir alimento"}
          </button>
        </div>
      </div>
    </div>
  );
}