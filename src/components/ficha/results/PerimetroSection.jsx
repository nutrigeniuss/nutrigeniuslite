import React from "react";
import {
  abdominalPerimeterRisk,
  ambAssessment,
  armCircumferenceAssessment,
  calcAMB,
  calcCMB,
  classifyCMB,
  cmbCriterionApplies,
  calcWHR,
  calcWHtR,
} from "@/lib/anthropometry";
import { ResultRow, SectionCard, SEVERITY_CLASS, v } from "./resultsShared";

// ── Perímetros derivados ──────────────────────────────────────────────────────
// Conectado al módulo: ICC + ICT + AMB/CMB + percentiles del Excel.
export default function PerimetroSection({ data, sex, ageYears }) {
  const p = data.perimeters || {};
  const sk = data.skinfolds || {};

  const whr = calcWHR(p.waist, p.hip, sex);
  const whtr = calcWHtR(p.waist, data.height, ageYears);
  const wRisk = abdominalPerimeterRisk(p.abdominal_per, sex);

  const amb = calcAMB(p.arm_relaxed, sk.triceps, sex);
  const cmb = calcCMB(p.arm_relaxed, sk.triceps);
  const cmbDx = classifyCMB(cmb.value, sex, ageYears);
  const armPct = armCircumferenceAssessment(p.arm_relaxed, ageYears, sex);
  const ambPct = ambAssessment(amb.value, ageYears, sex);

  return (
    <SectionCard title="Riesgo y Derivados de Perímetros" color="red">
      <ResultRow
        label="Índice Cintura-Cadera (ICC)"
        value={whr.value}
        diag={whr.classification}
        diagColor={SEVERITY_CLASS[whr.severity]}
        missing={whr.missing}
      />
      <ResultRow
        label="Índice Cintura-Talla (ICT)"
        value={whtr.value}
        diag={whtr.classification}
        diagColor={SEVERITY_CLASS[whtr.severity]}
        missing={whtr.missing}
      />
      <ResultRow
        label="Área Muscular del Brazo (AMB)"
        value={amb.value}
        unit="cm²"
        diag={ambPct.classification}
        diagColor={SEVERITY_CLASS[ambPct.severity]}
        detail={ambPct.detail}
        missing={amb.missing}
      />
      {/* Solo desde los 40 años: fuera de esa franja no hay criterio (Wu 2017)
          y la fila no se muestra en absoluto. Enseñar el centímetro pelado, sin
          nada que lo interprete, es lo que llevaba a leerlo a ojo. */}
      {cmbCriterionApplies(ageYears) ? (
        <ResultRow
          label="Circunferencia Muscular del Brazo (CMB)"
          value={cmb.value}
          unit="cm"
          diag={cmbDx.classification}
          diagColor={SEVERITY_CLASS[cmbDx.severity]}
          detail={cmbDx.detail}
          missing={cmb.missing}
        />
      ) : null}
      {/* El percentil es el número del que sale la etiqueta; cuando la edad se
          sale de la tabla, el detalle dice de qué franja etaria salió. */}
      <ResultRow
        label="Perímetro del brazo"
        value={v(p.arm_relaxed) ? p.arm_relaxed : null}
        unit="cm"
        diag={armPct.classification}
        diagColor={SEVERITY_CLASS[armPct.severity]}
        detail={armPct.detail}
        missing={!v(p.arm_relaxed) ? ["Perímetro brazo"] : null}
      />
      <ResultRow
        label="Perímetro Abdominal"
        value={v(p.abdominal_per) ? p.abdominal_per : null}
        unit="cm"
        diag={wRisk.classification}
        diagColor={SEVERITY_CLASS[wRisk.severity]}
        detail={wRisk.detail}
        missing={!v(p.abdominal_per) ? ["Perímetro Abdominal"] : null}
      />
    </SectionCard>
  );
}
