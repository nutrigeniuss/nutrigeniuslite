import React, { useState } from "react";
import { PieChart, Pie, Cell, Sector } from "recharts";
import { MACRO_HEX } from "@/lib/macroColors";

const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

/**
 * Gráfica tipo dona para proporción de macros
 * @param {Object} props
 * @param {number} protein - gramos de proteína
 * @param {number} carbs - gramos de carbohidrato
 * @param {number} fat - gramos de grasa
 */
function renderActiveShape(props) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = props;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

export default function MacrosDonutChart({ protein, carbs, fat, percentages, size = 220 }) {
  const [activeIndex, setActiveIndex] = useState(null);

  // La dona debe seguir la proporción energética del objetivo, no la suma de gramos.
  const derivedPercentages = percentages || (() => {
    const calories = (Number(protein) || 0) * KCAL_PER_GRAM.protein
      + (Number(carbs) || 0) * KCAL_PER_GRAM.carbs
      + (Number(fat) || 0) * KCAL_PER_GRAM.fat;

    if (!calories) {
      return { protein: 0, carbs: 0, fat: 0 };
    }

    return {
      protein: Math.round((((Number(protein) || 0) * KCAL_PER_GRAM.protein) / calories) * 100),
      carbs: Math.round((((Number(carbs) || 0) * KCAL_PER_GRAM.carbs) / calories) * 100),
      fat: Math.round((((Number(fat) || 0) * KCAL_PER_GRAM.fat) / calories) * 100),
    };
  })();

  const data = [
    // `color` pinta el gajo de la dona; `textColor` es el mismo macro en un tono
    // más oscuro, para el número grande del centro (sobre fondo blanco).
    { name: "Proteína", value: derivedPercentages.protein, color: MACRO_HEX.protein.fill, textColor: MACRO_HEX.protein.text },
    { name: "Carbohidrato", value: derivedPercentages.carbs, color: MACRO_HEX.carbs.fill, textColor: MACRO_HEX.carbs.text },
    { name: "Grasa", value: derivedPercentages.fat, color: MACRO_HEX.fat.fill, textColor: MACRO_HEX.fat.text },
  ];

  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const activeItem = activeIndex === null ? null : data[activeIndex];
  const activePercentage = activeItem && total
    ? Math.round((activeItem.value * 100) / total)
    : null;
  const chartSize = size;
  const innerRadius = Math.round(size * 0.27);
  const outerRadius = Math.round(size * 0.39);
  const activeValueFontSize = Math.max(22, Math.round(size * 0.15));
  const activeLabelFontSize = Math.max(10, Math.round(size * 0.06));
  const idleLabelFontSize = Math.max(9, Math.round(size * 0.05));
  const idleTitleFontSize = Math.max(13, Math.round(size * 0.08));

  return (
    <div className="relative flex items-center justify-center" style={{ width: chartSize, height: chartSize }}>
      <div className="absolute inset-[16%] rounded-full border border-slate-100 bg-white/85 shadow-inner shadow-slate-100" />
      <PieChart width={chartSize} height={chartSize}>
        <Pie
          activeIndex={activeIndex ?? undefined}
          activeShape={renderActiveShape}
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={1.5}
          stroke="none"
          startAngle={90}
          endAngle={-270}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          onClick={(_, index) => setActiveIndex(index)}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {activeItem ? (
          <>
            <span className="font-black leading-none" style={{ color: activeItem.textColor, fontSize: `${activeValueFontSize}px` }}>
              {activePercentage}%
            </span>
            <span className="mt-1 font-semibold uppercase text-slate-500" style={{ fontSize: `${activeLabelFontSize}px`, letterSpacing: "0.12em" }}>
              {activeItem.name}
            </span>
          </>
        ) : (
          <>
            <span className="font-bold uppercase text-slate-400" style={{ fontSize: `${idleLabelFontSize}px`, letterSpacing: "0.3em" }}>
              Macros
            </span>
            <span className="mt-2 font-black leading-5 text-slate-600" style={{ fontSize: `${idleTitleFontSize}px` }}>
              Proporción
            </span>
          </>
        )}
      </div>
    </div>
  );
}
