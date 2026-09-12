import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { canUseCalculator, resolveLiteAccess } from '@/lib/access';
import { LITE_PAYMENT } from '@/config/litePayment';
import BackNav from '@/components/BackNav';
import PaymentTransferDetails from '@/components/PaymentTransferDetails';

export default function AwaitingAccessPage() {
  const { access, signOut, refreshProfile, profile } = useAuth();
  const disabled = access === 'disabled';
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (checking) return;
    setChecking(true);
    setFeedback(null);
    try {
      const next = await refreshProfile();
      if (!next) {
        setFeedback('No se pudo comprobar el acceso. Revisa tu conexión e intenta de nuevo.');
        return;
      }
      if (canUseCalculator(resolveLiteAccess(next))) {
        setFeedback('Acceso activado. Entrando…');
        // Protected re-renderiza a la calculadora con el profile nuevo.
        return;
      }
      setFeedback('Aún sin acceso. Cuando te activemos el plan en Maestro, pulsa de nuevo.');
    } catch {
      setFeedback('Error al actualizar. Intenta de nuevo en unos segundos.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <div className="rounded-[1.75rem] border border-white/80 bg-white p-7 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-500">NutriGenius Lite</p>
        <h1 className="ng-display mt-2 text-2xl font-semibold text-slate-950">
          {disabled ? 'Activa tu cuenta' : 'Activa tu acceso'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Hola{profile?.full_name ? `, ${profile.full_name}` : ''}. Transfiere tu plan y avísanos por WhatsApp para activar el acceso.
        </p>

        <PaymentTransferDetails className="mt-5" />

        <div className="mt-6 flex flex-wrap gap-2">
          <a
            href={`https://wa.me/${LITE_PAYMENT.whatsappNotify}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-coral-500 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95"
          >
            Avisar por WhatsApp
          </a>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={checking}
            aria-busy={checking}
            className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition active:scale-95 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {checking ? 'Comprobando…' : 'Actualizar sesión'}
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-500 ring-1 ring-slate-200 transition active:scale-95 hover:bg-slate-50 hover:text-slate-800"
          >
            Salir
          </button>
        </div>

        {feedback ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium leading-relaxed text-slate-600 ring-1 ring-slate-200/80"
          >
            {feedback}
          </p>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Después de que te activemos el acceso, pulsa{' '}
            <span className="font-semibold text-slate-500">Actualizar sesión</span> para entrar sin volver a iniciar sesión.
          </p>
        )}

        <BackNav to="/" label="Volver al inicio" className="mt-6" />
      </div>
    </div>
  );
}
