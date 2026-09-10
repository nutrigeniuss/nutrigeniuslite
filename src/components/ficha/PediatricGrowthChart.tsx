import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  buildTrajectoryCurve,
  buildZemelCurve,
  type PediatricIndicator,
  type PediatricSex,
  type PediatricTone,
  type TrajectoryPoint,
  type ZemelPublicIndicator,
} from '@/lib/anthropometry/pediatric';

// Curva de crecimiento con el ESTILO OFICIAL de la OMS: líneas SD verde (mediana),
// roja (±2) y negra (±3) con sus etiquetas al borde derecho, eje Y a ambos lados
// y marco de color por sexo. Encima, la progresión del niño (todas sus mediciones).
type PediatricGrowthChartProps = {
  indicator: string;
  sex: PediatricSex;
  label: string;
  points: TrajectoryPoint[];
  currentTone?: PediatricTone;
  // 'oms' (por defecto) o 'zemel' (síndrome de Down): cambia las curvas de
  // referencia (SD OMS ↔ percentiles Zemel).
  standard?: 'oms' | 'zemel';
};

// Colores de marca (verde/rojo/azul) sobre la convención OMS (mediana verde,
// ±2 rojo, ±3 negro).
const BRAND_GREEN = '#00ff01';
const BRAND_RED = '#ff5c57';
const BRAND_BLUE = '#3b5feb';

const C_MEDIAN = BRAND_GREEN; // mediana
const C_SD2 = BRAND_RED;      // ±2 DE
const C_SD3 = '#111111';      // ±3 DE (negro, convención OMS)

// Marca la medición SELECCIONADA (la que se está viendo): rojo encendido con un
// halo suave, para que resalte sobre los puntos grises del historial. La edad se
// muestra al pasar el cursor (tooltip), no como etiqueta fija.
const SELECTED = '#ff3b30';
const HISTORY_DOT = '#94a3b8'; // puntos del historial (no seleccionados), atenuados

// Qué mide cada indicador (para el tooltip: "Peso: 9.6 kg", etc.).
const MEASURE: Record<string, { label: string; unit: string }> = {
  wfa: { label: 'Peso', unit: ' kg' },
  lhfa: { label: 'Talla', unit: ' cm' },
  hfa: { label: 'Talla', unit: ' cm' },
  wfl: { label: 'Peso', unit: ' kg' },
  wfh: { label: 'Peso', unit: ' kg' },
  bmi: { label: 'IMC', unit: '' },
  hcfa: { label: 'P. cefálico', unit: ' cm' },
  acfa: { label: 'P. braquial', unit: ' cm' },
  tsfa: { label: 'Tríceps', unit: ' mm' },
  ssfa: { label: 'Subescapular', unit: ' mm' },
};

