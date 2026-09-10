import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Clock, FlaskConical, Sparkles, X, Zap } from "lucide-react";
import { buildMicronutrientSummary, EXTENDED_MICRONUTRIENT_KEYS, PRIMARY_MICRONUTRIENT_KEYS } from "@/lib/foodNutrients";
import { getMealEmoji } from "@/components/diet/mealEmojis";
import { MACRO_HEX, MACRO_ORDER, MACRO_STYLES } from "@/lib/macroColors";

// Paleta de macros: CHO = amarillo, PRO = rojo, GRA = celeste. Los colores
// salen de @/lib/macroColors, la única definición que hay en toda la app, y las
// dos vistas de este panel ("General" y "Por comida") beben de la misma: antes
// repetían los colores por separado y en los chips por comida PRO había quedado
// celeste y GRA rojo, al revés que en el resto de la app.
//
// `chipText` sale del mismo sitio que `pctColor` a propósito, para que el texto
// del chip y el porcentaje de la tarjeta sean exactamente el mismo tono.
//
// Aquí solo queda lo que es propio de este panel: el degradado de la tarjeta y
// el fondo del chip.
const MACRO_DECORACION = {
  carbs: { cardBg: "bg-gradient-to-br from-[#fffaeb] to-[#fef3c7]", chipBg: "bg-amber-50" },
  protein: { cardBg: "bg-gradient-to-br from-[#fef2f2] to-[#fee2e2]", chipBg: "bg-red-50" },
  fat: { cardBg: "bg-gradient-to-br from-[#ecf8ff] to-[#cffafe]", chipBg: "bg-cyan-50" },
};

const MACRO_PALETTE = MACRO_ORDER.map((key) => ({
  key,
  label: MACRO_STYLES[key].name,
  short: MACRO_STYLES[key].label,
  barColor: MACRO_HEX[key].fill,
  pctColor: MACRO_HEX[key].text,
  chipText: MACRO_STYLES[key].value,
  chipDot: MACRO_STYLES[key].dot,
  ...MACRO_DECORACION[key],
}));

// Cada macro de la paleta con el campo que le corresponde en el resumen por
// comida (ahí las proteínas se llaman `prot`, no `protein`).
const MACRO_MEAL_FIELD = { carbs: "carbs", protein: "prot", fat: "fat" };

