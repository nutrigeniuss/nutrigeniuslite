import { Link } from 'react-router-dom';
import { Eraser, LogOut, Shield } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { FichaProvider, useFicha } from '@/lib/FichaContext';
import BrandLogo from '@/components/BrandLogo';
import ConsultDetail from '@/components/ficha/ConsultDetail';

function FichaShell() {
  const { profile, signOut, admin } = useAuth();
  const { patient, updatePatient, resetFicha } = useFicha();

  const handleNuevaFicha = () => {
    if (!window.confirm('¿Borrar toda la ficha actual? Se limpia paciente, mediciones, bioquímica y dieta.')) {
      return;
    }
    resetFicha();
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <BrandLogo alt="NutriGenius Lite" showLite />
          <p className="ng-muted mt-1.5 pl-0.5">
            {profile?.full_name || profile?.email || 'Calculadora'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={handleNuevaFicha} className="ng-btn-ghost">
            <Eraser className="h-3.5 w-3.5" /> Nueva ficha
          </button>
          <Link to="/MyFoods" className="ng-btn-ghost">
            Alimentos
          </Link>
          {admin === true ? (
            <Link to="/admin" className="ng-pill ng-pill-active bg-slate-900 shadow-none hover:bg-slate-800">
              <Shield className="h-3.5 w-3.5" /> Maestro
            </Link>
          ) : null}
          <button type="button" onClick={() => void signOut()} className="ng-btn-ghost">
            <LogOut className="h-3.5 w-3.5" /> Salir
          </button>
        </div>
      </header>

      <ConsultDetail
        embedded
        patient={patient}
        consultIndex={0}
        onBack={() => undefined}
        onUpdate={updatePatient}
        onPatientUpdate={updatePatient}
      />
    </div>
  );
}

export default function CalculatorPage() {
  return (
    <FichaProvider>
      <FichaShell />
    </FichaProvider>
  );
}
