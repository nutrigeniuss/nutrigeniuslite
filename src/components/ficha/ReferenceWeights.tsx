import { useEffect, useRef, useState } from 'react';
import { Baby, Pencil, Scale } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PatientUpdateFn } from '@/lib/patients/types';
import { getCurrentLocale } from '@/lib/formatLocale';

export type ReferenceWeight = {
  kg?: number | null;
  /** Fecha en que se registró el dato (auditoría). */
  date?: string | null;
  /** Fecha aproximada en que el paciente TENÍA ese peso. Sin ella no se puede
   *  clasificar la severidad de la pérdida (Blackburn depende del tiempo). */
  since?: string | null;
  note?: string | null;
};

export type ReferenceWeightsRecord = {
  habitual?: ReferenceWeight | null;
};
// El peso PREGESTACIONAL no vive aquí: va dentro de cada gestación
// (patients.pregnancies), porque una paciente con dos embarazos tuvo un peso
// previo distinto en cada uno y un campo único solo podría guardar el último.
// Esta tarjeta lo muestra de solo lectura cuando hay gestación activa.

type SaveHandler = PatientUpdateFn;

const today = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const formatShortDate = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getCurrentLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

/** Aplica un cambio parcial al peso habitual conservando el resto del registro. */
export const buildHabitualUpdate = (
  current: ReferenceWeightsRecord | null | undefined,
  patch: Partial<ReferenceWeight> | null,
): Record<string, unknown> => ({
  reference_weights: {
    ...(current || {}),
    habitual: patch === null ? null : { ...(current?.habitual || {}), ...patch, date: today() },
  },
});

/**
 * Tarjeta de captura de los pesos de referencia del paciente. Vive en Datos
 * generales porque es un dato de anamnesis —se pregunta en la primera
 * entrevista y no se vuelve a tocar—, no una medida que se repite por consulta.
 *
 * Alimenta el % de cambio de peso (Resultados) y el Índice de Riesgo Nutricional
 * (Bioquímica), que son indicadores del adulto NO gestante. Durante el embarazo
 * el comparador es el peso pregestacional, que vive en la gestación: la tarjeta
 * lo dice y lo muestra de solo lectura en lugar de esconderse, porque el peso
 * habitual sigue siendo cierto y vuelve a usarse cuando la gestación termina.
 */
