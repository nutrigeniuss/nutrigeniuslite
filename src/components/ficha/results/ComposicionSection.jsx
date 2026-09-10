import React from "react";
import { normalizeSex } from "@/lib/anthropometry";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MissingFieldsChips, SectionCard, v } from "./resultsShared";
import { useFormulaGrasa } from "@/hooks/useFormulaGrasa";
import { usePreferenciaProfesional } from "@/hooks/usePreferenciaProfesional";
import { AUTORES_GRASA, calcularModelo4 } from "./composicionModelo4";
import { calcularModelo5 } from "./composicionModelo5";

// ── Composición Corporal ────────────────────────────────────────────────────
// La tarjeta que reparte al paciente en masas: cuánto es grasa, cuánto
// músculo, cuánto hueso y cuánto resto. Ofrece DOS lecturas del mismo paciente
// y el nutricionista elige con cuál trabaja:
//
//   - 4 componentes: el clásico. Cuatro autores encadenados; el cálculo está
//     en ./composicionModelo4.
//   - 5 componentes: Kerr 1988, el fraccionamiento antropométrico. El cálculo
//     está en ./composicionModelo5, que adapta lo que calcula
//     lib/anthropometry/composition — el MISMO cálculo que el informe impreso.
//
// AQUÍ YA NO SE CALCULA NADA: este archivo elige el modelo, pinta la tabla y
// las barras, y junta los avisos de los dos. Los cálculos se sacaron porque
// tenían complejidad 89 mezclados con el dibujo, y porque una fórmula se puede
// probar sola — una tabla de divs, no.
//
// Referencia del modelo de 5: Ross & Kerr, "Fraccionamiento de la masa
// corporal", APUNTS 1991, Vol. XVIII, pp. 175-187, Apéndice B.
// Extraído en su día de ResultsTab.jsx.
export default function ComposicionSection({ data, sex, ageYears, onGoToField }) {
  // El modelo elegido (4 o 5 componentes) se recuerda entre pantallas. Volvía
  // siempre a 5 aunque se hubiera dejado en 4, y son dos lecturas distintas del
  // mismo paciente: quien trabaja con el modelo clásico no quiere reelegirlo en
  // cada consulta.
  const { valor: comp, setValor: setComp } = usePreferenciaProfesional(
    "nutri_modelo_composicion",
    "5",
    ["4", "5"],
  );
  // El peso es la única medida que sigue haciendo falta aquí: los porcentajes
  // de la tabla se calculan sobre el peso REAL, no sobre el predictivo. Todo
  // lo demás —pliegues, diámetros, perímetros, talla— lo leen los módulos de
  // cálculo directamente de `data`.
  const w = data.weight;  // kg
  // isFemale derivado del sexo normalizado ('M'|'F'); evita falsos negativos
  // si llega como "Masculino", "male", etc. Lo piden los DOS modelos: la masa
  // residual del clásico y la masa piel de Kerr cambian según el sexo.
  const isFemale = normalizeSex(sex) === "F";

  // ── Modelo clásico de 4 componentes ────────────────────────────────────────
  // El cálculo vive en ./composicionModelo4: son cuatro fórmulas encadenadas de
  // distintos autores (Durnin-Womersley/Siri, Rocha, Würch, Matiegka) y aquí
  // solo se dibuja el resultado.
  //
  // EL AUTOR DE LA MASA GRASA SE ELIGE, y no es un adorno: la masa grasa entra
  // en Matiegka (músculo = peso − MG − MO − MR), así que cambiar de fórmula
  // mueve también el músculo. La elección se recuerda como preferencia del
  // profesional, aparte de la de Derivados de Pliegues. Ver useFormulaGrasa.
  const { formula: autorGrasa, setFormula: setAutorGrasa } = useFormulaGrasa('composicion');
  const modelo4 = calcularModelo4(data, sex, ageYears, autorGrasa);

  const dwsiri = modelo4.detalleGrasa;
  const fatPctSimple = modelo4.porcentajeGrasa;
  const masaGrasaSimple = modelo4.masaGrasa;
  const masaOseaSimple = modelo4.masaOsea;
  const masaResidualSimple = modelo4.masaResidual;
  const masaMuscularSimple = modelo4.masaMuscular;
  const masaMuscularInconsistente = modelo4.muscularInconsistente;
  const masaMuscularRaw = modelo4.masaMuscularCruda;
  const { mg: missingMG, mo: missingMO, mr: missingMR, mm: missingMM } = modelo4.faltantes;

  // ══════════════════════════════════════════════════════════════════════════
  // Modelo Kerr 1988 — 5 componentes (Apéndice B del artículo Ross-Kerr 1991)
  // ══════════════════════════════════════════════════════════════════════════
  // El cálculo vive en ./composicionModelo5: cinco fórmulas independientes
  // medidas contra el humano de referencia Phantom (170.18 cm), más la
  // reconciliación con el peso de la báscula. Aquí solo se dibuja el resultado.
  //
  // Devuelve las filas ya listas —predicho, ajustado y qué medida falta— porque
  // "qué falta" no es presentación: sale de la misma condición que decide si la
  // masa se puede calcular, y separarlas es cómo aparecen píldoras que piden
  // algo que el cálculo no usa.
  const modelo5 = calcularModelo5(data, isFemale);
  const { pesoPredictivo, factorAjuste, deltaPct } = modelo5;

  // ── Avisos de calidad de datos ─────────────────────────────────────────────
  // Los del modelo de 5 —pliegues de 1 mm, tórax imposible, peso predictivo muy
  // desviado— los trae el propio módulo. La masa muscular negativa se añade
  // aquí porque viene del OTRO modelo, el clásico de 4.
  const warnings = [...modelo5.avisos];
  if (masaMuscularInconsistente) {
    warnings.push(`Masa muscular = ${masaMuscularRaw} kg (negativa): MG+MO+MR supera el peso. Revisa pliegues, diámetros y peso.`);
  }

  // ── Estructuras para render ───────────────────────────────────────────────
  // Modelo de 4 componentes: clásico Durnin-Womersley + Rocha + Würch + Matiegka.
  // Orden de filas según diseño aprobado: Ósea, Grasa, Muscular, Residual.
  // Cada item lleva:
  //   - kg: masa calculada
  //   - author: nombre del autor de la fórmula
  //   - missing: chips clicables si falta algo
  //   - selectable: si true, el autor se renderiza como <select> con `options`.
  const components4 = [
    {
      name: "Masa ósea",
      author: "Rocha",
      kg: masaOseaSimple,
      missing: missingMO,
    },
    {
      name: "Masa grasa",
      author: AUTORES_GRASA[autorGrasa].etiqueta,
      // Única fila con autor elegible: es la que admite varias fórmulas
      // validadas. Las demás no tienen alternativa que ofrecer.
      selectable: true,
      kg: masaGrasaSimple,
      missing: missingMG,
      extra: fatPctSimple !== null
        // Solo Durnin-Womersley pasa por una densidad; las demás dan el % directo.
        ? `${fatPctSimple}% grasa${dwsiri.density ? ` · D=${dwsiri.density}` : ""}${dwsiri.detail ? ` · ${dwsiri.detail}` : ""}`
        : null,
    },
    {
      name: "Masa muscular",
      author: "Matiegka",
      kg: masaMuscularSimple,
      missing: missingMM,
    },
    {
      name: "Masa residual",
      // El rótulo trae su propia fracción ("Würch (♂ 0.241)") y viene del
      // cálculo: el número del texto no puede separarse del que se usó.
      author: modelo4.autorResidual,
      kg: masaResidualSimple,
      missing: missingMR,
    },
  ];

  // Las cinco filas de Kerr salen ya armadas del modulo: kilos predichos,
  // kilos ajustados al peso real y las pildoras de lo que falte medir.
  const components5 = modelo5.componentes;

  // Colores de cada categoría (consistentes en barra apilada y bullets).
  const barColors = ["bg-blue-400", "bg-yellow-300", "bg-orange-400", "bg-red-400", "bg-slate-400"];

  // Total para la barra apilada en cada modo
  const total4 = components4.reduce((s, c) => s + (c.kg || 0), 0);
  const total5 = components5.reduce((s, c) => s + (c.kgAdj || 0), 0);

  // % sobre peso real (mejor referencia clínica que sobre el predictivo)
  const pct = (mass) => (v(w) && mass ? +((mass / w) * 100).toFixed(1) : null);

  return (
    <SectionCard title="Composición Corporal" color="orange">
      {/* Toggle modo de fraccionamiento */}
      <div className="flex gap-2 mb-5">
        {["4", "5"].map(n => (
          <button key={n} type="button" onClick={() => setComp(n)}
            className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${comp === n ? "border-brand-500 bg-brand-500 text-white shadow-[0_8px_18px_rgba(59,95,235,0.22)]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
            {n} Comp.
          </button>
        ))}
        {comp === "5" ? (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-slate-400 self-center">
            Kerr 1988 · Phantom
          </span>
        ) : null}
      </div>

      {comp === "4" ? (
        <>
          {/* Tabla 4 componentes — modelo clásico (DW+Siri/Brozek / Rocha / Würch / Matiegka)
              Layout solicitado: Componente · Autor · Kg · %  (columnas separadas).
              La fila "Masa grasa" muestra un <select> para alternar fórmula. */}
          <div className="grid grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr] gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            <span>Componente</span>
            <span>Autor</span>
            <span className="text-right">Kg</span>
            <span className="text-right">%</span>
          </div>
          {components4.map((item, i) => {
            const { name, author, kg, missing, extra, selectable } = item;
            // Paleta por fila (consistente con el diseño de referencia).
            const dotColor = ["bg-cyan-400", "bg-blue-400", "bg-slate-700", "bg-lime-500"][i];
            const hasMissing = missing && missing.length > 0;
            return (
              <div key={name} className="grid grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr] gap-3 px-1 py-2.5 border-b border-slate-50 last:border-0 items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-3 h-3 rounded-sm flex-shrink-0 ${dotColor}`} />
                  <span className="text-sm text-slate-700 truncate">{name}</span>
                </div>
                {/* Desplegable propio y no un <select> nativo: el nativo ocupa
                    todo el ancho de la columna y lo pinta el sistema operativo,
                    así que rompe con el resto de la tarjeta. Este ocupa lo que
                    mide el nombre. */}
                {selectable ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Cambiar la fórmula de masa grasa"
                        className="group inline-flex w-fit items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-brand-500 transition hover:bg-brand-50"
                      >
                        {author}
                        <ChevronDown className="h-3 w-3 opacity-50 transition group-hover:opacity-100" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-44 p-1">
                      {Object.entries(AUTORES_GRASA).map(([clave, { etiqueta }]) => (
                        <button
                          key={clave}
                          type="button"
                          onClick={() => setAutorGrasa(clave)}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition ${
                            autorGrasa === clave
                              ? "bg-brand-50 font-semibold text-brand-500"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {etiqueta}
                          {autorGrasa === clave ? <Check className="h-3.5 w-3.5" /> : null}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="text-[12px] text-slate-500 truncate">{author}</span>
                )}
                {hasMissing ? (
                  <div className="col-span-2"><MissingFieldsChips fields={missing} onGoToField={onGoToField} /></div>
                ) : (
                  <>
                    <span className="text-sm font-bold text-slate-800 text-right tabular-nums">
                      {kg !== null ? kg : "—"}
                    </span>
                    <span className="text-sm font-semibold text-slate-500 text-right tabular-nums">
                      {pct(kg) !== null ? pct(kg) : "—"}
                    </span>
                  </>
                )}
                {/* Línea secundaria opcional (e.g. % grasa · D=…) bajo la fila completa */}
                {!hasMissing && extra ? (
                  <span className="col-span-4 text-[10px] text-slate-400 -mt-1">{extra}</span>
                ) : null}
              </div>
            );
          })}
          {total4 > 0 ? (
            <div className="mt-4 h-3 rounded-full overflow-hidden flex">
              {components4.map(({ kg }, i) => {
                const dotColor = ["bg-cyan-400", "bg-blue-400", "bg-slate-700", "bg-lime-500"][i];
                return kg > 0 ? <div key={i} className={`${dotColor} h-full`} style={{ width: `${(kg / total4) * 100}%` }} /> : null;
              })}
            </div>
          ) : null}
          {/* Aviso de inconsistencia: MG+MO+MR > peso → MM negativa (recortada a 0). */}
          {masaMuscularInconsistente ? (
            <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                Mediciones inconsistentes
              </p>
              <p className="text-[11px] text-amber-700">
                MG + MO + MR ({(masaGrasaSimple + masaOseaSimple + masaResidualSimple).toFixed(2)} kg) supera el peso ({w} kg).
                Resultado bruto de Matiegka: {masaMuscularRaw} kg. Revisa pliegues, diámetros de muñeca/fémur y peso registrado.
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {/* Tabla 5 componentes (Kerr Phantom): muestra predictivo + ajustado */}
          <div className="grid grid-cols-[1.6fr_repeat(3,1fr)] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            <span>Componente</span>
            <span className="text-right">Kg pred.</span>
            <span className="text-right">Kg ajust.</span>
            <span className="text-right">%</span>
          </div>
          {components5.map(({ name, kgPred, kgAdj, missing }, i) => (
            <div key={name} className="grid grid-cols-[1.6fr_repeat(3,1fr)] gap-2 px-1 py-2.5 border-b border-slate-50 last:border-0 items-center">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${barColors[i]}`} />
                <span className="text-sm text-slate-700">{name}</span>
              </div>
              {missing && missing.length > 0 ? (
                <div className="col-span-3"><MissingFieldsChips fields={missing} onGoToField={onGoToField} /></div>
              ) : (
                <>
                  <span className="text-sm text-slate-500 text-right tabular-nums">{kgPred !== null ? kgPred : "—"}</span>
                  <span className="text-sm font-bold text-slate-800 text-right tabular-nums">{kgAdj !== null ? kgAdj : "—"}</span>
                  <span className="text-sm font-semibold text-slate-500 text-right tabular-nums">{pct(kgAdj) !== null ? `${pct(kgAdj)}%` : "—"}</span>
                </>
              )}
            </div>
          ))}

          {/* Resumen: peso real, predictivo, factor de ajuste */}
          {pesoPredictivo !== null ? (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-[12px] border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Peso real</p>
                <p className="text-base font-extrabold text-slate-800 tabular-nums">{v(w) ? `${w} kg` : "—"}</p>
              </div>
              <div className="rounded-[12px] border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Predictivo</p>
                <p className="text-base font-extrabold text-slate-800 tabular-nums">{pesoPredictivo} kg</p>
                {deltaPct !== null ? (
                  <p className={`text-[10px] font-semibold tabular-nums ${Math.abs(deltaPct) > 10 ? "text-amber-600" : "text-slate-400"}`}>
                    Δ {deltaPct > 0 ? "+" : ""}{deltaPct}%
                  </p>
                ) : null}
              </div>
              <div className="rounded-[12px] border border-brand-500/20 bg-brand-50 px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500/70">Factor ajuste</p>
                <p className="text-base font-extrabold text-brand-500 tabular-nums">{factorAjuste ?? "—"}</p>
              </div>
            </div>
          ) : null}

          {/* Barra apilada de masas ajustadas */}
          {total5 > 0 ? (
            <div className="mt-4 h-3 rounded-full overflow-hidden flex">
              {components5.map(({ kgAdj }, i) => (
                kgAdj > 0 ? <div key={i} className={`${barColors[i]} h-full`} style={{ width: `${(kgAdj / total5) * 100}%` }} /> : null
              ))}
            </div>
          ) : null}

          {/* Avisos de calidad de datos */}
          {warnings.length > 0 ? (
            <div className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                Validaciones de calidad
              </p>
              <ul className="text-[11px] text-amber-700 space-y-0.5 list-disc pl-4">
                {warnings.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </SectionCard>
  );
}
