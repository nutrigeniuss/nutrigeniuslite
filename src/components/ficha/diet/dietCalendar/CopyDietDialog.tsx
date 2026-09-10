import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { calcPlanTotals, mealNames } from '@/lib/diet/weekSummary';
import { normalizeSearchText } from '@/lib/searchText';
import { formatDayTitle, formatDayWithMonth, formatMonthTitle, parseLocalDate } from '@/lib/weekRange';
import type { CopyCandidate } from './DayPanel';
import { getCurrentLocale } from '@/lib/formatLocale';

type CopyDietDialogProps = {
  open: boolean;
  /** Día al que se va a copiar. */
  targetDate: string | null;
  candidates: CopyCandidate[];
  onCopy: (planId: string) => void;
  onClose: () => void;
};

/**
 * Todas las dietas de las que se puede copiar, agrupadas por mes y con
 * buscador.
 *
 * Antes esta lista ocupaba el panel entero y tapaba el resto de la pantalla, y
 * cada fila solo decía la fecha y el título. Aquí cada fila dice además qué
 * comidas trae, para elegir sin abrir nada.
 */
export default function CopyDietDialog({ open, targetDate, candidates, onCopy, onClose }: CopyDietDialogProps) {
  const [query, setQuery] = useState('');
  const [soloEsteMes, setSoloEsteMes] = useState(false);

  // Escape cierra, como en cualquier ventana modal. Sin esto la única salida
  // era la X o el clic fuera, y con el teclado no había ninguna.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Al cerrarse se olvidan los filtros: si no, al volver a abrirla para otro
  // día seguiría la búsqueda anterior y parecería que no hay dietas.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setSoloEsteMes(false);
    }
  }, [open]);

  const mesObjetivo = useMemo(() => {
    const date = parseLocalDate(targetDate);
    return date ? `${date.getFullYear()}-${date.getMonth()}` : null;
  }, [targetDate]);

  const filtradas = useMemo(() => {
    const termino = normalizeSearchText(query);

    return candidates.filter((candidate) => {
      if (soloEsteMes && mesObjetivo) {
        const date = parseLocalDate(candidate.date);
        if (!date || `${date.getFullYear()}-${date.getMonth()}` !== mesObjetivo) return false;
      }
      if (!termino) return true;

      // Se busca por fecha escrita («14 de agosto»), por título y por nombre de
      // comida: son las tres formas en que alguien recuerda una dieta.
      const texto = [
        formatDayWithMonth(candidate.date),
        candidate.date,
        candidate.plan.title || '',
        mealNames(candidate.plan).join(' '),
      ].join(' ');

      return normalizeSearchText(texto).includes(termino);
    });
  }, [candidates, query, soloEsteMes, mesObjetivo]);

  // Agrupadas por mes, conservando el orden de entrada (más recientes primero).
  const grupos = useMemo(() => {
    const mapa = new Map<string, CopyCandidate[]>();
    for (const candidate of filtradas) {
      const titulo = formatMonthTitle(candidate.date) || 'Sin fecha';
      const lista = mapa.get(titulo);
      if (lista) lista.push(candidate);
      else mapa.set(titulo, [candidate]);
    }
    return [...mapa.entries()];
  }, [filtradas]);

  const cantidadEsteMes = useMemo(() => {
    if (!mesObjetivo) return 0;
    return candidates.filter((candidate) => {
      const date = parseLocalDate(candidate.date);
      return date ? `${date.getFullYear()}-${date.getMonth()}` === mesObjetivo : false;
    }).length;
  }, [candidates, mesObjetivo]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Copiar una dieta de otro día"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#e6eaf4] px-4 py-4">
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight tracking-tight text-slate-900">
              Copiar una dieta al {formatDayTitle(targetDate).toLowerCase()}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">Hoy este día está sin dieta</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[#e6eaf4] text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#e6eaf4] px-4 py-3">
          <div className="relative min-w-[170px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar una dieta"
              placeholder="Buscar por fecha, nombre o comida…"
              className="w-full rounded-[9px] border border-[#e6eaf4] py-2 pl-9 pr-3 text-[12.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
          <button
            type="button"
            onClick={() => setSoloEsteMes(false)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              soloEsteMes ? 'border-[#e6eaf4] text-slate-600 hover:bg-slate-50' : 'border-brand-500 bg-brand-50 text-brand-500'
            }`}
          >
            Todas <span className="opacity-70">{candidates.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setSoloEsteMes(true)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              soloEsteMes ? 'border-brand-500 bg-brand-50 text-brand-500' : 'border-[#e6eaf4] text-slate-600 hover:bg-slate-50'
            }`}
          >
            Este mes <span className="opacity-70">{cantidadEsteMes}</span>
          </button>
        </div>

        <div className="max-h-[330px] overflow-y-auto px-4 pb-3.5 pt-1.5">
          {grupos.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {candidates.length === 0
                ? 'Este paciente todavía no tiene ninguna otra dieta que copiar.'
                : 'Ninguna dieta coincide con la búsqueda.'}
            </p>
          ) : (
            grupos.map(([mes, lista]) => (
              <div key={mes}>
                <p className="sticky top-0 bg-white pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  {mes}
                </p>
                {lista.map((candidate) => {
                  const comidas = mealNames(candidate.plan);
                  return (
                    <div
                      key={candidate.planId}
                      className="mb-1.5 flex items-center gap-3 rounded-[11px] border border-[#e6eaf4] px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold leading-tight text-slate-800">
                          {formatDayWithMonth(candidate.date)}
                        </span>
                        <span className="block truncate text-[11.5px] tabular-nums text-slate-400">
                          {calcPlanTotals(candidate.plan).cal.toLocaleString(getCurrentLocale())} kcal
                          {comidas.length > 0 ? ` · ${comidas.join(', ')}` : ''}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onCopy(candidate.planId)}
                        className="flex-shrink-0 rounded-lg border border-brand-500/25 px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-500 transition-colors hover:bg-brand-50"
                      >
                        Copiar
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <p className="border-t border-[#e6eaf4] px-4 py-3 text-[11.5px] text-slate-400">
          Se copian las comidas y sus cantidades. La dieta original no se toca.
        </p>
      </div>
    </div>
  );
}
