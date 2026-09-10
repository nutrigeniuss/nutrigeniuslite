import { useFicha, type DietMode } from '@/lib/FichaContext';
import PatientDiet from './PatientDiet';

/** Dieta SaaS embebida: alimentos | intercambios (+ artificial en sub-tab propia). */
export default function DietPanel({ mode }: { mode: DietMode }) {
  const { patient, updatePatient } = useFicha();

  if (mode === 'artificial') {
    return (
      <div className="p-5">
        <p className="text-sm font-semibold text-slate-800">Dieta artificial</p>
        <p className="mt-2 text-sm text-slate-500">Próximamente.</p>
      </div>
    );
  }

  return (
    <PatientDiet
      patient={patient}
      tab={mode}
      onUpdate={updatePatient}
    />
  );
}
