import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { LITE_PAYMENT } from '@/config/litePayment';
import PaymentTransferDetails from '@/components/PaymentTransferDetails';

export default function AwaitingAccessPage() {
  const { access, signOut, refreshProfile, profile } = useAuth();
  const disabled = access === 'disabled';

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
            className="rounded-full bg-coral-500 px-4 py-2.5 text-sm font-bold text-white"
          >
            Avisar por WhatsApp
          </a>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200"
          >
            Actualizar sesión
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-slate-400"
          >
            Salir
          </button>
        </div>

        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-brand-500">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
