// Sub-componentes presentacionales de la dieta del paciente: barra de macro del
// historial de intercambios y el modal para fechar/nombrar un plan nuevo.
import { X } from 'lucide-react';
import { clampPercentage, DEFAULT_EXCHANGE_PLAN_TITLE } from './logic';
import type { DatePromptModalProps, ExchangeMacroBarProps } from './types';

export function ExchangeMacroBar({ label, value, fillClassName }: ExchangeMacroBarProps) {
  return (
    <div className="flex min-w-[104px] items-center gap-1.5">
      <div className="h-[5px] w-[62px] overflow-hidden rounded-full bg-[#e9edf9]">
        <div className={`h-full rounded-full ${fillClassName}`} style={{ width: `${clampPercentage(value)}%` }} />
      </div>
      <p className="text-[10px] font-medium text-slate-500">
        {label} <span className="font-semibold text-slate-600">{value}%</span>
      </p>
    </div>
  );
}

export function DatePromptModal({ open, title, description, value, planName, onChange, onPlanNameChange, onClose, onConfirm, confirmLabel }: DatePromptModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar selector de fecha">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Nombre del plan</label>
            <input
              type="text"
              value={planName}
              onChange={(event) => onPlanNameChange(event.target.value)}
              placeholder={DEFAULT_EXCHANGE_PLAN_TITLE}
              className="w-full rounded-2xl border border-[#dde3f0]/80 bg-[#f7f8ff] px-4 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Fecha de creación</label>
          <input
            type="date"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="w-full rounded-2xl border border-[#dde3f0]/80 bg-[#f7f8ff] px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700">
            Cancelar
          </button>
          <button onClick={onConfirm} className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
