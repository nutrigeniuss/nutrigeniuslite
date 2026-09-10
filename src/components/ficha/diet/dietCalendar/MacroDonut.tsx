import { macroSplit, type PlanTotals } from '@/lib/diet/weekSummary';
import { getCurrentLocale } from '@/lib/formatLocale';

// Paleta de DATOS, deliberadamente distinta del azul de marca. El azul
// #3b5feb significa "esto se puede pulsar" en toda la app; si el gráfico lo
// usara, competiría con los botones que tiene al lado. Ámbar, coral (el
// secundario de marca) y verdeazul se distinguen entre sí y no se confunden
// con un control.
export const MACRO_COLORS = {
  cho: '#e9a23b',
  prot: '#ff5c57',
  lip: '#2bb3a3',
} as const;

type MacroDonutProps = {
  totals: PlanTotals;
  /** Diámetro en píxeles. */
  size?: number;
  /** Texto bajo la cifra: 'KCAL' en un día, 'KCAL / DÍA' en el promedio semanal. */
  unitLabel?: string;
};

const RADIUS = 52;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Anillo de reparto de macros con las kcal en el centro.
 * Los porcentajes salen de `macroSplit`, que reparte sobre las kcal de los
 * macros (4/4/9) y no sobre el total declarado del plan.
 */
export default function MacroDonut({ totals, size = 104, unitLabel = 'KCAL' }: MacroDonutProps) {
  const { carbPct, protPct, fatPct } = macroSplit(totals);

  const segments = [
    { pct: carbPct, color: MACRO_COLORS.cho },
    { pct: protPct, color: MACRO_COLORS.prot },
    { pct: fatPct, color: MACRO_COLORS.lip },
  ];

  let offset = 0;
  const arcs = segments.map((segment) => {
    const dash = (segment.pct / 100) * CIRCUMFERENCE;
    const arc = (
      <circle
        key={segment.color}
        cx="64"
        cy="64"
        r={RADIUS}
        fill="none"
        stroke={segment.color}
        strokeWidth={STROKE}
        strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        transform="rotate(-90 64 64)"
      />
    );
    offset += dash;
    return arc;
  });

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={RADIUS} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
        {arcs}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[22px] font-extrabold leading-none tracking-tight text-slate-800 tabular-nums">
          {totals.cal.toLocaleString(getCurrentLocale())}
        </p>
        <p className="mt-0.5 text-[8.5px] font-bold uppercase tracking-[0.09em] text-slate-400">{unitLabel}</p>
      </div>
    </div>
  );
}

type MacroLegendProps = {
  totals: PlanTotals;
  /** Nombres largos en el resumen semanal, cortos en el panel de un día. */
  long?: boolean;
};

export function MacroLegend({ totals, long = false }: MacroLegendProps) {
  const { carbPct, protPct, fatPct } = macroSplit(totals);

  const rows = [
    { color: MACRO_COLORS.cho, name: long ? 'Carbohidratos' : 'Cho', grams: totals.carbs, pct: carbPct },
    { color: MACRO_COLORS.prot, name: long ? 'Proteínas' : 'Prot', grams: totals.prot, pct: protPct },
    { color: MACRO_COLORS.lip, name: long ? 'Grasas' : 'Lip', grams: totals.fat, pct: fatPct },
  ];

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-2.5 text-[12.5px]">
          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ backgroundColor: row.color }} />
          <span className="flex-1 truncate text-slate-600">{row.name}</span>
          <span className="min-w-[44px] text-right text-[11.5px] tabular-nums text-slate-400">{row.grams} g</span>
          <span className="min-w-[34px] text-right font-bold tabular-nums text-slate-800">{row.pct} %</span>
        </div>
      ))}
    </div>
  );
}

/** Barra fina de reparto para la tarjeta de un día, donde no cabe el anillo. */
export function MacroBar({ totals }: { totals: PlanTotals }) {
  const { carbPct, protPct, fatPct } = macroSplit(totals);
  if (carbPct + protPct + fatPct === 0) return null;

  return (
    <div className="flex h-[5px] overflow-hidden rounded-[3px] bg-slate-100" aria-hidden="true">
      <span style={{ width: `${carbPct}%`, backgroundColor: MACRO_COLORS.cho }} />
      <span style={{ width: `${protPct}%`, backgroundColor: MACRO_COLORS.prot }} />
      <span style={{ width: `${fatPct}%`, backgroundColor: MACRO_COLORS.lip }} />
    </div>
  );
}
