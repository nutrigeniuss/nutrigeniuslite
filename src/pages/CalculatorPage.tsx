import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eraser, LogOut, Menu, Shield, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useFicha } from '@/lib/FichaContext';
import BrandLogo from '@/components/BrandLogo';
import ConsultDetail from '@/components/ficha/ConsultDetail';
import InstallAppButton from '@/components/InstallAppButton';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';

export default function CalculatorPage() {
  const { profile, signOut, admin } = useAuth();
  const { patient, updatePatient, resetFicha, fichaRevision } = useFicha();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmNuevaFicha, setConfirmNuevaFicha] = useState(false);

  const requestNuevaFicha = () => {
    setConfirmNuevaFicha(true);
  };

  const confirmNuevaFichaAction = () => {
    resetFicha();
    setMenuOpen(false);
    setConfirmNuevaFicha(false);
  };

  const handleSalir = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setMenuOpen(false);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:py-8 lg:px-8">
      <header className="sticky top-0 z-30 -mx-3 mb-3 flex items-center justify-between gap-2 border-b border-slate-200/80 bg-[#f4f6fb]/95 px-3 py-2.5 backdrop-blur-md sm:static sm:mx-0 sm:mb-7 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="min-w-0">
          <BrandLogo alt="NutriGenius Lite" showLite />
          <p className="ng-muted mt-1.5 hidden pl-0.5 sm:block">
            Calculadora de consulta · {profile?.full_name || profile?.email || 'sesión local'}
          </p>
        </div>

        {/* Desktop actions */}
        <div className="hidden flex-wrap items-center justify-end gap-2.5 sm:flex">
          <InstallAppButton />
          <button type="button" onClick={requestNuevaFicha} className="ng-btn-ghost">
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
          <button
            type="button"
            onClick={() => void handleSalir()}
            disabled={signingOut}
            aria-busy={signingOut}
            className="ng-btn-ghost"
          >
            <LogOut className={`h-3.5 w-3.5 ${signingOut ? 'animate-pulse' : ''}`} />
            {signingOut ? 'Saliendo…' : 'Salir'}
          </button>
        </div>

        {/* Mobile: install + menu */}
        <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
          <InstallAppButton compact />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="ng-btn-ghost !min-h-11 !w-11 !px-0"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="mb-3 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:hidden">
          <button
            type="button"
            onClick={requestNuevaFicha}
            className="flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Eraser className="h-4 w-4 text-slate-400" /> Nueva ficha
          </button>
          <Link
            to="/MyFoods"
            onClick={() => setMenuOpen(false)}
            className="flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Alimentos
          </Link>
          {admin === true ? (
            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Shield className="h-4 w-4 text-slate-400" /> Maestro
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSalir()}
            disabled={signingOut}
            className="flex min-h-11 w-full touch-manipulation items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            {signingOut ? 'Saliendo…' : 'Salir'}
          </button>
        </div>
      ) : null}

      <ConsultDetail
        key={fichaRevision}
        embedded
        patient={patient}
        consultIndex={0}
        onBack={() => undefined}
        onUpdate={updatePatient}
        onPatientUpdate={updatePatient}
      />

      <ConfirmationDialog
        open={confirmNuevaFicha}
        onOpenChange={setConfirmNuevaFicha}
        title="¿Empezar una ficha nueva?"
        description="Se borrarán los datos del paciente actual en esta pantalla: medidas, bioquímica y dietas de la sesión. Esta acción no se puede deshacer."
        confirmLabel="Sí, nueva ficha"
        cancelLabel="Cancelar"
        onConfirm={confirmNuevaFichaAction}
        destructive
      />
    </div>
  );
}
