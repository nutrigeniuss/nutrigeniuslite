import { useState } from 'react';
import { AlertTriangle, ArrowRight, Calculator, Info, Pencil, RotateCcw, Scale } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCalc } from '@/lib/formatCalc';
import { INDEX_GROUPS, type IndexResult, type IndexTone, type MissingInput } from './labIndices';

type LabIndicesPanelProps = {
  results: IndexResult[];
  /** Peso habitual ya registrado, para mostrarlo y permitir corregirlo. */
  habitualWeightKg: number | null;
  /** Lleva a la pestaña de captura donde se completa un insumo faltante. */
  onGoToPanel: (panelKey: string) => void;
  /** Guarda (o borra con null) el peso habitual sin salir de esta pantalla. */
  onSaveHabitualWeight: (kg: number | null) => void;
  /** Guarda (o restaura con null) un punto de corte personalizado. */
  onSaveThreshold: (key: string, value: number | null) => void;
};

const TONE_STYLES: Record<IndexTone, { chip: string; bar: string; value: string }> = {
  critical: { chip: 'bg-rose-50 text-rose-700', bar: 'bg-rose-400', value: 'text-rose-600' },
  warning: { chip: 'bg-orange-50 text-orange-700', bar: 'bg-orange-400', value: 'text-orange-600' },
  caution: { chip: 'bg-amber-50 text-amber-700', bar: 'bg-amber-300', value: 'text-amber-600' },
  normal: { chip: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-400', value: 'text-emerald-600' },
};

const PANEL_FOR_MISSING: Record<MissingInput['where'], string | null> = {
  quimica: 'quimica',
  clinica: 'clinica',
  mediciones: null,
  peso_habitual: null,
  datos_generales: null,
};

const MISSING_HINT: Record<MissingInput['where'], string> = {
  quimica: 'Química sanguínea',
  clinica: 'Valoración clínica',
  mediciones: 'Regístralo en la pestaña Mediciones',
  peso_habitual: 'Se registra una sola vez',
  datos_generales: 'Complétalo en Datos generales',
};

/**
 * Barra de posición: pinta las bandas de interpretación del índice a lo ancho
 * del dominio y marca dónde cayó el paciente. Deja ver de un vistazo si está
 * pegado al límite o muy pasado, cosa que el número solo no comunica.
 */
function PositionBar({ result }: { result: IndexResult }) {
  const [min, max] = result.domain;
  const span = max - min || 1;

  const segments = result.bands.map((band, index) => {
    const start = index === 0 ? min : (result.bands[index - 1].max ?? max);
    const end = band.max ?? max;
    return { band, width: (Math.max(0, Math.min(end, max) - Math.max(start, min)) / span) * 100 };
  });

  const position = result.value === null ? null : ((Math.min(Math.max(result.value, min), max) - min) / span) * 100;

  return (
    <div className="mt-3">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="flex h-full w-full">
          {segments.map((segment, index) => (
            <div
              key={`${result.key}-band-${index}`}
              className={`h-full ${TONE_STYLES[segment.band.tone].bar} opacity-40`}
              style={{ width: `${segment.width}%` }}
              title={segment.band.label}
            />
          ))}
        </div>
      </div>
      {position !== null ? (
        <div className="relative h-3">
          <span
            className="absolute top-0 h-3 w-[3px] -translate-x-1/2 rounded-full bg-slate-800"
            style={{ left: `${position}%` }}
          />
        </div>
      ) : (
        <div className="h-3" />
      )}
      <div className="flex justify-between text-[9.5px] tabular-nums text-slate-300">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function ThresholdEditor({
  result,
  onSave,
}: {
  result: IndexResult;
  onSave: (key: string, value: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = result.bands[0]?.max ?? result.defaultThreshold ?? null;
  const [draft, setDraft] = useState(current != null ? String(current) : '');
  const isCustom = result.defaultThreshold != null && current != null && current !== result.defaultThreshold;

  if (!result.thresholdKey) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Editar el punto de corte"
          className="group flex items-center gap-1 rounded-[7px] px-1.5 py-0.5 text-[10px] text-slate-400 transition hover:bg-slate-50"
        >
          <span className="tabular-nums">corte {current}</span>
          {isCustom ? (
            <span className="rounded-full bg-brand-50 px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wider text-brand-500">
              personalizado
            </span>
          ) : null}
          <Pencil className="h-2.5 w-2.5 text-slate-200 transition group-hover:text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-3">
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Punto de corte</p>
            <p className="text-[12px] font-semibold text-slate-700">{result.label}</p>
            <p className="mt-1 text-[10.5px] leading-snug text-slate-500">{result.reference}</p>
          </div>
          <input
            type="number"
            step="any"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-full rounded-[10px] border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
          <p className="text-[10px] text-slate-400">
            Por defecto: {result.defaultThreshold}. Se aplica a todos tus pacientes.
          </p>
          <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                onSave(result.thresholdKey as string, null);
                setDraft(String(result.defaultThreshold ?? ''));
                setOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-[10px] border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              <RotateCcw className="h-3 w-3" />
              Restaurar
            </button>
            <button
              type="button"
              onClick={() => {
                const parsed = Number.parseFloat(draft);
                onSave(result.thresholdKey as string, Number.isFinite(parsed) ? parsed : null);
                setOpen(false);
              }}
              className="flex-1 rounded-[10px] bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-600"
            >
              Guardar
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HabitualWeightInline({
  initialKg = null,
  onSave,
  onCancel,
}: {
  initialKg?: number | null;
  onSave: (kg: number | null) => void;
  onCancel?: () => void;
}) {
  const [kg, setKg] = useState(initialKg != null ? String(initialKg) : '');

  const commit = (): void => {
    const parsed = Number.parseFloat(kg);
    if (Number.isFinite(parsed)) onSave(parsed);
    else if (kg.trim() === '' && initialKg != null) onSave(null); // vaciar = quitar
  };

  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <div className="flex items-center overflow-hidden rounded-[9px] border border-slate-200 bg-white">
        <input
          autoFocus
          type="number"
          step="0.1"
          value={kg}
          onChange={(event) => setKg(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') onCancel?.();
          }}
          placeholder="—"
          className="w-16 bg-transparent px-2 py-1 text-right text-[12px] font-bold text-slate-700 outline-none placeholder:font-normal placeholder:text-slate-300"
        />
        <span className="pr-2 text-[10px] font-semibold text-slate-400">kg</span>
      </div>
      <button
        type="button"
        onClick={commit}
        className="rounded-[9px] bg-brand-500 px-2.5 py-1 text-[10.5px] font-semibold text-white transition hover:bg-brand-600"
      >
        Guardar
      </button>
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[9px] px-2 py-1 text-[10.5px] font-semibold text-slate-400 transition hover:text-slate-600"
        >
          Cancelar
        </button>
      ) : null}
    </div>
  );
}

/**
 * Peso habitual dentro de la tarjeta del índice que lo consume. Se muestra
 * siempre —no solo cuando falta— para poder corregir un valor mal tipeado sin
 * salir de aquí; también se edita en la cabecera de Mediciones.
 */
function HabitualWeightRow({ kg, onSave }: { kg: number; onSave: (kg: number | null) => void }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <HabitualWeightInline
        initialKg={kg}
        onSave={(next) => {
          onSave(next);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Corregir el peso habitual"
      className="group mt-1.5 flex items-center gap-1.5 rounded-[8px] px-1.5 py-0.5 -ml-1.5 text-[10.5px] text-slate-400 transition hover:bg-slate-50"
    >
      <Scale className="h-3 w-3" />
      <span>Peso habitual <strong className="font-semibold text-slate-600">{kg} kg</strong></span>
      <Pencil className="h-2.5 w-2.5 text-slate-200 transition group-hover:text-slate-400" />
    </button>
  );
}

function IndexCard({
  result,
  habitualWeightKg,
  onGoToPanel,
  onSaveHabitualWeight,
  onSaveThreshold,
}: {
  result: IndexResult;
  habitualWeightKg: number | null;
  onGoToPanel: (panelKey: string) => void;
  onSaveHabitualWeight: (kg: number | null) => void;
  onSaveThreshold: (key: string, value: number | null) => void;
}) {
  const tone = result.band ? TONE_STYLES[result.band.tone] : null;
  const computed = result.value !== null;

  return (
    <div className={`relative flex h-full flex-col overflow-hidden rounded-[1.15rem] border p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5 ${
      computed
        ? 'border-brand-200/70 bg-gradient-to-br from-brand-50/40 via-white to-white'
        : 'border-slate-200/80 bg-[#fafbfd]'
    }`}>
      {computed ? <span className="absolute inset-y-0 left-0 w-1.5 bg-brand-500" aria-hidden /> : null}
      <div className="flex items-start justify-between gap-2 pl-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <h5 className="truncate text-[13px] font-bold text-slate-800">{result.label}</h5>
          <span title={result.reference} className="cursor-help text-slate-300 transition hover:text-slate-500">
            <Info className="h-3 w-3" />
          </span>
        </div>
        <ThresholdEditor result={result} onSave={onSaveThreshold} />
      </div>

      {computed ? (
        <>
          <div className="mt-2.5 flex items-end justify-between gap-2 pl-1">
            <span className={`text-[30px] font-extrabold leading-none tabular-nums ${tone?.value ?? 'text-slate-800'}`}>
              {formatCalc(result.value)}
            </span>
            {result.band ? (
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm ${tone?.chip}`}>
                {result.band.label}
              </span>
            ) : null}
          </div>

          <PositionBar result={result} />

          {/* Fórmula con los valores reemplazados: el cálculo queda auditable
              sin tener que confiar en el número a ciegas. */}
          {result.formula ? (
            <p className="mt-1 break-words rounded-[9px] bg-[#f7f8ff] px-2.5 py-1.5 text-[10.5px] leading-relaxed text-slate-500">
              {result.formula}
            </p>
          ) : null}

          {result.sources.map((source) => (
            <p key={source} className="mt-1.5 text-[10.5px] text-slate-400">{source}</p>
          ))}

          {result.usesHabitualWeight && habitualWeightKg != null ? (
            <HabitualWeightRow kg={habitualWeightKg} onSave={onSaveHabitualWeight} />
          ) : null}

          {result.warnings.map((warning) => (
            <p key={warning} className="mt-1.5 flex items-start gap-1.5 rounded-[9px] bg-amber-50 px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-700">
              <AlertTriangle className="mt-[1px] h-3 w-3 flex-shrink-0" />
              {warning}
            </p>
          ))}
        </>
      ) : (
        <div className="mt-2.5 space-y-2">
          {result.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-1.5 rounded-[9px] bg-amber-50 px-2.5 py-1.5 text-[10.5px] leading-snug text-amber-700">
              <AlertTriangle className="mt-[1px] h-3 w-3 flex-shrink-0" />
              {warning}
            </p>
          ))}

          {result.missing.length > 0 ? (
            <div className="rounded-[12px] border border-dashed border-slate-200 bg-slate-50/60 p-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {result.missing.length === 1 ? 'Falta un dato' : `Faltan ${result.missing.length} datos`}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {result.missing.map((item) => {
                  const panelKey = PANEL_FOR_MISSING[item.where];
                  return (
                    <li key={item.key}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-slate-600">{item.label}</span>
                        {panelKey ? (
                          <button
                            type="button"
                            onClick={() => onGoToPanel(panelKey)}
                            className="flex items-center gap-1 text-[10.5px] font-semibold text-brand-500 transition hover:underline"
                          >
                            {MISSING_HINT[item.where]}
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        ) : item.where === 'peso_habitual' ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Scale className="h-3 w-3" />
                            {MISSING_HINT[item.where]}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">{MISSING_HINT[item.where]}</span>
                        )}
                      </div>
                      {/* El peso habitual se completa aquí mismo: es donde el
                          nutri descubre que falta, y vive en otra pestaña. */}
                      {item.where === 'peso_habitual' ? (
                        <HabitualWeightInline onSave={onSaveHabitualWeight} />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function LabIndicesPanel({
  results,
  habitualWeightKg,
  onGoToPanel,
  onSaveHabitualWeight,
  onSaveThreshold,
}: LabIndicesPanelProps) {
  const computed = results.filter((result) => result.value !== null).length;

  return (
    <div className="overflow-hidden rounded-[18px] border border-brand-200/70 bg-white shadow-[0_10px_28px_rgba(59,95,235,0.08)]">
      <div className="flex flex-wrap items-end justify-between gap-2 bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3.5 text-white sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/15 ring-1 ring-white/25">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Resultados</p>
            <h4 className="text-[16px] font-bold leading-tight">Índices calculados</h4>
            <p className="text-[11px] text-white/85">
              {computed} de {results.length} con datos suficientes
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-7 p-5 sm:p-6 lg:p-7">
        {INDEX_GROUPS.map((group) => {
          const groupResults = results.filter((result) => result.group === group);
          if (groupResults.length === 0) return null;

          return (
            <div key={group}>
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{group}</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {groupResults.map((result) => (
                  <IndexCard
                    key={result.key}
                    result={result}
                    habitualWeightKg={habitualWeightKg}
                    onGoToPanel={onGoToPanel}
                    onSaveHabitualWeight={onSaveHabitualWeight}
                    onSaveThreshold={onSaveThreshold}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400 sm:px-6">
        Se recalculan solos al corregir cualquier valor. No se guardan. Valores con 2 decimales.
      </p>
    </div>
  );
}
