import React from "react";
import { Info } from "lucide-react";
import {
  calcBMI,
  calcComplexionFrame,
  correctedWeight,
  healthyWeightRange,
  idealWeightByBmi,
  idealWeightByComplexion,
  idealWeightHamwi,
  idealWeightWest,
  percentIdealWeight,
  weightChangePercent,
  LOSS_WINDOWS,
  nearestLossWindow,
  imcObjetivoPara,
} from "@/lib/anthropometry";
import { MissingAlert, SectionCard, SEVERITY_CLASS, v } from "./resultsShared";
import { getCurrentLocale } from '@/lib/formatLocale';

// Días entre dos fechas 'YYYY-MM-DD' (o hasta hoy si falta la segunda).
const daysBetween = (fromDate, toDate) => {
  if (!fromDate) return null;
  const from = new Date(`${fromDate}T12:00:00`).getTime();
  const to = toDate ? new Date(`${toDate}T12:00:00`).getTime() : Date.now();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
};

// "2 meses", "3 semanas": el tiempo transcurrido importa tanto como el % —
// un 6 % en seis meses es intrascendente y en un mes es una alarma.
const formatDayMonth = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), { day: "numeric", month: "short" }).format(date);
};

// Etiqueta corta de cada ventana para las píldoras del criterio.
const WINDOW_SHORT = { "1w": "1 sem", "1m": "1 mes", "3m": "3 m", "6m": "6 m" };

