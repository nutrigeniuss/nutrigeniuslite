import { useEffect, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, HelpCircle, Pencil, RotateCcw } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  evaluateValue,
  formatRange,
  hasValue,
  parseLabNumber,
  type LabAnalyte,
  type LabRange,
  type LabStatus,
} from './biochemConfig';

export type RangeSource = 'entry' | 'account' | 'default' | 'none';

type LabValueRowProps = {
  analyte: LabAnalyte;
  value: number | string | null;
  onChange: (value: number | string | null) => void;
  range: LabRange | null;
  source: RangeSource;
  /** Guarda el rango solo para esta toma (null = quitar el override). */
  onSaveEntryRange: (range: LabRange | null) => void;
  /** Guarda el rango para toda la cuenta (null = volver al del sistema). */
  onSaveAccountRange: (range: LabRange | null) => void;
  inputRef?: (element: HTMLInputElement | HTMLSelectElement | null) => void;
  onEnter?: () => void;
  /** `stack` = tarjeta móvil; `row` = fila de tabla (default). */
  layout?: 'row' | 'stack';
};

const STATUS_STYLES: Record<Exclude<LabStatus, null>, { box: string; text: string; unit: string }> = {
  high: { box: 'border-red-300 bg-red-50/70', text: 'text-red-600', unit: 'text-red-400' },
  low: { box: 'border-sky-300 bg-sky-50/70', text: 'text-sky-700', unit: 'text-sky-400' },
  abnormal: { box: 'border-amber-300 bg-amber-50/70', text: 'text-amber-700', unit: 'text-amber-500' },
  normal: { box: 'border-emerald-200 bg-emerald-50/40', text: 'text-emerald-700', unit: 'text-emerald-500' },
};

const EMPTY_STYLE = { box: 'border-[#dde3f0]/80 bg-[#f7f8ff]', text: 'text-slate-400', unit: 'text-slate-300' };

const SOURCE_LABEL: Record<RangeSource, string> = {
  entry: 'Solo esta toma',
  account: 'Mi laboratorio',
  default: 'Valor del sistema',
  none: 'Sin rango de referencia',
};