// Resumen nutricional lateral del editor de dieta "por alimentos": calorías del
// día, toggle General / Por comida, macros (con % de aporte calórico) y
// micronutrientes. Extraído de DietCreator; estilo alineado con el sidebar del
// editor por intercambios (el círculo de meta es exclusivo de aquél, aquí barra
// lineal). Se exporta como `LeftPanel` para no cambiar el call-site del editor.
export default function LeftPanel({ totals, targets, meals, patientId, rdiTargets = null, rdiLabel = null, onPrint: _onPrint, onClose, collapsed = false, onToggleCollapse }) {
  const [viewMode, setViewMode] = useState("general");
  const [microsOpen, setMicrosOpen] = useState(false);
  const calPct = targets.calories > 0 ? Math.round((totals.calories / targets.calories) * 100) : 0;

  const mealTotals = meals.map((meal) => {
    const cal = meal.items.reduce((sum, item) => sum + (item.calories || 0) * (item.quantity || 1), 0);
    const prot = meal.items.reduce((sum, item) => sum + (item.protein || 0) * (item.quantity || 1), 0);
    const carbs = meal.items.reduce((sum, item) => sum + (item.carbs || 0) * (item.quantity || 1), 0);
    const fat = meal.items.reduce((sum, item) => sum + (item.fat || 0) * (item.quantity || 1), 0);

    return {
      id: meal.id,
      name: meal.name,
      time: meal.time,
      // Datos extra para el resumen visual por comida en el sidebar
      icon: getMealEmoji(meal),
      itemCount: meal.items.length,
      cal: Math.round(cal),
      prot: Math.round(prot),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
    };
  });

  const totalLoadedCalories = mealTotals.reduce((sum, meal) => sum + meal.cal, 0);
  const mealSummaries = mealTotals.map((meal) => ({
    ...meal,
    pct: totalLoadedCalories > 0 ? Math.round((meal.cal / totalLoadedCalories) * 100) : 0,
  }));

  const totalCalFromMacros = totals.carbs * 4 + totals.protein * 4 + totals.fat * 9;
  // Estilo de macros unificado con el sidebar de "Dieta por intercambios"
  // (tarjetas con gradiente por macro). Se conserva el dato propio de alimentos:
  // el % de aporte calórico de cada macro (calPctMacro), que intercambios no muestra.
  const macros = MACRO_PALETTE;

  const micros = buildMicronutrientSummary(totals, PRIMARY_MICRONUTRIENT_KEYS).map((micro) => ({
    ...micro,
    name: micro.label,
    val: micro.value,
    barColor: micro.key === "sodium" ? "bg-rose-400" : "bg-emerald-400",
  }));

  // Con RDI del paciente mostramos todo el set de nutrientes del RDI; sin él,
  // el subconjunto genérico de siempre.
  const extendedKeys = rdiTargets ? Object.keys(rdiTargets) : EXTENDED_MICRONUTRIENT_KEYS;
  const extendedMicros = buildMicronutrientSummary(totals, extendedKeys, rdiTargets || undefined).map((micro) => ({
    ...micro,
    name: micro.label,
    val: micro.value,
    barColor: "bg-emerald-400",
  }))
    // Los que tienen aporte primero; los "sin dato" al final (orden estable).
    .sort((a, b) => (b.val ? 1 : 0) - (a.val ? 1 : 0));

  if (collapsed) {
    return (
      <aside className="flex h-full w-[4.25rem] flex-shrink-0 flex-col items-center border-r border-slate-200 bg-white px-2 py-4 shadow-[10px_0_15px_-3px_rgba(0,0,0,0.03)]">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          aria-label="Expandir resumen nutricional"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="mt-4 flex flex-1 items-center justify-center">
          <span className="-rotate-180 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-400 [writing-mode:vertical-rl]">
            Nutrientes
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full max-w-[18rem] flex-shrink-0 flex-col border-r border-[#e8e5ff] bg-[#fcfbff] shadow-[10px_0_15px_-3px_rgba(0,0,0,0.03)] md:w-[16.5rem] xl:w-[18rem]">
      {/* Header: título compacto + botones contextuales (cerrar en móvil, colapsar en desktop) */}
      <div className="flex-shrink-0 border-b border-[#ece8fb] bg-gradient-to-b from-white to-[#f7f6ff]/60 px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-brand-50 to-[#f4f2ff] text-brand-500 ring-1 ring-[#e7e3ff] shadow-[0_1px_2px_rgba(59,95,235,0.10)]">
              <Sparkles className="h-[15px] w-[15px]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold tracking-tight text-slate-800 leading-tight">Resumen del Día</h3>
              <p className="text-[10px] text-slate-400 leading-tight">Análisis nutricional</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 transition hover:bg-slate-50 md:hidden"
                aria-label="Cerrar resumen"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {onToggleCollapse ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden h-8 w-8 items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 transition hover:bg-slate-50 md:inline-flex"
                aria-label="Minimizar resumen nutricional"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Tarjeta principal de calorías: header con gradiente (familia visual de
            "Dieta por intercambios"), pero lineal — el círculo de meta es exclusivo
            del editor por intercambios. */}
        <div className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#3b5feb_0%,#5674f5_52%,#8aa0ff_100%)] px-[18px] py-[18px] text-white shadow-[0_18px_38px_-30px_rgba(59,95,235,0.74)]">
          <div className="absolute -right-12 top-8 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-12 left-16 h-20 w-20 rounded-full bg-[#c7c2ff]/18 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Calorías totales</p>
              <div className="mt-1 flex items-end gap-1">
                <span className="text-[40px] font-extrabold leading-none tracking-tight">{Math.round(totals.calories)}</span>
                <span className="pb-1 text-[13px] font-semibold text-white/74">/ {targets.calories} kcal</span>
              </div>
            </div>
            <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${calPct > 100 ? "bg-coral-500 text-white" : "bg-white/18 text-white"}`}>{calPct}%</span>
          </div>
          <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-white/16">
            <div
              className={`h-full rounded-full transition-all duration-500 ${calPct > 100 ? "bg-[#ffd1cf]" : "bg-[#95ff69]"}`}
              style={{ width: `${Math.min(calPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Toggle General/Por comida — estilo unificado con intercambios */}
        <div className="flex items-center gap-1 rounded-[18px] border border-[#e7e4ff] bg-[#f7f6ff]/92 p-1 shadow-sm shadow-slate-200/20">
          {[
            { key: "general", label: "General", Icon: Zap },
            { key: "meals", label: "Por comida", Icon: Clock },
          ].map((option) => {
            const active = viewMode === option.key;
            const Icon = option.Icon;
            return (
              <button
                key={option.key}
                onClick={() => setViewMode(option.key)}
                className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[14px] px-3 text-[11px] font-semibold transition-colors ${active ? "bg-[linear-gradient(135deg,#3b5feb_0%,#6d81f2_100%)] text-white shadow-[0_10px_18px_-18px_rgba(59,95,235,0.76)]" : "text-slate-400 hover:bg-white hover:text-slate-700"}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {option.label}
              </button>
            );
          })}
        </div>

        {viewMode === "general" ? (
          <>
            {/* Macros: cada macro como mini-card con gota de color y dos métricas claras */}
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  <Zap className="w-3.5 h-3.5" /> Macros
                </h4>
                <span className="text-[10px] font-medium text-slate-400">g / objetivo</span>
              </div>
              <div className="rounded-[20px] border border-[#ece8fb] bg-white/92 p-3 shadow-sm shadow-slate-200/15">
                <div className="space-y-2">
                  {macros.map(({ key, label, barColor, pctColor, cardBg }) => {
                    const val = Math.round(totals[key] || 0);
                    const tgt = Math.round(targets[key] || 1);
                    const pct = Math.min(Math.round((val / tgt) * 100), 100);
                    const calContrib = key === "fat" ? val * 9 : val * 4;
                    const calPctMacro = totalCalFromMacros > 0 ? Math.round((calContrib / totalCalFromMacros) * 100) : 0;

                    return (
                      <div key={key} className={`rounded-[15px] border border-slate-100/90 px-3 py-2.5 ${cardBg}`}>
                        <div className="mb-1.5 flex items-baseline gap-1.5">
                          <span className="text-[13px] font-semibold text-slate-700">{label}</span>
                          <span className="ml-auto text-[13px] font-bold text-slate-800">{val}g <span className="font-normal text-slate-300">/ {tgt}g</span></span>
                          <span className="text-[10px] font-bold" style={{ color: pctColor }}>{calPctMacro}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full border border-white/80 bg-white/80">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Micronutrientes: lista compacta sin separador grueso, con barras finas */}
            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <h4 className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  <FlaskConical className="w-3.5 h-3.5" /> Micronutrientes
                  {rdiLabel ? <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-brand-500">RDI · {rdiLabel}</span> : null}
                </h4>
              </div>
              <div className="space-y-2.5 rounded-[20px] border border-[#ece8fb] bg-white/92 p-3.5 shadow-sm shadow-slate-200/15">
                {micros.map((micro) => {
                  const noData = !micro.val;
                  const pct = micro.target && micro.val ? Math.min(Math.round((micro.val / micro.target) * 100), 100) : 0;
                  return (
                    <div key={micro.name}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-600 font-medium truncate">{micro.name} <span className="text-slate-400 font-normal">({micro.unit})</span></span>
                        <span className="font-bold text-slate-700 flex-shrink-0">
                          {noData ? <span className="font-medium text-slate-300">sin dato</span> : <>{micro.val} <span className="text-brand-500 ml-0.5 text-[9px] font-semibold">{pct}%</span></>}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1">
                        <div className={`${micro.barColor} h-1 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}

                {!microsOpen ? (
                  <button
                    onClick={() => setMicrosOpen(true)}
                    className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-dashed border-slate-200 py-1.5 text-[11px] font-semibold text-brand-500 transition-colors hover:bg-brand-50 hover:border-brand-500/30"
                  >
                    <ChevronDown className="w-3 h-3" />
                    Ver más
                  </button>
                ) : null}

                {microsOpen ? (
                  <div className="space-y-2.5 pt-1 mt-1 border-t border-slate-100">
                    {extendedMicros.map((micro) => {
                      const noData = !micro.val;
                      const pct = micro.target && micro.val ? Math.min(Math.round((micro.val / micro.target) * 100), 100) : 0;
                      return (
                        <div key={micro.key}>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-slate-600 font-medium truncate">{micro.name} <span className="text-slate-400 font-normal">({micro.unit})</span></span>
                            <span className="font-bold text-slate-700 flex-shrink-0">
                              {noData ? <span className="font-medium text-slate-300">sin dato</span> : <>{micro.val} <span className="text-brand-500 ml-0.5 text-[9px] font-semibold">{pct}%</span></>}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1">
                            <div className={`${micro.barColor} h-1 rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          // Vista "Por comida": tarjetas con emoji, kcal, barra de % y chips de macros
          <div className="space-y-2.5">
            {mealSummaries.filter((meal) => meal.cal > 0).length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                <Clock className="w-5 h-5 text-slate-300" />
                <p className="text-[11px] italic text-slate-400 leading-snug">Agrega alimentos para ver la<br/>distribución por tiempo de comida.</p>
              </div>
            ) : mealSummaries.filter((meal) => meal.cal > 0).map((meal) => (
              <div key={meal.id} className="group rounded-[18px] border border-slate-100 bg-white p-3 transition hover:border-slate-200 hover:shadow-sm">
                {/* Cabecera: emoji + nombre/hora + kcal */}
                <div className="flex items-center justify-between gap-2.5 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-slate-50 to-slate-100 text-base ring-1 ring-slate-200/60">
                      {meal.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate leading-tight">{meal.name}</p>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5 flex items-center gap-1">
                        {meal.time ? <><Clock className="w-2.5 h-2.5" />{meal.time}</> : null}
                        {meal.time && meal.itemCount ? <span className="text-slate-300">·</span> : null}
                        {meal.itemCount ? <span>{meal.itemCount} {meal.itemCount === 1 ? "alimento" : "alimentos"}</span> : null}
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[13px] font-extrabold text-slate-800 leading-none tabular-nums">{meal.cal}</p>
                    <p className="text-[9px] font-medium text-slate-400 mt-0.5">kcal</p>
                  </div>
                </div>

                {/* Barra de % del total con badge integrado */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500"
                      style={{ width: `${Math.min(meal.pct, 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-brand-500 tabular-nums w-8 text-right">{meal.pct}%</span>
                </div>

                {/* Chips de macros */}
                <div className="flex items-center gap-1 text-[10px] font-semibold">
                  {MACRO_PALETTE.map(({ key, short, chipBg, chipText, chipDot }) => (
                    <span
                      key={key}
                      className={`flex-1 inline-flex items-center justify-center gap-1 rounded-md px-1.5 py-1 ${chipBg} ${chipText}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${chipDot}`} />{short} {meal[MACRO_MEAL_FIELD[key]]}g
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
