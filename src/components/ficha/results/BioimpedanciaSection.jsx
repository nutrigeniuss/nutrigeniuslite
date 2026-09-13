import React from "react";
import { SECTIONS } from "../consult/consultConfig";
import { ResultRow, SectionCard, v } from "./resultsShared";

const BIO_FIELDS = SECTIONS.bio?.[0]?.fields || [];

/**
 * Espejo de lecturas del equipo BIA. No calcula ni clasifica: solo muestra
 * lo capturado en la pestaña Bioimpedancia. Se oculta si no hay ningún valor.
 */
export default function BioimpedanciaSection({ data }) {
  const bio = data?.bioimpedance || {};
  const filled = BIO_FIELDS.filter(([key]) => v(bio[key]));
  if (filled.length === 0) return null;

  return (
    <SectionCard title="Bioimpedancia" color="slate">
      <p className="mb-2 text-[11px] leading-snug text-slate-400">
        Valores reportados por el equipo (sin recálculo en NutriGenius).
      </p>
      {filled.map(([key, label, unit]) => (
        <ResultRow
          key={key}
          label={label}
          value={bio[key]}
          unit={unit === "rating" ? "" : unit}
          detail={unit === "rating" ? "rating del equipo" : null}
        />
      ))}
    </SectionCard>
  );
}
