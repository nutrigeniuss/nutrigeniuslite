import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { LITE_PAYMENT } from '@/config/litePayment';

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
          {disabled
            ? `Hola${profile?.full_name ? `, ${profile.full_name}` : ''}. Activa tu cuenta con un plan desde S/ 30 (Yape ${LITE_PAYMENT.yapePhone}) a nombre de ${LITE_PAYMENT.holderName}.`
            : `Hola${profile?.full_name ? `, ${profile.full_name}` : ''}. Elige un plan desde S/ 30 por Yape (${LITE_PAYMENT.yapePhone}) a nombre de ${LITE_PAYMENT.holderName}.`}
        </p>

        <div className="mt-5 space-y-2 rounded-2xl bg-[#f7f8fc] p-4 text-sm text-slate-600">
          <p><span className="font-semibold text-slate-800">Yape:</span> {LITE_PAYMENT.yapePhone}</p>
          <p>
            <span className="font-semibold text-slate-800">BCP Soles:</span>{' '}
            <span className="font-mono tabular-nums">{LITE_PAYMENT.bcpAccount}</span>
          </p>
          <p>
            <span className="font-semibold text-slate-800">CCI:</span>{' '}
            <span className="font-mono tabular-nums text-[13px]">{LITE_PAYMENT.cci}</span>
          </p>
          <p className="text-xs text-slate-400">A nombre de {LITE_PAYMENT.holderName}</p>
        </div>

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
