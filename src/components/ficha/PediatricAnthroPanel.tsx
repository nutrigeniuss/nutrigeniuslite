import { useMemo, useState } from 'react';
import { Baby, LineChart } from 'lucide-react';
import {
  assessPatientMeasurement,
  buildIndicatorTrajectory,
  buildZemelTrajectory,
  formatAgeFromDates,
  formatNormalRange,
  parseSex,
  pediatricNormalRange,
  pediatricNormalZBand,
  type PediatricIndicator,
  type PediatricMeasurementRecord,
  type PediatricTone,
  type ZemelPublicIndicator,
} from '@/lib/anthropometry/pediatric';
import PediatricGrowthChart from './PediatricGrowthChart';

// Panel de resultados antropométricos pediátricos (OMS/MINSA). Se muestra solo
// cuando el paciente es <19 años; para adultos devuelve null y la pantalla usa el
// panel de adulto. Recibe los datos crudos + el historial de mediciones (para las
// curvas de progresión) y calcula todo con el motor verificado.
type PediatricAnthroPanelProps = {
  gender?: string | null;
  birthDate?: string | null;
  measurementDate?: string | null;
  weightKg?: number | null;
  heightCm?: number | null;
  headCircCm?: number | null;
  armCircCm?: number | null;
  tricepsSkinfoldMm?: number | null;
  subscapularSkinfoldMm?: number | null;
  abdominalCm?: number | null;
  waistCm?: number | null;
  measurements?: PediatricMeasurementRecord[];
  // Diagnósticos (CSV). Con síndrome de Down 0–20a se usa la referencia Zemel.
  pathologies?: string | string[] | null;
};

