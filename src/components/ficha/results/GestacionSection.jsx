import React, { useMemo, useState } from "react";
import { Info, LineChart } from "lucide-react";
import {
  assessGestation,
  formatGestationalAge,
  gestationalAgeAt,
  GAIN_TABLE_SOURCE,
} from "@/lib/gestation/gestationalGain";
import GainChart from "../gestation/GainChart";
import { MissingAlert, SectionCard, SEVERITY_CLASS } from "./resultsShared";

// Celda de contexto: etiqueta arriba, dato debajo. Las tres del encabezado
// comparten forma para que se lean como un bloque y no como tres cosas sueltas.
function Dato({ etiqueta, children }) {
  return (
    <div className="rounded-[12px] bg-slate-50/70 px-3.5 py-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{etiqueta}</p>
      {children}
    </div>
  );
}

// ── Evaluación de la gestante ────────────────────────────────────────────────
// Reemplaza a PesoSection cuando hay una gestación activa. El IMC de adulto, el
// peso ideal, el peso corregido y el % de cambio de peso (Blackburn) NO se
// muestran: en embarazo el aumento es lo esperado y esos indicadores darían una
// lectura contradictoria. El Excel del nutricionista hace lo mismo — marca el
// % de peso perdido como "no corresponde".
export default function GestacionSection({ data, patient, pregnancy }) {
  const consultDate = data?.date || null;
  const age = gestationalAgeAt(pregnancy, consultDate);
  const talla = data?.height ?? null;
  const [showChart, setShowChart] = useState(false);

  // Un punto por control de la gestación, en orden cronológico y con la semana
  // que la paciente tenía EN ESA fecha (no la de hoy).
  const chartPoints = useMemo(() => {
    const measurements = Array.isArray(patient?.measurements) ? patient.measurements : [];
    return measurements
      .filter((m) => m?.date && m?.weight != null)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((m) => {
        const rowAge = gestationalAgeAt(pregnancy, m.date);
        if (!rowAge) return null;
        const assessment = assessGestation({
          prePregnancyKg: pregnancy?.prePregnancyKg,
          currentWeightKg: m.weight,
          heightCm: m.height,
          week: rowAge.weeks,
          type: pregnancy?.type || "single",
        });
        if (assessment.gainKg === null) return null;
        return {
          week: rowAge.weeks,
          gainKg: assessment.gainKg,
          date: m.date,
          weightKg: m.weight,
          diagnosis: assessment.diagnosis,
          severity: assessment.severity,
          ageLabel: formatGestationalAge(rowAge),
          range: assessment.range,
        };
      })
      .filter(Boolean);
  }, [patient?.measurements, pregnancy]);

  const result = assessGestation({
    prePregnancyKg: pregnancy?.prePregnancyKg,
    currentWeightKg: data?.weight,
    heightCm: talla,
    week: age?.weeks ?? null,
    type: pregnancy?.type || "single",
  });

  const gain = result.gainKg;

  return (
    <SectionCard title="Evaluación de la Gestante" color="rose">
      {/* ── Contexto: de qué gestante hablamos ────────────────────────────────
          Tres datos que enmarcan todo lo demás, en columnas del mismo peso.
          Antes iban en una fila suelta que dejaba la mitad de la pantalla en
          blanco y no dejaba claro que el IMC pregestacional es el que fija el
          rango de ganancia — no un indicador más. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Dato etiqueta="Edad gestacional">
          {age ? (
            <>
              <p className="flex items-baseline gap-1.5">
                <span className="text-[28px] font-extrabold leading-none text-[#ec4899] tabular-nums">{age.weeks}</span>
                <span className="text-sm font-semibold text-slate-500">
                  sem{age.days > 0 ? ` ${age.days} d` : ""}
                </span>
              </p>
              <p
                className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                title={age.source === "fum" ? "Calculada desde la fecha de última menstruación" : "Proyectada desde la ecografía"}
              >
                según {age.source === "fum" ? "FUM" : "ecografía"}
              </p>
            </>
          ) : (
            <MissingAlert fields={["FUM o ecografía"]} />
          )}
        </Dato>

        <Dato etiqueta="IMC pregestacional">
          {result.category ? (
            <>
              <p className="text-[28px] font-extrabold leading-none text-slate-800 tabular-nums">
                {result.bmi.toFixed(2)}
              </p>
              <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                {result.categoryLabel}
              </span>
            </>
          ) : (
            <p className="text-sm text-slate-300">—</p>
          )}
        </Dato>

        <Dato etiqueta="Tipo de embarazo">
          <p className="text-[15px] font-bold leading-none text-slate-700">
            {pregnancy?.type === "twin" ? "Múltiple" : "Único"}
          </p>
          <p className="mt-1.5 text-[10px] text-slate-400">
            {pregnancy?.type === "twin" ? "Rangos de gemelar" : "Rangos de gestación única"}
          </p>
        </Dato>
      </div>

      {/* ── Ganancia de peso: el protagonista ────────────────────────────────
          Es la pregunta que trae a la paciente al control, así que ocupa su
          propio bloque destacado en vez de ir como una fila más. */}
      <div className="mt-4 rounded-[16px] border border-[#fce7f3] bg-gradient-to-br from-[#fdf2f8] to-white p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#be185d]">
          Ganancia de peso
          {/* La cita de la tabla va en el tooltip: disponible para quien la
              necesite sin ocupar dos renglones en cada consulta. */}
          <span title={`Rangos según ${GAIN_TABLE_SOURCE}`} className="cursor-help text-[#f9a8d4] transition hover:text-[#be185d]">
            <Info className="h-3 w-3" />
          </span>
        </p>

        {result.missing.length > 0 ? (
          <div>
            <MissingAlert fields={result.missing} />
            {result.missing.includes("Peso pregestacional") && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Regístralo en <strong className="font-semibold text-slate-600">Condición de salud → Gestación</strong>.
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="flex items-baseline gap-1">
              <span className="text-[34px] font-extrabold leading-none text-brand-500 tabular-nums">
                {gain > 0 ? "+" : ""}{gain}
              </span>
              <span className="text-sm font-semibold text-slate-400">kg desde el peso pregestacional</span>
            </p>

            {result.range ? (
              <>
                {/* Barra: dónde cae la ganancia real dentro del rango esperado
                    para esta semana. Se ve de un vistazo si está justo al borde.
                    Ocupa todo el ancho -antes se quedaba en 340 px- y las
                    referencias van BAJO la zona verde en vez de repartidas en
                    los extremos, que obligaba a cruzar la vista para saber
                    dónde empezaba y acababa lo esperado. */}
                {(() => {
                  const { min, max } = result.range;

                  // LA ESCALA SE ARMA ALREDEDOR DEL RANGO ESPERADO, no de cero.
                  //
                  // Antes iba de 0 al valor mayor, y eso la volvía engañosa: con
                  // una ganancia de 11 kg y un rango de 7.4–10.8, la zona verde
                  // ocupaba de 67 % a 98 % del ancho y la paciente caía al 100 %.
                  // Se veía prácticamente dentro del verde cuando en realidad se
                  // había pasado. Peor que no tener barra.
                  //
                  // Ahora el rango esperado queda SIEMPRE centrado y ocupando
                  // algo menos de la mitad, así que estar fuera se ve fuera. El
                  // margen se amplía si hace falta para que el marcador entre.
                  const ancho = Math.max(max - min, 0.1);
                  const margen = ancho * 0.6;
                  const lo = Math.min(min - margen, gain - ancho * 0.2);
                  const hi = Math.max(max + margen, gain + ancho * 0.2);
                  const span = hi - lo;
                  const pct = (value) => `${(((value - lo) / span) * 100).toFixed(1)}%`;
                  const anchoZona = `${(((max - min) / span) * 100).toFixed(1)}%`;

                  const fueraPorArriba = gain > max;
                  const fueraPorAbajo = gain < min;
                  const colorMarcador = fueraPorArriba || fueraPorAbajo ? "bg-rose-600" : "bg-emerald-600";

                  return (
                    // Ancho contenido: a pantalla completa la barra se estiraba
                    // casi metro y medio y los topes del rango quedaban tan
                    // separados que costaba relacionarlos con el marcador.
                    <div className="mt-7 max-w-[560px]">
                      <div className="relative h-3 w-full rounded-full bg-slate-200/60">
                        <div
                          className="absolute h-3 rounded-full bg-emerald-400/70"
                          style={{ left: pct(min), width: anchoZona }}
                        />
                        {/* Los topes del rango, escritos donde están. Es lo que
                            se compara de un vistazo. */}
                        <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-bold text-emerald-700" style={{ left: pct(min) }}>
                          {min}
                        </span>
                        <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-bold text-emerald-700" style={{ left: pct(max) }}>
                          {max}
                        </span>
                        {/* "esperado" dentro de su propia zona verde. Antes iba
                            en un renglón centrado bajo toda la barra, repitiendo
                            unos números que ya estaban escritos arriba. */}
                        <span
                          className="absolute top-0 -translate-x-1/2 text-[9px] font-bold uppercase leading-3 tracking-wide text-emerald-900/70"
                          style={{ left: `calc(${pct(min)} + ${anchoZona} / 2)` }}
                        >
                          esperado
                        </span>
                        {/* Marcador de la paciente. Rojo si está fuera: el color
                            dice el veredicto sin leer nada. */}
                        <div className="absolute -translate-x-1/2" style={{ left: pct(gain), top: '-4px' }}>
                          <div className={`w-[3px] rounded-full ${colorMarcador} ring-2 ring-white`} style={{ height: '20px' }} />
                        </div>
                        <span
                          className={`absolute top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold ${fueraPorArriba || fueraPorAbajo ? "text-rose-600" : "text-emerald-700"}`}
                          style={{ left: pct(gain) }}
                        >
                          {gain > 0 ? "+" : ""}{gain} kg
                        </span>
                      </div>
                      {/* Qué significa moverse a cada lado. Sin esto, la barra
                          es una línea con números y hay que deducir hacia dónde
                          es "poco" y hacia dónde "demasiado". */}
                      <div className="mt-7 flex justify-between text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                        <span>gana de menos</span>
                        <span>gana de más</span>
                      </div>
                    </div>
                  );
                })()}

                {/* El objetivo, en la unidad en que se pesa a la paciente. Es lo
                    que se le dice en voz alta, así que va con el mismo peso
                    visual que la ganancia y no como pie de tabla. */}
                {/* Peso objetivo y ganancia esperada, juntos: son la misma
                    información en dos unidades, y el nutricionista usa una u
                    otra según hable con la paciente ("deberías estar en 68")
                    o mire la tabla ("le tocan 7.4 a 10.8"). Separados obligaban
                    a buscar dos veces. */}
                {result.recommendedWeight ? (
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[12px] bg-white/80 px-3.5 py-2.5 ring-1 ring-[#fbcfe8]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Debería pesar en la semana {result.week}
                      </p>
                      <p className="mt-0.5 text-[16px] font-extrabold text-slate-800 tabular-nums">
                        {result.recommendedWeight.min} – {result.recommendedWeight.max} kg
                      </p>
                    </div>
                    <div className="rounded-[12px] bg-white/80 px-3.5 py-2.5 ring-1 ring-[#fbcfe8]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Debería haber ganado
                      </p>
                      <p className="mt-0.5 text-[16px] font-extrabold text-slate-800 tabular-nums">
                        {result.range.min} – {result.range.max} kg
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* EL DIAGNÓSTICO CIERRA EL BLOQUE. Estaba como una pastilla
                    pequeña al lado de la cifra de ganancia, donde competía con
                    ella y perdía: es la conclusión de todo lo anterior, no una
                    etiqueta del número. Aquí llega después de haber visto la
                    ganancia, el rango y el peso objetivo, que es el orden en
                    que se razona.
                    Lleva además cuántos kilos sobran o faltan, porque "Alta
                    ganancia" no distingue entre pasarse 200 gramos y pasarse
                    cinco kilos. */}
                {result.diagnosis ? (
                  <div className={`mt-4 rounded-[12px] px-4 py-3 ${SEVERITY_CLASS[result.severity] || SEVERITY_CLASS.info}`}>
                    <p className="text-[15px] font-extrabold leading-tight">{result.diagnosis}</p>
                    <p className="mt-0.5 text-[11.5px] font-medium opacity-80">
                      {gain > result.range.max
                        ? `${(gain - result.range.max).toFixed(2)} kg por encima del máximo esperado`
                        : gain < result.range.min
                          ? `${(result.range.min - gain).toFixed(2)} kg por debajo del mínimo esperado`
                          : "Dentro del rango esperado para esta semana"}
                    </p>
                  </div>
                ) : null}
              </>
            ) : null}

            {/* Casos sin tabla (delgada + múltiple, o múltiple en el primer
                trimestre) y avisos de borde. */}
            {result.notes.map((note) => (
              <p key={note} className="mt-2.5 flex items-start gap-1.5 rounded-[9px] bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-700">
                <Info className="mt-[1px] h-3 w-3 flex-shrink-0" />
                {note}
              </p>
            ))}
          </>
        )}
      </div>

      {/* Curva de progresión: se abre con un clic, como las curvas de
          crecimiento en el panel pediátrico. Solo tiene sentido con dos o más
          controles; con uno la barra de arriba ya dice todo. */}
      {chartPoints.length >= 2 && result.category ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowChart((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <LineChart className="h-3.5 w-3.5" />
            {showChart ? "Ocultar curva de ganancia" : `Ver curva de ganancia (${chartPoints.length} controles)`}
          </button>

          {showChart ? (
            <div className="mt-3">
              <GainChart
                category={result.category}
                type={pregnancy?.type || "single"}
                points={chartPoints}
                highlightWeek={age?.weeks ?? null}
                height={230}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
