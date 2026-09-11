import { Link } from 'react-router-dom';
import { Activity, BookOpen, Calculator, Flame, RefreshCw, ShieldCheck } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { LITE_PAYMENT } from '@/config/litePayment';

const FEATURES = [
  {
    icon: Calculator,
    title: 'Antropometría',
    text: 'IMC, pliegues, composición y riesgos en un flujo claro.',
  },
  {
    icon: Flame,
    title: 'Calorías',
    text: 'TMB, NAF y macros listos para orientar la consulta.',
  },
  {
    icon: Activity,
    title: 'Resultados',
    text: 'Diagnóstico escaneable y listo para la consulta.',
  },
  {
    icon: RefreshCw,
    title: 'Actualizaciones gratis',
    text: 'Mejoras y nuevas funciones incluidas en tu plan, sin costo extra.',
  },
  {
    icon: BookOpen,
    title: 'Material educativo gratis',
    text: 'Recursos editables e imprimibles para apoyar la educación al paciente.',
  },
];

const waHref = `https://wa.me/${LITE_PAYMENT.whatsappNotify}`;

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <BrandLogo className="min-w-0" alt="NutriGenius Lite" size="lg" showLite />
        <Link
          to="/login"
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(59,95,235,0.25)] transition hover:bg-brand-600"
        >
          Entrar
        </Link>
      </header>

      <main className="mt-14 flex flex-1 flex-col justify-center gap-12 lg:mt-20 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
        <section>
          <h1 className="ng-display text-4xl font-semibold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl">
            La calculadora clínica, limpia y rápida.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Medidas, resultados y calorías en un solo lugar, pensado para la consulta.
            Incluye actualizaciones gratuitas y material educativo editable e imprimible.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5">
            {LITE_PAYMENT.plans.map((plan) => (
              <div
                key={plan.months}
                className="min-w-[7.5rem] rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 px-4 py-3 text-white shadow-[0_12px_28px_rgba(59,95,235,0.28)]"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">{plan.label}</p>
                <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight">{plan.priceLabel}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="rounded-full bg-coral-500 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,92,87,0.28)] transition hover:bg-coral-600"
            >
              Empezar
            </Link>
            <a
              href={waHref}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/80 transition hover:text-slate-950"
              target="_blank"
              rel="noreferrer"
            >
              Pedir acceso · {LITE_PAYMENT.priceLabel}
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            WhatsApp:{' '}
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand-500 hover:text-brand-600"
            >
              {LITE_PAYMENT.contactPhoneDisplay}
            </a>
          </p>

          <div className="mt-6 max-w-xl space-y-2 rounded-[1.25rem] border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-600 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Datos de pago</p>
            <p>
              <span className="font-semibold text-slate-800">Yape:</span> {LITE_PAYMENT.yapePhone}
            </p>
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
        </section>

        <section className="space-y-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-[1.5rem] border border-white/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">{text}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-medium text-slate-200">
            <ShieldCheck className="h-4 w-4 text-energy-600" />
            Solo acceso tras el pago
          </div>
        </section>
      </main>
    </div>
  );
}