const TONE_STYLES: Record<PediatricTone, { badge: string; dot: string }> = {
  normal: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  caution: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  high: { badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  warning: { badge: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  critical: { badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
};

const SEVERITY: Record<PediatricTone, number> = { critical: 4, warning: 3, high: 2, caution: 1, normal: 0 };

const formatAge = (months: number): string => {
  const totalMonths = Math.floor(months);
  const years = Math.floor(totalMonths / 12);
  const rem = totalMonths % 12;
  if (years === 0) return `${totalMonths} ${totalMonths === 1 ? 'mes' : 'meses'}`;
  const y = `${years} ${years === 1 ? 'año' : 'años'}`;
  return rem === 0 ? y : `${y} ${rem} ${rem === 1 ? 'mes' : 'meses'}`;
};

// Posición (0–100%) del niño en la escala del indicador, para el medidor visual.
const gaugePosition = (zScore?: number, percentile?: number): number | null => {
  if (typeof zScore === 'number') return ((Math.max(-3, Math.min(3, zScore)) + 3) / 6) * 100;
  if (typeof percentile === 'number') return percentile;
  return null;
};

// z-score (−3..+3) a porcentaje (0..100) en la escala del medidor.
const zToPct = (z: number): number => ((Math.max(-3, Math.min(3, z)) + 3) / 6) * 100;

// Barrita roja–verde–roja con el marcador del paciente. La zona verde refleja la
// banda NORMAL real del indicador (talla −2..+3, P/T −2..+2, braquial ≥−2…), no
// un ±2 fijo. Sin banda (percentiles) usa el centro por defecto.
function MiniGauge({ position, band }: { position: number; band?: [number, number] | null }) {
  const gStart = band ? zToPct(band[0]) : 15;
  const gEnd = band ? zToPct(band[1]) : 85;
  return (
    <div
      className="relative mt-2.5 h-1.5 w-full rounded-full"
      style={{ background: `linear-gradient(90deg,#fecaca 0%,#fecaca ${gStart}%,#bbf7d0 ${gStart}%,#bbf7d0 ${gEnd}%,#fecaca ${gEnd}%,#fecaca 100%)` }}
    >
      <span
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-800 shadow"
        style={{ left: `${Math.max(2, Math.min(98, position))}%` }}
      />
    </div>
  );
}

export default function PediatricAnthroPanel({
  gender,
  birthDate,
  measurementDate,
  weightKg,
  heightCm,
  headCircCm,
  armCircCm,
  tricepsSkinfoldMm,
  subscapularSkinfoldMm,
  abdominalCm,
  waistCm,
  measurements,
  pathologies,
}: PediatricAnthroPanelProps) {
  const assessment = useMemo(
    () => assessPatientMeasurement({ gender, birthDate, measurementDate, weightKg, heightCm, headCircCm, armCircCm, tricepsSkinfoldMm, subscapularSkinfoldMm, abdominalCm, waistCm, pathologies }),
    [gender, birthDate, measurementDate, weightKg, heightCm, headCircCm, armCircCm, tricepsSkinfoldMm, subscapularSkinfoldMm, abdominalCm, waistCm, pathologies],
  );
  const isZemel = assessment?.standard === 'zemel';
  const [showCharts, setShowCharts] = useState(false);

  // Trayectorias de las curvas OMS, memoizadas: así los arrays `points` mantienen
  // su identidad entre renders y el gráfico no reconstruye las curvas cada vez.
  const chartData = useMemo(() => {
    if (!assessment || assessment.results.length === 0) return [];
    const sx = parseSex(gender);
    if (!sx) return [];
    const zemel = assessment.standard === 'zemel';
    const lbl = formatAgeFromDates(birthDate, measurementDate) ?? formatAge(assessment.ageMonths);
    const hist = measurements && measurements.length > 0 ? measurements : null;
    return assessment.results
      .filter((r) => typeof r.chartX === 'number' && typeof r.chartValue === 'number')
      .map((r) => ({
        indicator: r.indicator,
        label: r.indicatorLabel,
        tone: r.classification.tone,
        points: hist
          ? (zemel
              ? buildZemelTrajectory(r.indicator as ZemelPublicIndicator, sx, birthDate, hist, measurementDate)
              : buildIndicatorTrajectory(r.indicator as PediatricIndicator, sx, birthDate, hist, measurementDate))
          : [{ x: r.chartX as number, value: r.chartValue as number, isCurrent: true, date: measurementDate ?? null, ageLabel: lbl }],
      }))
      .filter((c) => c.points.length > 0);
  }, [assessment, gender, birthDate, measurementDate, measurements]);

  if (!assessment || assessment.results.length === 0) return null;

  const sex = parseSex(gender);
  // Edad exacta (años/meses/días) desde las fechas, para que la cabecera coincida
  // con la posición del punto en la curva y con la edad usada en el z-score.
  const ageLabel = formatAgeFromDates(birthDate, measurementDate) ?? formatAge(assessment.ageMonths);
  // Ordenados por severidad: primero los que requieren atención.
  const results = [...assessment.results].sort(
    (a, b) => SEVERITY[b.classification.tone] - SEVERITY[a.classification.tone],
  );

  // El orden por severidad se mantiene aunque ya no haya titular: lo que
  // requiere atención sigue apareciendo primero entre las tarjetas.

  return (
    <section className="rounded-[16px] border border-[#e2e8f0]/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-500">
            <Baby className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">Evaluación pediátrica</h3>
            <p className="text-xs text-slate-500">
              {isZemel ? 'Referencia: Síndrome de Down (Zemel 2015)' : 'Estándar OMS'} · edad: {ageLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Sin titular de síntesis. Repetía en una línea lo que cada indicador ya
          dice por su cuenta, y con menos información: el titular decía "Bajo
          peso · Peso para la edad" mientras las tarjetas de abajo dan el
          diagnóstico, el z-score y el rango normal de los tres a la vez.
          Ocupaba además la parte alta de la pantalla, que es donde se busca la
          evaluación y no un resumen de ella. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {results.map((r) => {
          const style = TONE_STYLES[r.classification.tone];
          const pos = gaugePosition(r.zScore, r.percentile);
          // Rango normal (kg/cm/mm) y banda del medidor: solo para OMS; en Zemel el
          // resultado es un percentil respecto a la población con Down (no z OMS).
          const nr = !isZemel && sex && typeof r.chartX === 'number'
            ? pediatricNormalRange(r.indicator as PediatricIndicator, sex, r.chartX, r.chartValue)
            : null;
          const zBand = isZemel ? null : pediatricNormalZBand(r.indicator as PediatricIndicator);
          return (
            <div key={r.indicator} className="rounded-[12px] border border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{r.indicatorLabel}</p>
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 tabular-nums" title="z-score OMS o percentil (Frisancho/Fernández)">
                  {r.valueLabel}
                </span>
              </div>
              <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${style.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                {r.classification.label}
              </div>
              {pos !== null ? <MiniGauge position={pos} band={zBand} /> : null}
              {nr ? (
                <p className="mt-2 text-[11px] text-slate-400">
                  Normal: <span className="font-semibold text-slate-500 tabular-nums">{formatNormalRange(nr)}</span>
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Curvas de crecimiento (colapsable): banda normal + líneas SD + la
          progresión del niño (todas sus mediciones) con la actual marcada. */}
      {sex && chartData.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowCharts((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <LineChart className="h-3.5 w-3.5" />
            {showCharts ? 'Ocultar curvas de crecimiento' : 'Ver curvas de crecimiento'}
          </button>
          {showCharts ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {chartData.map((c) => (
                <PediatricGrowthChart
                  key={c.indicator}
                  indicator={c.indicator}
                  sex={sex}
                  standard={isZemel ? 'zemel' : 'oms'}
                  label={c.label}
                  points={c.points}
                  currentTone={c.tone}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-snug text-slate-400">
        {isZemel
          ? 'Cartas de crecimiento específicas para síndrome de Down (Zemel BS et al., Pediatrics 2015), de 0 a 20 años. El resultado es el percentil respecto a la población con Down. A partir de los 20 años se usan los indicadores de adulto.'
          : 'Clasificación según los patrones de crecimiento de la OMS (adoptados por MINSA) y, en 5–18 años, percentiles de Frisancho/Fernández. El z-score expresa cuántas desviaciones estándar se aparta el niño de la mediana.'}
      </p>
    </section>
  );
}
