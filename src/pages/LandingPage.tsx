import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';
import { LITE_PAYMENT } from '@/config/litePayment';

const waHref = `https://wa.me/${LITE_PAYMENT.whatsappNotify}`;

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <BrandLogo className="min-w-0" alt="NutriGenius Lite" size="lg" showLite />
        <Link
          to="/login"
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          Entrar
        </Link>
      </header>

      <main className="mt-16 flex flex-1 flex-col justify-center sm:mt-24">
        <h1 className="ng-display max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl">
          La calculadora clínica, limpia y rápida.
        </h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-500 sm:text-lg">
          Medidas, resultados y calorías en un solo lugar, pensado para la consulta.
        </p>

        <p className="mt-6 text-sm font-medium text-slate-600">
          Planes desde {LITE_PAYMENT.priceLabel.replace(/^desde\s+/i, '')}
          <span className="font-normal text-slate-400"> · 1, 2 o 3 meses</span>
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/login"
            className="rounded-full bg-coral-500 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,92,87,0.28)] transition hover:bg-coral-600"
          >
            Empezar
          </Link>
          <a
            href={waHref}
            className="rounded-full px-5 py-3 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp {LITE_PAYMENT.contactPhoneDisplay}
          </a>
        </div>
      </main>
    </div>
  );
}
