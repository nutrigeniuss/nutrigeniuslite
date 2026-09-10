// Sub-componentes presentacionales del requerimiento (Fitia Lite).
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { MACRO_KCAL, MACRO_LABELS, normalizeMacroSplit } from './logic';
import type { MacroKey, MacroSectionProps, SectionCardProps, SummaryMetricCardProps } from './types';

export function SummaryMetricCard({ icon, label, value, hint }: SummaryMetricCardProps) {
  return (
    <div
      title={hint}
      className="flex min-w-[148px] flex-1 items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function SectionCard({ step, title, subtitle, action, children }: SectionCardProps) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-bold text-white">
            {step}
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-bold tracking-tight text-slate-900">{title}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function MacroSection({ totalCal, weight, macros, setMacros, setLastInputMode, lastInputMode, compact = false }: MacroSectionProps) {
  // Orden fijo Carbohidratos → Proteínas → Grasas, igual que el panel lateral.
  const macroKeys: MacroKey[] = ['carbs', 'protein', 'fat'];
  const derived = {} as Record<MacroKey, { kcal: number; grams: number; gkg: number | null }>;
  let totalPct = 0;

  macroKeys.forEach((key) => {
    const pct = Number(macros[key]?.pct) || 0;
    totalPct += pct;
    const kcal = Math.round((totalCal * pct) / 100);
    const grams = Math.round((kcal / MACRO_KCAL[key]) * 10) / 10;
    const gkg = weight ? Math.round((grams / weight) * 100) / 100 : null;
    derived[key] = { kcal, grams, gkg };
  });

  const pctOk = Math.round(totalPct) === 100;

  const handlePctChange = (macro: MacroKey, value: string): void => {
    setLastInputMode('pct');
    setMacros((current) => ({ ...current, [macro]: { pct: Math.max(0, Math.min(100, parseFloat(value) || 0)), gkg: null } }));
  };

  const handleGramChange = (macro: MacroKey, value: string): void => {
    setLastInputMode('g');
    const grams = parseFloat(value) || 0;
    const pct = totalCal ? Math.round(((grams * MACRO_KCAL[macro]) / totalCal) * 1000) / 10 : 0;
    setMacros((current) => ({ ...current, [macro]: { pct: Number.isNaN(pct) ? 0 : pct, gkg: null } }));
  };

  const pieData = macroKeys
    .map((key) => ({ name: MACRO_LABELS[key].label, value: Number(macros[key]?.pct) || 0, color: MACRO_LABELS[key].hex }))
    .filter((item) => item.value > 0);

  return (
    <div className={`overflow-hidden border border-slate-200/70 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)] ${compact ? 'rounded-[1.25rem]' : 'rounded-[1.5rem]'}`}>
      <div className={`flex flex-col gap-2 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between ${compact ? 'px-4 py-3.5 sm:px-5' : 'px-5 py-4'}`}>
        <p className={`${compact ? 'text-[13px]' : 'text-[13.5px]'} font-bold tracking-tight text-slate-900`}>
          Macronutrientes
        </p>
        <span className="rounded-full bg-[#f7f8fc] px-3 py-1 text-[11px] font-semibold text-slate-500">
          {lastInputMode === 'g' ? 'Por gramos' : 'Por %'}
        </span>
      </div>

      <div className={`flex flex-col xl:flex-row ${compact ? 'gap-5 p-4 sm:p-5' : 'gap-6 p-5 sm:p-6'}`}>
        <div className={`flex-1 ${compact ? 'space-y-3.5' : 'space-y-3.5'}`}>
          {macroKeys.map((key) => {
            const macro = MACRO_LABELS[key];
            const pct = Number(macros[key]?.pct) || 0;
            const { grams, gkg } = derived[key];

            return (
              <div key={key} className={`border border-slate-100 bg-[#f7f8fc]/80 ${compact ? 'rounded-2xl p-3' : 'rounded-2xl p-3.5'}`}>
                <div className={`flex items-center gap-2.5 ${compact ? 'mb-2 flex-wrap' : 'mb-2.5'}`}>
                  <div className={`h-2.5 w-2.5 rounded-full ${macro.color}`} />
                  <span className="w-28 text-xs font-semibold text-slate-700">{macro.label}</span>
                  <span className={`w-10 text-xs font-bold ${macro.text}`}>{pct}%</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={grams || ''}
                    onChange={(event) => handleGramChange(key, event.target.value)}
                    className="w-20 rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-center text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15"
                    placeholder="g"
                  />
                  <span className="text-xs text-slate-400">g</span>
                  {weight && gkg != null ? <span className="text-xs text-slate-400">{gkg} g/kg</span> : null}
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={pct}
                  onChange={(event) => handlePctChange(key, event.target.value)}
                  style={{ accentColor: macro.hex }}
                  className="h-1.5 w-full cursor-pointer rounded-full"
                />
              </div>
            );
          })}

          {/* CUANDO EL REPARTO NO SUMA 100: aviso claro + botón de ajuste. */}
          {!pctOk ? (
            <div
              role="status"
              className={`border border-amber-200 bg-amber-50 ${compact ? 'rounded-2xl p-3' : 'rounded-2xl p-4'}`}
            >
              <p className="text-sm font-bold text-amber-900">
                Suman {Math.round(totalPct)} %
                <span className="font-semibold text-amber-700">
                  {totalPct < 100
                    ? ` · faltan ${Math.round(100 - totalPct)} %`
                    : ` · sobran ${Math.round(totalPct - 100)} %`}
                </span>
              </p>
              <button
                type="button"
                onClick={() => { setLastInputMode('pct'); setMacros((current) => normalizeMacroSplit(current)); }}
                className="mt-2.5 inline-flex items-center rounded-full bg-amber-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
              >
                Ajustar a 100 %
              </button>
            </div>
          ) : null}

          {pctOk && totalCal > 0 ? (
            <div className={`overflow-hidden border border-slate-100 ${compact ? 'rounded-2xl' : 'rounded-2xl'}`}>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#fafbfd] text-slate-400">
                    <th className="px-3 py-2.5 text-left font-semibold">Macro</th>
                    <th className="px-2 py-2.5 text-right font-semibold">%</th>
                    <th className="px-2 py-2.5 text-right font-semibold">g</th>
                    <th className="px-2 py-2.5 text-right font-semibold">kcal</th>
                    {weight ? <th className="px-2 py-2.5 text-right font-semibold">g/kg</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {macroKeys.map((key) => {
                    const macro = MACRO_LABELS[key];
                    const data = derived[key];
                    const pct = Number(macros[key]?.pct) || 0;

                    return (
                      <tr key={key}>
                        <td className="flex items-center gap-1.5 px-3 py-2">
                          <div className={`h-2 w-2 rounded-full ${macro.color}`} />
                          <span className="text-slate-600">{macro.label}</span>
                        </td>
                        <td className={`px-2 py-2 text-right font-semibold ${macro.text}`}>{pct}%</td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-600">{data.grams}g</td>
                        <td className="px-2 py-2 text-right tabular-nums text-slate-600">{data.kcal}</td>
                        {weight ? <td className="px-2 py-2 text-right tabular-nums text-slate-500">{data.gkg}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className={`flex w-full flex-col items-center justify-center ${compact ? 'xl:w-36' : 'xl:w-40'}`}>
          {pieData.length > 0 ? (
            <PieChart width={compact ? 120 : 132} height={compact ? 120 : 132}>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={compact ? 30 : 34} outerRadius={compact ? 52 : 58} dataKey="value" startAngle={90} endAngle={-270}>
                {pieData.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value: number | string) => `${value}%`} />
            </PieChart>
          ) : (
            <div className={`flex items-center justify-center rounded-full border-4 border-slate-100 ${compact ? 'h-24 w-24' : 'h-28 w-28'}`}>
              <span className="text-xs text-slate-300">0%</span>
            </div>
          )}

          <div className={`${compact ? 'mt-2.5' : 'mt-3'} space-y-1.5`}>
            {macroKeys.map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: MACRO_LABELS[key].hex }} />
                <span className="text-xs text-slate-500">{MACRO_LABELS[key].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
