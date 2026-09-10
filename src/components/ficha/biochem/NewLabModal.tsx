import { useState } from 'react';
import { X } from 'lucide-react';

type NewLabModalProps = {
  onClose: () => void;
  onSaved: (date: string, lab: string) => void;
};

export default function NewLabModal({ onClose, onSaved }: NewLabModalProps) {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(localDate);
  const [lab, setLab] = useState('');

  const inputClass = 'ng-input';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="ng-card relative w-full max-w-sm p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="ng-label !normal-case !tracking-[0.18em] text-brand-500">Laboratorio</p>
            <h2 className="ng-section-title mt-1 text-base">Nueva toma</h2>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 transition-colors hover:bg-[#e1e5ff]">
            <X className="h-4 w-4 text-brand-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="ng-label mb-2">Fecha del examen</label>
            <input type="date" className={inputClass} value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div>
            <label className="ng-label mb-2">Laboratorio (opcional)</label>
            <input
              type="text"
              className={inputClass}
              value={lab}
              onChange={(event) => setLab(event.target.value)}
              placeholder="Ej. Laboratorio Clínico"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button onClick={onClose} className="ng-btn-ghost flex-1 py-3">
            Cancelar
          </button>
          <button
            onClick={() => onSaved(date, lab.trim())}
            disabled={!date}
            className="ng-btn-primary flex-1 py-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
