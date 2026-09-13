import { useMemo, useState } from 'react';
import { Baby, LineChart, Sparkles } from 'lucide-react';
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
import { formatCalc } from '@/lib/formatCalc';
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

const TONE_STYLES: Record<PediatricTone, { badge: string; dot: string; card: string; accent: string; value: string }> = {
  normal: {
    badge: 'bg-emerald-500 text-white',
    dot: 'bg-white',
    card: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 to-white',
    accent: 'bg-emerald-500',
    value: 'text-emerald-700',
  },
  caution: {
    badge: 'bg-amber-500 text-white',
    dot: 'bg-white',
    card: 'border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white',
    accent: 'bg-amber-500',
    value: 'text-amber-800',
  },
  high: {
    badge: 'bg-orange-500 text-white',
    dot: 'bg-white',
    card: 'border-orange-200/80 bg-gradient-to-br from-orange-50/90 to-white',
    accent: 'bg-orange-500',
    value: 'text-orange-800',
  },
  warning: {
    badge: 'bg-orange-500 text-white',
    dot: 'bg-white',
    card: 'border-orange-200/80 bg-gradient-to-br from-orange-50/90 to-white',
    accent: 'bg-orange-500',
    value: 'text-orange-800',
  },
  critical: {
    badge: 'bg-rose-500 text-white',
    dot: 'bg-white',
    card: 'border-rose-200/80 bg-gradient-to-br from-rose-50/90 to-white',
    accent: 'bg-rose-500',
    value: 'text-rose-800',
  },
};

const SEVERITY: Record<PediatricTone, number> = { critical: 4, warning: 3, high: 2, caution: 1, normal: 0 };

const MEASURE_UNIT: Record<string, string> = {
  wfa: ' kg',
  lhfa: ' cm',
  hfa: ' cm',
  wfl: ' kg',
  wfh: ' kg',
  bmi: '',
  hcfa: ' cm',
  acfa: ' cm',
  tsfa: ' mm',
  ssfa: ' mm',
};

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
      className="relative mt-3 h-2 w-full rounded-full"
      style={{ background: `linear-gradient(90deg,#fecaca 0%,#fecaca ${gStart}%,#bbf7d0 ${gStart}%,#bbf7d0 ${gEnd}%,#fecaca ${gEnd}%,#fecaca 100%)` }}
    >
      <span
        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-slate-800 shadow"
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
      .map((r) => {
        let points = hist
          ? (zemel
              ? buildZemelTrajectory(r.indicator as ZemelPublicIndicator, sx, birthDate, hist, measurementDate)
              : buildIndicatorTrajectory(r.indicator as PediatricIndicator, sx, birthDate, hist, measurementDate))
          : [];
        // Asegurar el punto de ESTA consulta con la edad/x del assessment (misma
        // que el encabezado). Si el historial no marcó isCurrent o faltó la fila,
        // no dejamos que el gráfico use otra edad.
        const dateKey = (d?: string | null) => (d ? String(d).slice(0, 10) : null);
        const curKey = dateKey(measurementDate);
        let hasCurrent = false;
        points = points.map((p) => {
          const isCur = p.isCurrent || (curKey != null && dateKey(p.date) === curKey);
          if (!isCur) return p;
          hasCurrent = true;
          return {
            ...p,
            x: r.chartX as number,
            value: r.chartValue as number,
            isCurrent: true,
            ageLabel: lbl,
            date: measurementDate ?? p.date,
          };
        });
        if (!hasCurrent) {
          points = [
            ...points,
            {
              x: r.chartX as number,
              value: r.chartValue as number,
              isCurrent: true,
              date: measurementDate ?? null,
              ageLabel: lbl,
            },
          ];
        }
        return {
          indicator: r.indicator,
          label: r.indicatorLabel,
          tone: r.classification.tone,
          points,
        };
      })
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
    <section className="overflow-hidden rounded-[18px] border border-brand-200/70 bg-white shadow-[0_10px_28px_rgba(59,95,235,0.08)]">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3.5 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15 ring-1 ring-white/25">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Resultados</p>
            <h3 className="text-[16px] font-bold leading-tight">Evaluación pediátrica</h3>
            <p className="text-[11px] text-white/85">
              {isZemel ? 'Síndrome de Down · Zemel (2015)' : 'Estándar OMS'} · edad: {ageLabel}
            </p>
          </div>
        </div>
        <Baby className="hidden h-8 w-8 text-white/35 sm:block" />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((r) => {
            const style = TONE_STYLES[r.classification.tone];
            const pos = gaugePosition(r.zScore, r.percentile);
            const nr = !isZemel && sex && typeof r.chartX === 'number'
              ? pediatricNormalRange(r.indicator as PediatricIndicator, sex, r.chartX, r.chartValue)
              : null;
            const zBand = isZemel ? null : pediatricNormalZBand(r.indicator as PediatricIndicator);
            const measured = typeof r.chartValue === 'number' ? formatCalc(r.chartValue) : null;
            const unit = MEASURE_UNIT[r.indicator] ?? '';
            return (
              <div
                key={r.indicator}
                className={`relative overflow-hidden rounded-[14px] border p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] ${style.card}`}
              >
                <span className={`absolute inset-y-0 left-0 w-1.5 ${style.accent}`} aria-hidden />
                <div className="flex items-start justify-between gap-2 pl-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{r.indicatorLabel}</p>
                  <span
                    className="rounded-lg bg-white/90 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600 ring-1 ring-slate-200/80"
                    title="z-score OMS o percentil"
                  >
                    {r.valueLabel}
                  </span>
                </div>
                {measured != null ? (
                  <p className={`mt-2 pl-1.5 text-[28px] font-extrabold leading-none tabular-nums ${style.value}`}>
                    {measured}
                    <span className="ml-1.5 text-sm font-semibold text-slate-400">
                      {r.indicator === 'bmi' ? 'IMC' : unit.trim()}
                    </span>
                  </p>
                ) : null}
                <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold shadow-sm ${style.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  {r.classification.label}
                </div>
                {pos !== null ? <MiniGauge position={pos} band={zBand} /> : null}
                {nr ? (
                  <p className="mt-2 pl-1.5 text-[11px] text-slate-500">
                    Normal: <span className="font-semibold tabular-nums text-slate-700">{formatNormalRange(nr)}</span>
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {sex && chartData.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setShowCharts((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-white"
            >
              <LineChart className="h-3.5 w-3.5 text-brand-500" />
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

        <p className="border-t border-slate-100 pt-3 text-[11px] leading-snug text-slate-400">
          {isZemel
            ? 'Cartas de crecimiento específicas para síndrome de Down · Zemel (2015). El resultado es el percentil respecto a la población con Down (0–20 años). A partir de los 20 años se usan los indicadores de adulto.'
            : 'Clasificación según los patrones de crecimiento de la OMS (adoptados por MINSA) y, en 5–18 años, percentiles de Frisancho/Fernández. El z-score expresa cuántas desviaciones estándar se aparta el niño de la mediana.'}
        </p>
      </div>
    </section>
  );
}