function RangeEditor({
  analyte,
  range,
  source,
  onSaveEntryRange,
  onSaveAccountRange,
  onClose,
}: {
  analyte: LabAnalyte;
  range: LabRange | null;
  source: RangeSource;
  onSaveEntryRange: (range: LabRange | null) => void;
  onSaveAccountRange: (range: LabRange | null) => void;
  onClose: () => void;
}) {
  const [min, setMin] = useState(range?.min != null ? String(range.min) : '');
  const [max, setMax] = useState(range?.max != null ? String(range.max) : '');
  const [scope, setScope] = useState<'entry' | 'account'>(source === 'entry' ? 'entry' : 'account');

  useEffect(() => {
    setMin(range?.min != null ? String(range.min) : '');
    setMax(range?.max != null ? String(range.max) : '');
  }, [range?.min, range?.max]);

  const apply = (): void => {
    const next: LabRange = { min: parseLabNumber(min), max: parseLabNumber(max) };
    const isEmpty = next.min == null && next.max == null;
    if (scope === 'entry') onSaveEntryRange(isEmpty ? null : next);
    else onSaveAccountRange(isEmpty ? null : next);
    onClose();
  };

  const restore = (): void => {
    onSaveEntryRange(null);
    onSaveAccountRange(null);
    onClose();
  };

  const inputClass = 'w-full rounded-[10px] border border-slate-200 bg-white px-2.5 py-1.5 text-right text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10';

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rango de referencia</p>
        <p className="text-[12.5px] font-semibold text-slate-700">{analyte.label}</p>
        <p className="mt-0.5 text-[10.5px] text-slate-400">Actual: {SOURCE_LABEL[source]}</p>
      </div>

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Mínimo</span>
          <input type="number" inputMode="decimal" step="any" value={min} onChange={(event) => setMin(event.target.value)} className={inputClass} />
        </label>
        <span className="pb-2 text-slate-300">–</span>
        <label className="flex-1">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Máximo</span>
          <input type="number" inputMode="decimal" step="any" value={max} onChange={(event) => setMax(event.target.value)} className={inputClass} />
        </label>
        {analyte.unit ? <span className="pb-2 text-[11px] font-semibold text-slate-400">{analyte.unit}</span> : null}
      </div>

      <div>
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400">Aplicar a</span>
        <div className="flex gap-1.5">
          {([
            { key: 'account', label: 'Mi laboratorio', hint: 'Todos mis pacientes' },
            { key: 'entry', label: 'Solo esta toma', hint: 'Examen de otro laboratorio' },
          ] as const).map((option) => (
            <button
              key={option.key}
              type="button"
              title={option.hint}
              onClick={() => setScope(option.key)}
              className={`flex-1 rounded-[10px] border px-2 py-1.5 text-[11px] font-semibold transition ${
                scope === option.key
                  ? 'border-brand-500 bg-brand-50 text-brand-500'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onClick={restore}
          title="Volver al rango de referencia del sistema"
          className="flex items-center gap-1.5 rounded-[10px] border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          <RotateCcw className="h-3 w-3" />
          Restaurar
        </button>
        <button
          type="button"
          onClick={apply}
          className="flex-1 rounded-[10px] bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-600"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function ValueControl({
  analyte,
  value,
  onChange,
  status,
  style,
  filled,
  inputRef,
  onEnter,
}: {
  analyte: LabAnalyte;
  value: number | string | null;
  onChange: (value: number | string | null) => void;
  status: LabStatus;
  style: { box: string; text: string; unit: string };
  filled: boolean;
  inputRef?: (element: HTMLInputElement | HTMLSelectElement | null) => void;
  onEnter?: () => void;
}): ReactNode {
  if (analyte.kind === 'select') {
    return (
      <select
        ref={(element) => inputRef?.(element)}
        value={(value as string) ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className={`w-full cursor-pointer rounded-[12px] border px-3 py-2.5 text-[13px] font-semibold outline-none transition-all ${style.box} ${filled ? style.text : 'text-slate-400'}`}
      >
        <option value="">Seleccionar</option>
        {analyte.options?.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className={`flex items-center gap-1 overflow-hidden rounded-[12px] border transition-all ${style.box}`}>
      {status === 'high' || status === 'low' ? (
        <span
          className={`pl-2.5 ${style.text}`}
          title={status === 'high' ? 'Por encima del rango de referencia' : 'Por debajo del rango de referencia'}
        >
          {status === 'high' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        </span>
      ) : null}
      <input
        ref={(element) => inputRef?.(element)}
        type="number"
        inputMode="decimal"
        step={analyte.step ?? 'any'}
        value={value ?? ''}
        onChange={(event) => onChange(parseLabNumber(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter?.();
          }
        }}
        className={`w-full min-w-0 bg-transparent px-3 py-2.5 text-right text-[13px] font-bold outline-none placeholder:font-normal placeholder:text-slate-300 ${filled ? style.text : 'text-slate-400'}`}
        placeholder="–"
      />
      {analyte.unit ? <span className={`shrink-0 pr-3.5 text-[11px] font-semibold ${filled ? style.unit : 'text-slate-300'}`}>{analyte.unit}</span> : null}
    </div>
  );
}

function RangeControl({
  analyte,
  range,
  source,
  rangeOpen,
  setRangeOpen,
  onSaveEntryRange,
  onSaveAccountRange,
}: {
  analyte: LabAnalyte;
  range: LabRange | null;
  source: RangeSource;
  rangeOpen: boolean;
  setRangeOpen: (open: boolean) => void;
  onSaveEntryRange: (range: LabRange | null) => void;
  onSaveAccountRange: (range: LabRange | null) => void;
}): ReactNode {
  if (analyte.kind === 'select') {
    return <span className="text-[11.5px] text-slate-400">{analyte.normal ? `Normal: ${analyte.normal}` : '—'}</span>;
  }

  return (
    <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Editar el rango de referencia"
          className="group flex items-center gap-1.5 rounded-[8px] px-1.5 py-1 text-left transition hover:bg-slate-50"
        >
          <span className={`text-[12px] tabular-nums ${source === 'none' ? 'text-slate-300' : 'text-slate-500'}`}>
            {formatRange(range)}
          </span>
          {source === 'entry' || source === 'account' ? (
            <span
              title={SOURCE_LABEL[source]}
              className="rounded-full bg-brand-50 px-1.5 py-[1px] text-[8.5px] font-bold uppercase tracking-wider text-brand-500"
            >
              {source === 'entry' ? 'toma' : 'lab'}
            </span>
          ) : null}
          <Pencil className="h-3 w-3 text-slate-200 transition group-hover:text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <RangeEditor
          analyte={analyte}
          range={range}
          source={source}
          onSaveEntryRange={onSaveEntryRange}
          onSaveAccountRange={onSaveAccountRange}
          onClose={() => setRangeOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function LabValueRow({
  analyte,
  value,
  onChange,
  range,
  source,
  onSaveEntryRange,
  onSaveAccountRange,
  inputRef,
  onEnter,
  layout = 'row',
}: LabValueRowProps) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const status = evaluateValue(analyte, value, range);
  const style = status ? STATUS_STYLES[status] : EMPTY_STYLE;
  const filled = hasValue(value);

  const label = (
    <div className="flex items-center gap-1.5">
      <span className={`text-[13px] ${filled ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>{analyte.label}</span>
      {analyte.hint ? (
        <span title={analyte.hint} className="cursor-help text-slate-300 transition hover:text-slate-500">
          <HelpCircle className="h-3 w-3" />
        </span>
      ) : null}
    </div>
  );

  const valueControl = (
    <ValueControl
      analyte={analyte}
      value={value}
      onChange={onChange}
      status={status}
      style={style}
      filled={filled}
      inputRef={inputRef}
      onEnter={onEnter}
    />
  );

  const rangeControl = (
    <RangeControl
      analyte={analyte}
      range={range}
      source={source}
      rangeOpen={rangeOpen}
      setRangeOpen={setRangeOpen}
      onSaveEntryRange={onSaveEntryRange}
      onSaveAccountRange={onSaveAccountRange}
    />
  );

  if (layout === 'stack') {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-[#fafbfd] p-3.5">
        <div className="mb-2.5 flex items-start justify-between gap-2">
          {label}
          {rangeControl}
        </div>
        {valueControl}
      </div>
    );
  }

  return (
    <tr className="border-b border-slate-50 last:border-b-0">
      <td className="py-3 pr-3 align-middle">{label}</td>
      <td className="w-[160px] py-3 pr-3 align-middle md:w-[188px]">{valueControl}</td>
      <td className="w-[120px] py-3 align-middle md:w-[140px]">{rangeControl}</td>
    </tr>
  );
}