const humanizeDays = (days) => {
  if (days == null) return null;
  if (days < 14) return `${days} ${days === 1 ? "día" : "días"}`;
  if (days < 60) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} ${months === 1 ? "mes" : "meses"}`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return `${years} ${years === 1 ? "año" : "años"}`;
};

// ── IMC + Peso Ideal ──────────────────────────────────────────────────────────
// Conectado al módulo `@/lib/anthropometry` con cortes oficiales del Excel.
export default function PesoSection({ data, sex, ageYears, patient, onSetField }) {
  const w = data.weight, h = data.height;
  const wrist = data.perimeters?.wrist;

  // Cambio de peso respecto del peso habitual (Datos generales).
  //
  // Blackburn es un criterio de TAMIZAJE DE RIESGO: presupone pérdida
  // involuntaria, como la del paciente hospitalizado. Aplicarlo a alguien que
  // baja de peso siguiendo su plan marcaría "pérdida severa" justo cuando el
  // tratamiento está funcionando. Por eso solo se clasifica si el nutricionista
  // declara que la pérdida fue involuntaria; mientras no lo haga se muestra el
  // porcentaje sin semáforo.
  //
  // Tanto la intención como la ventana se guardan en LA CONSULTA, no en el
  // paciente: junto al peso habitual quedarían congeladas y meses después esa
  // misma pérdida se seguiría juzgando con el criterio de entonces.
  // Por defecto se asume INTENCIONAL: en consulta ambulatoria la mayoría de las
  // pérdidas son buscadas, y no clasificar evita la falsa alarma. El tamizaje de
  // riesgo se activa marcando "involuntaria".
  const habitual = patient?.reference_weights?.habitual ?? null;
  const isInvoluntary = data.weight_loss_intent === "involuntary";
  const lossDays = daysBetween(habitual?.since, data.date);
  const windowOverride = data.weight_change_window || null;
  const autoWindow = nearestLossWindow(lossDays);
  const effectiveWindow = windowOverride || autoWindow;
  const weightChange = weightChangePercent(
    habitual?.kg,
    w,
    isInvoluntary ? lossDays : null,
    isInvoluntary ? windowOverride : null,
  );
  const lostKg = habitual?.kg != null && v(w) ? Math.round((habitual.kg - w) * 10) / 10 : null;
  const isLoss = weightChange.value != null && weightChange.value > 0;

  // Progreso desde la consulta anterior. Es OTRO indicador: mide el efecto de la
  // intervención, no riesgo nutricional, así que va sin clasificación ni color.
  // Se toma la medición previa más reciente con peso (estrictamente anterior a
  // la fecha de esta consulta, lo que excluye la que se está editando).
  // Se calculan dos referencias: la consulta anterior (efecto entre controles)
  // y la primera (avance acumulado desde que empezó el tratamiento). Si el
  // paciente solo tiene dos evaluaciones ambas coinciden y se muestra una sola.
  const priorMeasurements = v(w) && data.date
    ? (patient?.measurements || [])
        .filter((m) => m?.date && m.date < data.date && v(m.weight))
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const previous = priorMeasurements[priorMeasurements.length - 1] || null;
  const first = priorMeasurements.length > 1 ? priorMeasurements[0] : null;

  const compareWith = (reference) => reference && ({
    date: reference.date,
    kg: Math.round((w - reference.weight) * 10) / 10,
    pct: Math.round(((w - reference.weight) / reference.weight) * 1000) / 10,
    days: daysBetween(reference.date, data.date),
  });
  const sincePrev = compareWith(previous);
  const sinceFirst = compareWith(first);

  // IMC con clasificación adulto/AM según Excel.
  const bmi = calcBMI(w, h, ageYears);
  const isObese = bmi.category?.startsWith("obesidad");

  // Peso ideal: West, Hamwi, IMC objetivo y por complexión (si hay muñeca).
  const west = idealWeightWest(h, sex);
  const hamwi = idealWeightHamwi(h, sex);
  const byBmi = idealWeightByBmi(h, ageYears);
  const frame = calcComplexionFrame(h, wrist, sex);
  const byComplex = idealWeightByComplexion(h, sex, frame.value);

  // Peso corregido (solo en obesidad) usando West como referencia estándar.
  const corrected = correctedWeight(w, west.value, bmi.category);

  // Rango saludable según grupo etario.
  const range = healthyWeightRange(h, ageYears);

  const formulas = [
    { name: "West", res: west },
    { name: "Hamwi", res: hamwi },
    // El rótulo lee el mismo IMC que usó la fórmula; no lleva copia propia.
    { name: `IMC objetivo (${imcObjetivoPara(ageYears)})`, res: byBmi },
    // Complexión: se incluye si hay valor (talla en rango) o si la tabla
    // explícitamente no aplica para esa talla (mostramos "Tablas no disponibles").
    ...(byComplex.value != null || byComplex.classification === "Tablas no disponibles"
      ? [{
          name: `Complexión ${frame.classification?.toLowerCase() ?? "—"}`,
          res: byComplex,
        }]
      : []),
  ];

  return (
    <SectionCard title="Estado General y Peso Ideal" color="teal">
      {/* IMC */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">IMC Actual</p>
        {bmi.value != null ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold text-brand-500 tabular-nums">{bmi.value.toFixed(1)}</span>
              <span className="text-xs text-slate-400 font-medium">kg/m²</span>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${SEVERITY_CLASS[bmi.severity] || SEVERITY_CLASS.info}`}>
                {bmi.classification}
              </span>
              {ageYears != null && ageYears >= 60 && (
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Adulto mayor</span>
              )}
            </div>
            {/* Gauge de zonas IMC (escala 15–40). Marcador en el valor actual.
                Solo presentación; las clasificaciones siguen viniendo del lib. */}
            <div className="mt-3 max-w-[320px]">
              <div className="relative">
                <div className="flex h-2 w-full overflow-hidden rounded-full">
                  <div className="bg-sky-300" style={{ width: "14%" }} title="Delgadez" />
                  <div className="bg-emerald-400" style={{ width: "26%" }} title="Normal" />
                  <div className="bg-amber-300" style={{ width: "20%" }} title="Sobrepeso" />
                  <div className="bg-rose-300" style={{ width: "40%" }} title="Obesidad" />
                </div>
                <div
                  className="absolute -top-1 -translate-x-1/2"
                  style={{ left: `${Math.max(0, Math.min(100, ((bmi.value - 15) / 25) * 100))}%` }}
                >
                  <div className="h-4 w-1.5 rounded-full bg-slate-800 shadow ring-2 ring-white" />
                </div>
              </div>
              <div className="mt-1 flex justify-between text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                <span>Bajo</span><span>Normal</span><span>Sobrep.</span><span>Obesidad</span>
              </div>
            </div>
          </>
        ) : (
          <MissingAlert fields={bmi.missing ?? ["Peso", "Talla"]} />
        )}
      </div>

      {/* Tabla de pesos ideales */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Peso Ideal</p>
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-400 font-bold mb-2 px-1">
          <span>Fórmula</span><span className="text-right">Valor (kg)</span><span>% del ideal</span>
        </div>
        {formulas.map(({ name, res }) => {
          const val = res.value;
          const range = res.range;
          const tablasNoDisp = res.classification === "Tablas no disponibles";

          // Las fórmulas por complexión dan un RANGO, no un valor. Ahí el
          // criterio sigue siendo caer dentro: el rango ya es la referencia y
          // un porcentaje contra su punto medio se inventaría precisión.
          //
          // Para las que dan un valor único se usa el % de peso ideal, que es
          // criterio clínico y además proporcional. El anterior "±3 kg" no
          // salía de ninguna guía y daba etiquetas contradictorias entre
          // fórmulas para un mismo paciente. Ver percentIdealWeight().
          const pi = range ? null : percentIdealWeight(v(w) ? w : null, val);

          const within = range ? v(w) && w >= range.min && w <= range.max : null;

          const diagLabel = !v(w) || val == null
            ? "—"
            : range
              ? (within ? "Dentro del rango" : w < range.min ? "Por debajo" : "Por encima")
              : `${pi?.value ?? "—"} % · ${pi?.label ?? ""}`;

          const SEVERIDAD_PI = {
            normal: "good",
            sobrepeso: "warn",
            desnutricion_leve: "warn",
            obesidad: "bad",
            desnutricion_moderada: "bad",
            desnutricion_severa: "bad",
          };

          const diagSeverity = !v(w) || val == null
            ? "info"
            : range
              ? (within ? "good" : "bad")
              : (SEVERIDAD_PI[pi?.category] ?? "info");

          return (
            <div key={name} className="grid grid-cols-3 gap-2 px-1 py-2 border-b border-slate-50 last:border-0 items-center">
              <span className="text-sm text-slate-600">{name}</span>
              {tablasNoDisp ? (
                // Talla fuera de la cobertura de la tabla de complexión.
                <div className="col-span-2">
                  <span className="text-xs font-semibold text-slate-500">Tablas no disponibles</span>
                  {res.detail && (
                    <span className="block text-[10px] text-slate-400">{res.detail}</span>
                  )}
                </div>
              ) : val == null ? (
                <div className="col-span-2"><MissingAlert fields={res.missing ?? ["Talla"]} /></div>
              ) : (
                <>
                  {/* Mejora #2: la unidad kg se muestra explícita junto al rango. */}
                  <span className="text-sm font-bold text-slate-800 text-right tabular-nums">
                    {range ? `${range.min}–${range.max} kg` : `${val} kg`}
                  </span>
                  {/* Mejora #1: chip de severidad coherente con el resto del UI. */}
                  <span className={`justify-self-start text-xs font-semibold px-2.5 py-1 rounded-full ${SEVERITY_CLASS[diagSeverity]}`}>
                    {diagLabel}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Peso corregido (solo si IMC = obesidad).
          Mejora #14: el rojo se reserva para alertas; este es un valor de
          cálculo (peso de trabajo en obesidad), no una alarma → color primario. */}
      {isObese && corrected.value != null && (
        <div className="border-t border-slate-100 pt-4 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Peso corregido</p>
              <p className="text-[11px] text-slate-400">{corrected.detail}</p>
            </div>
            <span className="text-lg font-bold text-brand-500 tabular-nums">{corrected.value} kg</span>
          </div>
        </div>
      )}

      {/* Cambio de peso respecto del peso habitual. Mismo formato de una línea
          que "Peso corregido": la tarjeta ya es larga y este es un dato de
          apoyo, no el protagonista. Lo que no cabe va en tooltips. */}
      <div className="border-t border-slate-100 pt-4 mt-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cambio de peso</p>
            <p className="text-[11px] text-slate-400 truncate">
              {weightChange.value == null
                ? (habitual?.kg == null ? "Sin peso habitual · Datos generales" : "Falta el peso de esta consulta")
                : `${habitual.kg} → ${w} kg${lostKg ? ` · ${Math.abs(lostKg)} kg` : ""}${humanizeDays(lossDays) ? ` en ${humanizeDays(lossDays)}` : ""}`}
            </p>

            {isLoss && onSetField ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {/* Intención de la pérdida. Blackburn tamiza riesgo nutricional
                    (pérdida involuntaria); no mide el resultado de un plan de
                    descenso, donde bajar de peso es el objetivo cumplido. */}
                <div
                  className="inline-flex rounded-[9px] bg-slate-100 p-0.5"
                  title="Los criterios de Blackburn solo aplican a la pérdida involuntaria."
                >
                  {[
                    { key: "intentional", label: "Intencional" },
                    { key: "involuntary", label: "Involuntaria" },
                  ].map((option) => {
                    const active = option.key === "involuntary" ? isInvoluntary : !isInvoluntary;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => onSetField("weight_loss_intent", option.key)}
                        className={`rounded-[7px] px-2 py-[3px] text-[10px] font-bold transition ${
                          active ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {/* Ventana de tiempo: solo importa cuando se está clasificando.
                    La propuesta automática queda marcada; volver a pulsarla
                    devuelve el control al cálculo por fechas. */}
                {isInvoluntary ? (
                  <div className="inline-flex items-center gap-1">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-300">Criterio</span>
                    {LOSS_WINDOWS.map((win) => {
                      const active = win.key === effectiveWindow;
                      return (
                        <button
                          key={win.key}
                          type="button"
                          title={active && !windowOverride ? "Propuesto por las fechas" : `Clasificar con el criterio de ${win.label}`}
                          onClick={() => onSetField("weight_change_window", windowOverride === win.key ? null : win.key)}
                          className={`rounded-full px-1.5 py-[2px] text-[10px] font-bold transition ${
                            active
                              ? "bg-brand-50 text-brand-500"
                              : "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                          }`}
                        >
                          {WINDOW_SHORT[win.key]}
                        </button>
                      );
                    })}
                    {effectiveWindow && !windowOverride ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300">auto</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {weightChange.value == null ? (
            <span className="text-lg font-bold text-slate-200">—</span>
          ) : (
            <div className="flex items-center gap-2">
              {weightChange.classification ? (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${SEVERITY_CLASS[weightChange.severity] || SEVERITY_CLASS.info}`}>
                  {weightChange.classification}
                </span>
              ) : weightChange.value < 0 ? (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${SEVERITY_CLASS.info}`}>Ganancia</span>
              ) : isInvoluntary ? (
                // Declarada involuntaria pero sin ventana: falta la fecha del
                // peso habitual o el intervalo excede la tabla.
                <span
                  title="Elige la ventana de tiempo, o registra en Datos generales cuándo tenía ese peso, para clasificar la pérdida."
                  className="cursor-help text-amber-400"
                >
                  <Info className="w-3.5 h-3.5" />
                </span>
              ) : null}
              <span className="text-lg font-bold text-brand-500 tabular-nums whitespace-nowrap">
                {Math.abs(weightChange.value).toFixed(1)} %
              </span>
            </div>
          )}
        </div>

        {/* Progreso de la intervención: cuánto cambió desde la consulta previa.
            Deliberadamente sin colores ni etiquetas de riesgo — aquí las dos
            fechas son del propio historial, así que no hay ventana que estimar. */}
        {sincePrev ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[10px] bg-slate-50/70 px-2.5 py-1.5">
            {[
              { label: "Desde", data: sincePrev },
              ...(sinceFirst ? [{ label: "Inicio", data: sinceFirst }] : []),
            ].map((entry, index) => (
              <div key={entry.data.date} className="flex min-w-0 flex-1 basis-full items-baseline gap-1.5 sm:basis-0">
                {index > 0 ? <span className="mr-1 hidden text-slate-200 sm:inline">|</span> : null}
                <span
                  className="truncate text-[10.5px] text-slate-400"
                  title={entry.data.days ? `${humanizeDays(entry.data.days)} atrás` : undefined}
                >
                  {entry.label} {formatDayMonth(entry.data.date)}
                </span>
                <span className="whitespace-nowrap text-[11.5px] font-bold tabular-nums text-slate-600">
                  {entry.data.kg > 0 ? "+" : ""}{entry.data.kg} kg
                  <span className="ml-1 font-semibold text-slate-400">
                    ({entry.data.pct > 0 ? "+" : ""}{entry.data.pct} %)
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Rango saludable */}
      <div className="border-t border-slate-100 pt-4 mt-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Rango de Peso Normal</p>
        <div className="flex gap-6">
          <div>
            <p className="text-xs text-slate-400">Peso mínimo</p>
            <p className="font-bold text-slate-700">{range.min.value != null ? `${range.min.value} kg` : <MissingAlert fields={["Talla"]} />}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Peso máximo</p>
            <p className="font-bold text-slate-700">{range.max.value != null ? `${range.max.value} kg` : <MissingAlert fields={["Talla"]} />}</p>
          </div>
          {ageYears != null && ageYears >= 60 && (
            <div className="text-[11px] text-slate-400 self-end">
              <Info className="inline w-3 h-3 mr-0.5" />
              Cortes adulto mayor
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
