import { useState } from 'react';
import { Calendar, ChevronDown, Printer, Save, Settings, Users } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { track } from '@/lib/analytics';

type DietHeaderProps = {
  title: string;
  setTitle: (value: string) => void;
  patientName?: string;
  date: string;
  setDate: (value: string) => void;
  targetCalories: number;
  setTargetCalories: (value: number) => void;
  onSave: () => void;
  onPrint: () => void;
};

export default function DietHeader({ title, setTitle, patientName, date, setDate, targetCalories, setTargetCalories, onSave, onPrint }: DietHeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);

  return (
    <header className="bg-white border-b border-slate-100 px-6 py-3 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 mr-2">
        <div className="w-8 h-8 rounded-xl bg-white ring-1 ring-slate-100 flex items-center justify-center shadow-sm overflow-hidden">
          <BrandLogo className="h-7 w-7 object-contain" alt="Logo de NutriGenius" />
        </div>
        <span className="font-bold text-slate-800 text-sm hidden sm:block">NutriGenius</span>
      </div>

      <div className="h-5 w-px bg-slate-200" />

      <div className="flex-shrink-0">
        {editingTitle ? (
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') setEditingTitle(false);
            }}
            className="text-sm font-semibold text-slate-700 border-b-2 border-teal-500 outline-none bg-transparent"
          />
        ) : (
          <button onClick={() => setEditingTitle(true)} className="text-sm font-semibold text-slate-700 hover:text-teal-600 transition-colors">
            {title || 'Plan Nutricional sin título'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-medium">{patientName || 'Seleccionar paciente'}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="bg-transparent border-none outline-none text-xs text-slate-600 cursor-pointer" />
      </div>

      <div className="flex items-center gap-1.5 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-100">
        <span className="text-xs text-teal-600 font-medium">Objetivo:</span>
        <input type="number" value={targetCalories} onChange={(event) => setTargetCalories(Number(event.target.value))} className="w-14 bg-transparent border-none outline-none text-xs font-bold text-teal-700 text-center" />
        <span className="text-xs text-teal-500">kcal</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button onClick={() => { track('diet_printed'); onPrint(); }} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-teal-600 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors border border-slate-200">
          <Printer className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Imprimir</span>
        </button>

        <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
          <Settings className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Ajustes</span>
        </button>

        <button onClick={onSave} className="flex items-center gap-1.5 text-xs font-medium bg-teal-500 hover:bg-teal-600 text-white px-4 py-1.5 rounded-lg shadow-sm transition-all border border-teal-600">
          <Save className="w-3.5 h-3.5" />
          <span>Guardar</span>
        </button>
      </div>
    </header>
  );
}