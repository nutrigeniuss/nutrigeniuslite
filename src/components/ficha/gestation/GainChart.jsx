import React, { useMemo, useState } from "react";
import { buildGainChartSVG, computeGainChartLayout } from "@/lib/gestation/gainChartSvg";
import { getCurrentLocale } from '@/lib/formatLocale';

// ── Curva de ganancia de peso gestacional ────────────────────────────────────
// El dibujo se genera como SVG en texto porque el PDF usa el MISMO generador y
// ahí no corre React. Por eso el tooltip no puede ir dentro del SVG: se monta
// como una capa de zonas sensibles encima, ubicadas con las coordenadas que
// devuelve computeGainChartLayout — las mismas con las que se dibujó.
//
// Componente compartido por la vista de Evolución y el panel de Resultados,
// para que la gráfica sea idéntica en los dos sitios.

const SEVERITY_CLASS = {
  good: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-700",
  bad: "bg-rose-100 text-rose-700",
  info: "bg-slate-100 text-slate-600",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

export default function GainChart({ category, type = "single", points = [], highlightWeek = null, height = 260 }) {
  const [hovered, setHovered] = useState(null);

  const options = useMemo(
    () => ({ category, type, points, highlightWeek, height }),
    [category, type, points, highlightWeek, height],
  );

  const svg = useMemo(() => buildGainChartSVG(options), [options]);
  const layout = useMemo(() => computeGainChartLayout(options), [options]);

  return (
    <div>
      <div className="relative w-full">
        {/* El SVG marca la altura del contenedor (width:100%, height:auto), así
            que las zonas sensibles se posicionan en % sobre él. */}
        <div className="w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />

        {layout.points.map((entry) => (
          <button
            key={`${entry.point.date}-${entry.point.week}`}
            type="button"
            onMouseEnter={() => setHovered(entry)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(entry)}
            onBlur={() => setHovered(null)}
            aria-label={`Control de la semana ${entry.point.week}`}
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]/50"
            style={{ left: `${entry.leftPct}%`, top: `${entry.topPct}%` }}
          />
        ))}

        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
            style={{ left: `${hovered.leftPct}%`, top: `calc(${hovered.topPct}% - 12px)` }}
          >
            <p className="text-[11px] font-bold text-slate-700">
              {formatDate(hovered.point.date)} · <span className="text-[#be185d]">{hovered.point.ageLabel || `${hovered.point.week} s`}</span>
            </p>
            <p className="mt-0.5 text-[11.5px] text-slate-500">
              {hovered.point.weightKg != null ? (
                <>Peso <strong className="font-bold text-slate-700">{hovered.point.weightKg} kg</strong>{" · "}</>
              ) : null}
              Ganancia <strong className="font-bold text-slate-700">
                {hovered.point.gainKg > 0 ? "+" : ""}{hovered.point.gainKg} kg
              </strong>
            </p>
            {hovered.point.range ? (
              <p className="text-[10.5px] text-slate-400">
                Esperado {hovered.point.range.min} – {hovered.point.range.max} kg
              </p>
            ) : null}
            {hovered.point.diagnosis ? (
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_CLASS[hovered.point.severity] || SEVERITY_CLASS.info}`}>
                {hovered.point.diagnosis}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-[10.5px] text-slate-400">
        Kg ganados sobre el peso pregestacional. La franja verde es el rango recomendado; la línea rosa marca la semana
        del control. Pasa el cursor por un punto para ver su detalle.
      </p>
    </div>
  );
}
