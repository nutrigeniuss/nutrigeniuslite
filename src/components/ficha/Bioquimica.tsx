import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Pencil, Plus, Trash2 } from 'lucide-react';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { toast } from '@/components/ui/use-toast';
import { relativeDayLabel } from '@/lib/relativeDay';
import LabEntryDetail, { type BiochemPatientContext } from './biochem/LabEntryDetail';
import NewLabModal from './biochem/NewLabModal';
import { countEntryFilled, countEntryOutOfRange, parseSexKey, type LabEntry } from './biochem/biochemConfig';
import { useLabReferenceRanges } from './biochem/useLabReferenceRanges';
import type { PatientUpdateFn } from '@/lib/patients/types';

type BiochemPatient = BiochemPatientContext & {
  biochemistry?: LabEntry[];
  full_name?: string | null;
};

type BioquimicaProps = {
  patient: BiochemPatient;
  onUpdate: PatientUpdateFn;
  registerAutosave?: (handler: (() => Promise<void>) | null) => void;
};

const pillActive = 'ng-pill ng-pill-active';
const pillIdle = 'ng-pill ng-pill-idle';

const newEntryId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const formatDateParts = (dateStr?: string | null): { day: string; monthYear: string; relative: string } => {
  if (!dateStr) return { day: '—', monthYear: '—', relative: '' };
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { day: '—', monthYear: dateStr, relative: '' };
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return {
    day: String(date.getDate()).padStart(2, '0'),
    monthYear: `${months[date.getMonth()]} ${date.getFullYear()}`,
    relative: relativeDayLabel(dateStr),
  };
};

export default function Bioquimica({ patient, onUpdate, registerAutosave }: BioquimicaProps) {
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<LabEntry | null>(null);
  const detailAutosaveRef = useRef<(() => Promise<void>) | null>(null);
  const { ranges: accountRanges, saveRange } = useLabReferenceRanges();
  const sex = useMemo(() => parseSexKey((patient.gender ?? patient.sex) as string | null), [patient.gender, patient.sex]);
  const entries = useMemo(() => patient.biochemistry || [], [patient.biochemistry]);

  const registerDetailAutosave = useCallback((handler: (() => Promise<void>) | null): void => {
    detailAutosaveRef.current = handler;
  }, []);

  const flushAutosave = useCallback(async (): Promise<void> => {
    if (!detailAutosaveRef.current) return;
    await detailAutosaveRef.current();
  }, []);

  useEffect(() => {
    if (!registerAutosave) return undefined;
    registerAutosave(flushAutosave);
    return () => registerAutosave(null);
  }, [flushAutosave, registerAutosave]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [entries],
  );

  const openEntry = (entry: LabEntry) => {
    const idx = entries.findIndex((e) => e.id === entry.id);
    setSelected(idx >= 0 ? idx : null);
  };

  if (selected !== null && entries[selected]) {
    return (
      <LabEntryDetail
        key={entries[selected].id || selected}
        entries={entries}
        entryIndex={selected}
        patient={patient}
        accountRanges={accountRanges}
        onSaveAccountRange={(key, range) => { void saveRange(key, range); }}
        onBack={() => setSelected(null)}
        onUpdate={onUpdate}
        registerAutosave={registerDetailAutosave}
      />
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <h3 className="ng-display text-lg font-semibold tracking-tight text-slate-900">Bioquímica</h3>
            <p className="ng-muted mt-0.5">{entries.length} toma{entries.length === 1 ? '' : 's'} registrada{entries.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className={pillActive}
        >
          <Plus className="h-3.5 w-3.5" /> Nueva toma
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-[#fafbfd] px-5 py-14 text-center">
          <FlaskConical className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Sin exámenes todavía</p>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="ng-btn-primary mt-4"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar toma
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((entry) => {
            const parts = formatDateParts(entry.date);
            const filled = countEntryFilled(entry);
            const out = countEntryOutOfRange(entry, sex, accountRanges);
            return (
              <div
                key={entry.id}
                className="flex items-center gap-2 rounded-[1.25rem] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:border-brand-500/25"
              >
                <button type="button" onClick={() => openEntry(entry)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="ng-metric text-[1.25rem]">{parts.day}</span>
                    <span className="ng-muted">{parts.monthYear}</span>
                    {parts.relative ? <span className={`${pillIdle} !py-0.5 text-[10px]`}>{parts.relative}</span> : null}
                  </div>
                  <p className="ng-muted mt-1.5">
                    {entry.lab || 'Laboratorio'} · {filled} valor{filled === 1 ? '' : 'es'}
                    {out > 0 ? ` · ${out} fuera de rango` : ''}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => openEntry(entry)}
                  className="rounded-full p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-500"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEntryToDelete(entry)}
                  className="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showNew ? (
        <NewLabModal
          onClose={() => setShowNew(false)}
          onSaved={async (date, lab) => {
            const newEntry: LabEntry = {
              id: newEntryId(),
              date,
              lab: lab || null,
              values: {},
              ranges: {},
              created_at: new Date().toISOString(),
            };
            const next = [newEntry, ...entries];
            const ok = await onUpdate({ biochemistry: next });
            setShowNew(false);
            if (ok) {
              setSelected(0);
              toast({ title: 'Toma creada' });
            }
          }}
        />
      ) : null}

      <ConfirmationDialog
        open={Boolean(entryToDelete)}
        onOpenChange={(open: boolean) => { if (!open) setEntryToDelete(null); }}
        title="Eliminar toma"
        description="Se quitará este examen de la ficha."
        confirmLabel="Eliminar"
        onConfirm={() => {
          void (async () => {
            if (!entryToDelete) return;
            const next = entries.filter((e) => e.id !== entryToDelete.id);
            await onUpdate({ biochemistry: next });
            setEntryToDelete(null);
          })();
        }}
      />
    </div>
  );
}