export default function ReferenceWeightsCard({
  value,
  onUpdate,
  pregnancyKg,
}: {
  value?: ReferenceWeightsRecord | null;
  onUpdate: SaveHandler;
  /** Peso pregestacional de la gestación activa, solo para mostrarlo aquí. */
  pregnancyKg?: number | null;
}) {
  const habitual = value?.habitual ?? null;
  const [kg, setKg] = useState(habitual?.kg != null ? String(habitual.kg) : '');
  const [since, setSince] = useState(habitual?.since ?? '');
  const [note, setNote] = useState(habitual?.note ?? '');
  const hydratedRef = useRef(`${habitual?.kg ?? ''}|${habitual?.since ?? ''}|${habitual?.note ?? ''}`);

  // Resincroniza si el paciente cambia por fuera (p. ej. se editó desde la
  // tarjeta del NRI en Bioquímica), sin pisar lo que se está tipeando.
  useEffect(() => {
    const incoming = `${habitual?.kg ?? ''}|${habitual?.since ?? ''}|${habitual?.note ?? ''}`;
    if (incoming === hydratedRef.current) return;
    hydratedRef.current = incoming;
    setKg(habitual?.kg != null ? String(habitual.kg) : '');
    setSince(habitual?.since ?? '');
    setNote(habitual?.note ?? '');
  }, [habitual?.kg, habitual?.since, habitual?.note]);

  // Autoguardado con el mismo ritmo que el resto del formulario de la pestaña.
  useEffect(() => {
    const current = `${kg}|${since}|${note}`;
    if (current === hydratedRef.current) return undefined;

    const timer = window.setTimeout(() => {
      void (async () => {
        const parsed = Number.parseFloat(kg);
        const update = Number.isFinite(parsed)
          ? buildHabitualUpdate(value, { kg: parsed, since: since || null, note: note.trim() || null })
          // Campo vaciado: se borra el registro completo.
          : habitual?.kg != null ? buildHabitualUpdate(value, null) : null;

        if (!update) return;

        // `hydratedRef` se marca DESPUÉS y solo si se guardó. Marcarlo antes
        // daba el valor por sincronizado aunque la escritura fallara, y el peso
        // habitual no se volvía a intentar nunca.
        if (await onUpdate(update)) hydratedRef.current = current;
      })();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [kg, since, note, habitual?.kg, onUpdate, value]);

  // Mismos estilos Fitia que Datos generales.
  const inputClassName = 'w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-800 transition placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';
  const labelClassName = 'mb-1.5 block text-[12px] font-semibold text-slate-500';

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-3.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <Scale className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <p className="text-sm font-bold text-slate-900">Pesos de referencia</p>
      </div>

      <div className="px-5 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelClassName} title="Peso estable antes de la pérdida o ganancia actual. Alimenta el % de cambio de peso (Resultados) y el NRI (Bioquímica).">
              Peso habitual
            </label>
            <div className="relative">
              <Scale className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                className={`${inputClassName} pl-11`}
                value={kg}
                onChange={(event) => setKg(event.target.value)}
                placeholder="kg"
              />
            </div>
          </div>

          <div>
            <label className={labelClassName}>¿Cuándo tenía ese peso?</label>
            <input
              type="date"
              className={inputClassName}
              value={since}
              onChange={(event) => setSince(event.target.value)}
            />
            <p className="mt-1 text-[10.5px] text-slate-400">Aproximada. Sin ella no se clasifica la severidad.</p>
          </div>

          <div className="md:col-span-2">
            <label className={labelClassName}>Nota (opcional)</label>
            <input
              type="text"
              className={inputClassName}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. peso previo a la cirugía"
            />
          </div>
        </div>

        {pregnancyKg != null ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-coral-50 px-3.5 py-2.5">
            <Baby className="mt-[1px] h-3.5 w-3.5 flex-shrink-0 text-coral-500" />
            <p className="text-[11.5px] leading-snug text-slate-600">
              En gestación la referencia es el <strong className="font-semibold">peso pregestacional: {pregnancyKg} kg</strong>.
              <span className="text-slate-400"> Se registra en Condición de salud → Gestación.</span>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Versión compacta para la cabecera de Mediciones: muestra el peso habitual y
 * deja corregirlo sin ir a Datos generales, que es donde vive el formulario.
 */
export function ReferenceWeightsChip({
  value,
  onUpdate,
  suggestedKg,
  suggestedDate,
}: {
  value?: ReferenceWeightsRecord | null;
  onUpdate: SaveHandler;
  /** Peso de la medición más antigua, ofrecido como sugerencia de un clic. */
  suggestedKg?: number | null;
  suggestedDate?: string | null;
}) {
  const habitual = value?.habitual ?? null;
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState(habitual?.kg != null ? String(habitual.kg) : '');

  useEffect(() => {
    setKg(habitual?.kg != null ? String(habitual.kg) : '');
  }, [habitual?.kg]);

  const save = async (): Promise<void> => {
    const parsed = Number.parseFloat(kg);
    const saved = await onUpdate(Number.isFinite(parsed) ? buildHabitualUpdate(value, { kg: parsed }) : buildHabitualUpdate(value, null));
    // El popover se queda abierto si falló, con el valor escrito a la vista.
    if (saved) setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Chip con borde y fondo: sin ellos el dato se leía como pie de página
          y pasaba desapercibido. Vacío va punteado, para que se vea que falta
          algo por llenar sin gritar como una alerta. */}
      <PopoverTrigger asChild>
        <button
          type="button"
          title={habitual?.kg != null ? 'Peso habitual del paciente' : 'Registrar el peso habitual del paciente'}
          className={`group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition ${
            habitual?.kg != null
              ? 'border-[#dfe4f5] bg-[#f4f6ff] text-slate-500 hover:border-brand-500/40 hover:bg-brand-50'
              : 'border-dashed border-[#c9d2ea] bg-white text-slate-500 hover:border-brand-500/50 hover:text-brand-500'
          }`}
        >
          <Scale className="h-3.5 w-3.5 text-brand-500" strokeWidth={1.8} />
          {habitual?.kg != null ? (
            <span>Peso habitual <strong className="font-bold text-slate-900">{habitual.kg} kg</strong></span>
          ) : (
            <span className="font-medium">Añadir peso habitual</span>
          )}
          <Pencil className="h-2.5 w-2.5 text-slate-300 transition group-hover:text-brand-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="space-y-2.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Peso habitual</p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
              El formulario completo, con la fecha y la nota, está en Datos generales.
            </p>
          </div>

          <div className="flex items-center overflow-hidden rounded-[10px] border border-slate-200 bg-white">
            <input
              autoFocus
              type="number"
              step="0.1"
              value={kg}
              onChange={(event) => setKg(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void save();
                }
              }}
              className="w-full bg-transparent px-2.5 py-1.5 text-right text-sm font-bold text-slate-700 outline-none"
            />
            <span className="pr-2.5 text-[11px] font-semibold text-slate-400">kg</span>
          </div>

          {/* Sugerencia, nunca automática: el primer peso medido suele venir ya
              con la pérdida encima, y usarlo como habitual la ocultaría. */}
          {suggestedKg != null && habitual?.kg == null ? (
            <button
              type="button"
              onClick={() => setKg(String(suggestedKg))}
              className="w-full rounded-[10px] border border-dashed border-slate-200 px-2.5 py-1.5 text-left text-[11px] text-slate-500 transition hover:border-brand-500/40 hover:text-brand-500"
            >
              Usar el de la primera medición: <strong>{suggestedKg} kg</strong>
              {formatShortDate(suggestedDate) ? ` (${formatShortDate(suggestedDate)})` : ''}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void save()}
            className="w-full rounded-[10px] bg-brand-500 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-600"
          >
            Guardar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
