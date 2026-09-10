import React from "react";
import {
  bodyFatDurninSiri,
  bodyFatFaulkner,
  bodyFatGallagherAssessment,
  bodyFatRFM,
  bodyFatYuhasz,
  calcPCTPercent,
  subscapularAssessment,
  tricepsAssessment,
  triSubSumAssessment,
} from "@/lib/anthropometry";
import { ResultRow, SectionCard, SEVERITY_CLASS, v } from "./resultsShared";
import { useFormulaGrasa } from "@/hooks/useFormulaGrasa";

// ── Pliegues ──────────────────────────────────────────────────────────────────
// Conectado al módulo: percentiles del Excel + % grasa Durnin-Womersley/Siri.
export default function PlieguesSection({ data, sex, ageYears }) {
  const sk = data.skinfolds || {};
  const tri = sk.triceps;
  const sub = sk.subscapular;

  // Diagnóstico individual de pliegues con tablas Frisancho.
  // Categorías estándar: Magro / Bajo promedio / Promedio / Sobre promedio /
  // Exceso. Si la edad cae fuera del rango Frisancho (ej. <5 años para
  // tríceps/subescapular) el assessment devuelve "Tablas no disponibles".
  const triDiag = tricepsAssessment(tri, ageYears, sex);
  const subDiag = subscapularAssessment(sub, ageYears, sex);

  // Suma de pliegues con percentil de tabla del Excel.
  const sumAssessment = triSubSumAssessment(tri, sub, ageYears, sex);

  // % grasa Durnin-Womersley + Siri (4 pliegues: bíceps, tríceps, subescap, suprailíaco).
  // Nota: el campo `iliac_crest` corresponde al pliegue suprailíaco según ConsultDetail.
  // Coercer a Number: el helper exige typeof==="number" estricto.
  const numPli = (x) => (v(x) && Number.isFinite(Number(x)) ? Number(x) : null);

  // Cuatro fórmulas a elegir. No dan lo mismo ni pretenden darlo: cada una se
  // valida en una población distinta, y el nutricionista escoge según a quién
  // tiene delante. Por eso se elige y no se promedia.
  //
  // La elección se recuerda como PREFERENCIA del profesional, no dentro de la
  // consulta: se aplica igual a todos los pacientes, así que su evolución
  // sigue siendo comparable. Ver useFormulaGrasa.
  const FORMULAS = {
    siri: {
      nombre: "Siri",
      pie: "Durnin-Womersley + Siri · 4 pliegues",
      calc: () => bodyFatDurninSiri(
        numPli(sk.biceps), numPli(tri), numPli(sub), numPli(sk.iliac_crest), numPli(ageYears), sex,
      ),
    },
    yuhasz: {
      nombre: "Yuhasz",
      pie: "Yuhasz · 6 pliegues · población deportiva",
      calc: () => bodyFatYuhasz(
        numPli(tri), numPli(sub), numPli(sk.supraspinal), numPli(sk.abdominal),
        numPli(sk.front_thigh), numPli(sk.medial_calf), sex,
      ),
    },
    faulkner: {
      nombre: "Faulkner",
      pie: "Faulkner · 4 pliegues",
      calc: () => bodyFatFaulkner(
        numPli(tri), numPli(sub), numPli(sk.supraspinal), numPli(sk.abdominal),
      ),
    },
    rfm: {
      nombre: "RFM",
      pie: "RFM · sin pliegues, solo talla y cintura",
      calc: () => bodyFatRFM(numPli(data.height), numPli(data.perimeters?.waist), sex),
    },
  };

  // Preferencia propia de esta tarjeta, recordada entre pantallas e
  // independiente de la de Composición Corporal. Ver useFormulaGrasa.
  const { formula, setFormula } = useFormulaGrasa('pliegues');
  const fat = FORMULAS[formula].calc();

  // Diagnóstico clínico del % grasa con tabla Gallagher 2000 (Bajo / Recomendado /
  // Alto / Muy Alto según sexo y rango etáreo 20-79). Si la edad sale del rango
  // se muestra "Tablas no disponibles" preservando el valor calculado.
  const fatDiag = bodyFatGallagherAssessment(fat.value, ageYears, sex);

  // %PCT: desnutrición CALÓRICA por comparación con el estándar de Longo &
  // Navarro. Es el gemelo del %CMB, que valora la reserva proteico-muscular y
  // ya se muestra en la tarjeta de perímetros. Se leen juntos: un paciente
  // puede tener la grasa conservada y el músculo agotado, y mirar uno solo lo
  // esconde.
  const pctPct = calcPCTPercent(numPli(tri), sex);

  return (
    <SectionCard title="Derivados de Pliegues" color="blue">
      <ResultRow
        label="Pliegue Tricipital"
        value={v(tri) ? tri : null}
        unit="mm"
        diag={triDiag.classification}
        diagColor={SEVERITY_CLASS[triDiag.severity ?? "info"]}
        detail={triDiag.detail}
        missing={!v(tri) ? ["Pliegue tríceps"] : null}
      />
      <ResultRow
        label="% Pliegue Tricipital (%PCT)"
        value={pctPct.value}
        unit="%"
        diag={pctPct.classification}
        diagColor={SEVERITY_CLASS[pctPct.severity ?? "info"]}
        detail={pctPct.value != null ? `${pctPct.detail} · desnutrición calórica` : undefined}
        missing={pctPct.missing}
      />
      <ResultRow
        label="Pliegue Subescapular"
        value={v(sub) ? sub : null}
        unit="mm"
        diag={subDiag.classification}
        diagColor={SEVERITY_CLASS[subDiag.severity ?? "info"]}
        detail={subDiag.detail}
        missing={!v(sub) ? ["Pliegue subescapular"] : null}
      />
      <ResultRow
        label="Tricipital + Subescapular"
        value={sumAssessment.value}
        unit="mm"
        diag={sumAssessment.classification}
        diagColor={SEVERITY_CLASS[sumAssessment.severity ?? "info"]}
        detail={sumAssessment.detail}
        missing={sumAssessment.missing}
      />
      {/* Selector de fórmula. Va pegado a la fila del % de grasa porque solo
          afecta a ese número; ponerlo en la cabecera daría a entender que
          cambia toda la tarjeta. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Fórmula</span>
        {Object.entries(FORMULAS).map(([clave, { nombre }]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setFormula(clave)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              formula === clave
                ? "bg-brand-500 text-white"
                : "border border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {nombre}
          </button>
        ))}
      </div>
      <ResultRow
        label="% Grasa Corporal"
        value={fat.value}
        unit="%"
        diag={fatDiag.classification ?? fat.detail}
        diagColor={SEVERITY_CLASS[fatDiag.severity ?? "info"]}
        detail={FORMULAS[formula].pie}
        missing={fat.missing}
      />
    </SectionCard>
  );
}