export default function PediatricGrowthChart({
  indicator,
  sex,
  label,
  points,
  standard = 'oms',
}: PediatricGrowthChartProps) {
  const curve = useMemo(
    () => (standard === 'zemel'
      ? buildZemelCurve(indicator as ZemelPublicIndicator, sex, points.map((p) => p.x))
      : buildTrajectoryCurve(indicator as PediatricIndicator, sex, points.map((p) => p.x))),
    [indicator, sex, points, standard],
  );

  const meta = useMemo(() => {
    if (!curve) return null;
    const xs = curve.points.map((p) => p.x);
    const xMin = xs[0];
    const xMax = xs[xs.length - 1];
    const isAge = curve.unit === 'month';
    // Ticks del eje X: cada año (edad) o cada 10 cm (talla). Se calculan SIEMPRE:
    // además de rotular el eje, recharts los usa para fijar el dominio (ver el
    // comentario del XAxis), así que un eje sin ticks se quedaba sin escala.
    const xTicks: number[] = [];
    if (isAge) {
      for (let m = Math.ceil(xMin / 12) * 12; m <= xMax; m += 12) xTicks.push(m);
    } else {
      const step = xMax - xMin > 30 ? 10 : 5;
      for (let cm = Math.ceil(xMin / step) * step; cm <= xMax; cm += step) xTicks.push(cm);
    }
    // Dominio Y: basado SOLO en las curvas SD (−3..+3) con un margen. Los puntos
    // del niño NO expanden la escala (un dato extremo/erróneo la aplastaría); si
    // caen fuera, se fijan al borde al dibujarlos.
    const ys = curve.points.flatMap((p) => [p.sd3neg, p.sd3]);
    const yMin = Math.floor(Math.min(...ys) - 1);
    const yMax = Math.ceil(Math.max(...ys) + 1);
    const rangeLabel = isAge
      ? `${Math.round(xMin / 12)} a ${Math.round(xMax / 12)} años`
      : `${xMin} a ${xMax} cm`;
    return { isAge, xMin, xMax, xTicks, yMin, yMax, rangeLabel };
  }, [curve]);

  if (!curve || !meta || points.length === 0) return null;

  const { isAge, xMin, xMax, xTicks, yMin, yMax, rangeLabel } = meta;
  const lastIndex = curve.points.length - 1;
  const fmtX = (x: number): string => (isAge ? `${Math.round(x / 12)}` : `${x}`);
  const fmtXFull = (x: number): string => (isAge ? `${Math.floor(x / 12)}a ${Math.round(x % 12)}m` : `${x} cm`);

  const frame = sex === 'girls' ? '#e5007d' : '#0e75bc';
  const current = points.find((p) => p.isCurrent) ?? points[points.length - 1];
  const measure = MEASURE[indicator] ?? { label: 'Valor', unit: '' };
  // Etiquetas de las 5 líneas: percentiles (Zemel) o z-scores OMS.
  const lineLabels = curve.lineLabels ?? ['-3', '-2', '0', '2', '3'];
  const refLabel = curve.lineLabels ? 'percentiles (Zemel · Down)' : 'z-scores (OMS)';
  const legMid = curve.lineLabels ? curve.lineLabels[2] : 'Mediana';
  const legInner = curve.lineLabels ? `${curve.lineLabels[1]}/${curve.lineLabels[3]}` : '±2 DE';
  const legOuter = curve.lineLabels ? `${curve.lineLabels[0]}/${curve.lineLabels[4]}` : '±3 DE';
  // Valores fijados al dominio para DIBUJAR (el tooltip conserva el valor real).
  const clampY = (v: number): number => Math.max(yMin, Math.min(yMax, v));
  const plotPoints = points.map((p) => ({ ...p, value: clampY(p.value) }));
  const currentY = clampY(current.value);

  // Etiqueta al borde derecho de cada línea SD (solo en el último punto).
  const endLabel = (text: string, color: string) => (props: { x?: string | number; y?: string | number; index?: number }) => {
    const px = Number(props.x);
    const py = Number(props.y);
    if (props.index !== lastIndex || !Number.isFinite(px) || !Number.isFinite(py)) return null;
    return (
      <text x={px + 4} y={py} dy={3} fontSize={11} fontWeight={700} fill={color}>{text}</text>
    );
  };

  return (
    <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: frame }}>
      <div className="px-3 py-1.5 text-white" style={{ background: frame }}>
        <p className="text-[11px] font-bold uppercase tracking-wide leading-tight">
          {label} · {sex === 'girls' ? 'niñas' : 'niños'}
        </p>
        <p className="text-[9px] leading-tight opacity-90">{rangeLabel} · {refLabel}</p>
      </div>
      <div className="bg-white p-2 pr-1">
        <ResponsiveContainer width="100%" height={230}>
          {/* Margen derecho amplio para las etiquetas de percentil (P95…P5) que van
              al final de cada curva. Se quitó el eje Y derecho porque sus valores se
              cruzaban con esas etiquetas; el eje izquierdo ya provee la escala. */}
          <ComposedChart data={curve.points} margin={{ top: 8, right: 40, bottom: 4, left: -6 }}>
            <CartesianGrid stroke="#e6ebf1" />
            {/* El dominio del eje X es el rango de la CURVA (0–5 años, 45–110 cm…),
                fijado a mano. Con 'dataMin/dataMax' recharts lo calculaba SOLO con
                los datos del Scatter (las mediciones del niño, que van en su propio
                `data`) e ignoraba la curva: con una única medición el eje se
                encogía a ese valor y las 5 líneas SD se apilaban en una vertical.
                Así salía "Peso para la talla" (las de edad se salvaban de casualidad
                porque sus ticks explícitos estiraban el dominio). */}
            <XAxis
              dataKey="x"
              type="number"
              domain={[xMin, xMax]}
              ticks={xTicks}
              tickFormatter={fmtX}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              label={{ value: isAge ? 'Edad (años)' : 'Talla (cm)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }}
            />
            <YAxis yAxisId="l" domain={[yMin, yMax]} tick={{ fontSize: 10, fill: '#94a3b8' }} width={30} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3' }}
              content={({ label: x, active }) => {
                if (!active || typeof x !== 'number') return null;
                const pt = points.find((p) => Math.abs(p.x - x) < 0.75);
                const ageText = isAge && pt?.ageLabel ? pt.ageLabel : fmtXFull(pt ? pt.x : x);
                return (
                  <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] shadow-sm">
                    <div className="text-slate-500">{isAge ? 'Edad' : 'Talla'}: {ageText}</div>
                    {pt ? (
                      <div className="font-bold" style={{ color: BRAND_BLUE }}>{measure.label}: {pt.value}{measure.unit}</div>
                    ) : null}
                  </div>
                );
              }}
            />
            {/* Zona normal (−2 a +2 DE) muy sutil */}
            <Area yAxisId="l" dataKey="normalBand" stroke="none" fill="#eafaf0" fillOpacity={0.7} isAnimationActive={false} />
            {/* Líneas de referencia (SD OMS o percentiles Zemel) */}
            <Line yAxisId="l" dataKey="sd3neg" dot={false} stroke={C_SD3} strokeWidth={1} isAnimationActive={false}>
              <LabelList content={endLabel(lineLabels[0], C_SD3)} />
            </Line>
            <Line yAxisId="l" dataKey="sd2neg" dot={false} stroke={C_SD2} strokeWidth={1} isAnimationActive={false}>
              <LabelList content={endLabel(lineLabels[1], C_SD2)} />
            </Line>
            <Line yAxisId="l" dataKey="sd0" dot={false} stroke={C_MEDIAN} strokeWidth={1.6} isAnimationActive={false}>
              <LabelList content={endLabel(lineLabels[2], C_MEDIAN)} />
            </Line>
            <Line yAxisId="l" dataKey="sd2" dot={false} stroke={C_SD2} strokeWidth={1} isAnimationActive={false}>
              <LabelList content={endLabel(lineLabels[3], C_SD2)} />
            </Line>
            <Line yAxisId="l" dataKey="sd3" dot={false} stroke={C_SD3} strokeWidth={1} isAnimationActive={false}>
              <LabelList content={endLabel(lineLabels[4], C_SD3)} />
            </Line>
            {/* Progresión del niño: línea + puntos del historial atenuados. El punto
                seleccionado no se dibuja aquí (lo resalta el marcador de abajo). */}
            <Scatter
              yAxisId="l"
              data={plotPoints}
              dataKey="value"
              line={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; payload?: TrajectoryPoint }) => {
                const { cx, cy, payload } = props;
                if (!Number.isFinite(cx) || !Number.isFinite(cy) || payload?.isCurrent) return <g />;
                return <circle cx={cx} cy={cy} r={3} fill="#fff" stroke={HISTORY_DOT} strokeWidth={1.5} />;
              }}
            />
            {/* Medición seleccionada: halo suave + punto rojo encendido. La edad se
                ve al pasar el cursor (tooltip). */}
            <ReferenceDot yAxisId="l" x={current.x} y={currentY} r={9} fill={SELECTED} fillOpacity={0.18} stroke="none" isFront />
            <ReferenceDot yAxisId="l" x={current.x} y={currentY} r={5.5} fill={SELECTED} stroke="#fff" strokeWidth={2} isFront />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 pb-0.5 text-[9px] text-slate-400">
          <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm ring-2 ring-[#ff3b30]/25" style={{ background: SELECTED }} /> Actual (esta consulta)</span>
          {points.length > 1 ? <span className="inline-flex items-center gap-1"><span className="inline-flex h-2 w-2 rounded-full border-2 bg-white" style={{ borderColor: HISTORY_DOT }} /> Otras mediciones</span> : null}
          <span className="inline-flex items-center gap-1"><span className="h-[2px] w-3" style={{ background: C_MEDIAN }} /> {legMid}</span>
          <span className="inline-flex items-center gap-1"><span className="h-[2px] w-3" style={{ background: C_SD2 }} /> {legInner}</span>
          <span className="inline-flex items-center gap-1"><span className="h-[2px] w-3" style={{ background: C_SD3 }} /> {legOuter}</span>
        </div>
      </div>
    </div>
  );
}
