import { Link } from 'react-router-dom';
import { ArrowRightLeft, CalendarDays, ChevronRight, Copy, Pencil, Trash2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import type { ExchangePlan } from '../patientDietTypes';
import type { ExchangeMacroBreakdown } from './types';
import { DEFAULT_EXCHANGE_PLAN_TITLE } from './logic';
import { ExchangeMacroBar } from './components';
import { MACRO_STYLES } from '@/lib/macroColors';

type ExchangePlanCardProps = {
  plan: ExchangePlan;
  active: boolean;
  kcal: number | null;
  mealCount: number;
  macroBreakdown: ExchangeMacroBreakdown;
  patientParam: string;
  isEditing: boolean;
  editingTitle: string;
  formatDate: (value?: string | null) => string;
  onEditingTitleChange: (value: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
};

// Tarjeta de un plan por intercambios en el listado del paciente: título editable
// inline, fecha, tiempos de comida, barras de macros, calorías y acciones
// (abrir/editar/duplicar/eliminar). Extraído de PatientDiet.tsx.
export default function ExchangePlanCard({
  plan,
  active,
  kcal,
  mealCount,
  macroBreakdown,
  patientParam,
  isEditing,
  editingTitle,
  formatDate,
  onEditingTitleChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDuplicate,
  onRequestDelete,
}: ExchangePlanCardProps) {
  return (
    <article
      className={`rounded-[22px] border px-4 py-3.5 transition-all sm:px-5 ${active ? 'border-[#c9ccff] bg-white shadow-[0_16px_34px_-28px_rgba(59, 95, 235,0.46)]' : 'border-[#edf0ff] bg-white shadow-[0_12px_24px_-30px_rgba(15,23,42,0.28)] hover:border-[#dfe4ff]'}`}
    >
      <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center">
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] ${active ? 'bg-[#e9ebff]' : 'bg-[#f6f7fb]'}`}>
          <ArrowRightLeft className={`h-4 w-4 ${active ? 'text-[#6a61f5]' : 'text-[#c2c8dc]'}`} />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(event) => onEditingTitleChange(event.target.value)}
                onBlur={() => onSaveRename()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSaveRename();
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancelRename();
                  }
                }}
                autoFocus
                className="h-8 min-w-[180px] max-w-full rounded-[12px] border border-[#d7daf8] bg-[#f8f9ff] px-3 text-[13px] font-bold tracking-[-0.02em] text-slate-900 outline-none focus:border-[#6b61ff] focus:bg-white focus:ring-2 focus:ring-[#6b61ff]/15"
              />
            ) : (
              <button
                type="button"
                onClick={onStartRename}
                className="truncate rounded-[10px] px-1 py-0.5 text-left text-[14px] font-bold tracking-[-0.02em] text-slate-900 transition hover:bg-[#f5f7ff]"
                title="Renombrar plan"
              >
                {plan.title || DEFAULT_EXCHANGE_PLAN_TITLE}
              </button>
            )}
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${active ? 'bg-[#e7fff5] text-[#22b883]' : 'bg-[#f4f6fb] text-[#a7b0c4]'}`}>
              {active ? 'En uso activo' : 'Historial'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] font-medium text-slate-400">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 text-[#c2c9e1]" />
              <span>{formatDate(plan.date)}</span>
            </div>
            <span className="hidden text-[#d1d7eb] sm:inline">•</span>
            <span>{mealCount} {mealCount === 1 ? 'tiempo de comida' : 'tiempos de comida'}</span>
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <ExchangeMacroBar label="Carb" value={macroBreakdown.carbs} fillClassName={MACRO_STYLES.carbs.dot} />
            <ExchangeMacroBar label="Prot" value={macroBreakdown.protein} fillClassName={MACRO_STYLES.protein.dot} />
            <ExchangeMacroBar label="Gras" value={macroBreakdown.fat} fillClassName={MACRO_STYLES.fat.dot} />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:flex-shrink-0">
          <div className="flex min-w-[126px] items-center justify-center rounded-[18px] bg-[#f3f1ff] px-3.5 py-2.5 text-center">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8c91dc]">Calorías</p>
              <div className="mt-0.5 flex items-end justify-center gap-1">
                <span className="text-[22px] font-extrabold leading-none text-[#5d63ee]">{kcal ?? 0}</span>
                <span className="pb-0.5 text-[11px] font-semibold text-[#a0a7d9]">kcal</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Link
              to={createPageUrl(`ExchangeDietCreator?planId=${plan.id}&${patientParam}`)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[15px] bg-[linear-gradient(135deg,#6b61ff_0%,#574af4_100%)] px-4 text-[13px] font-semibold text-white shadow-[0_14px_24px_-16px_rgba(59, 95, 235,0.75)] transition-transform hover:-translate-y-[1px]"
            >
              Abrir
              <ChevronRight className="h-[14px] w-[14px]" />
            </Link>

            <Link
              to={createPageUrl(`ExchangeDietCreator?planId=${plan.id}&${patientParam}`)}
              className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-full text-[#bcc3d6] transition hover:bg-[#f5f7ff] hover:text-slate-600"
              aria-label="Editar plan por intercambios"
            >
              <Pencil className="h-[14px] w-[14px]" />
            </Link>

            <button
              onClick={onDuplicate}
              className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-full text-[#bcc3d6] transition hover:bg-[#f5f7ff] hover:text-slate-600"
              aria-label="Duplicar plan por intercambios"
            >
              <Copy className="h-[14px] w-[14px]" />
            </button>

            {!active ? (
              <button
                onClick={onRequestDelete}
                className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-full text-[#d5d9e8] transition hover:bg-red-50 hover:text-red-400"
                aria-label="Eliminar plan por intercambios"
              >
                <Trash2 className="h-[14px] w-[14px]" />
              </button>
            ) : (
              <span className="inline-flex h-8.5 w-8.5" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
