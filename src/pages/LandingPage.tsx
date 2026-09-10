import { Link } from 'react-router-dom';
import { Activity, Calculator, Flame, ShieldCheck } from 'lucide-react';
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
    text: 'Diagnóstico escaneable, estilo Fitia, sin ruido.',
  },
];

export default function LandingPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-coral-500 text-lg font-bold text-white shadow-[0_10px_24px_rgba(255,92,87,0.35)]">
            N
          </span>
          <div>
            <p className="ng-display text-xl font-semibold tracking-tight text-slate-950">NutriGenius Lite</p>
            <p className="text-xs font-medium text-slate-400">Calculadora clínica</p>
          </div>
        </div>
        <Link
          to="/login"
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(59,95,235,0.25)] transition hover:bg-brand-600"
        >
          Entrar
        </Link>
      </header>

      <main className="mt-14 flex flex-1 flex-col justify-center gap-12 lg:mt-20 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">NutriGenius Lite</p>
          <h1 className="ng-display mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl">
            La calculadora clínica, limpia y rápida.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Medidas, resultados y calorías en un solo lugar. Sin gestión de pacientes ni recetas: solo el cálculo que usas en consulta.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="rounded-full bg-coral-500 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,92,87,0.28)] transition hover:bg-coral-600"
            >
              Empezar
            </Link>
            <a
              href={`https://wa.me/${LITE_PAYMENT.whatsappNotify}`}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200/80 transition hover:text-slate-950"
              target="_blank"
              rel="noreferrer"
            >
              Pedir acceso · {LITE_PAYMENT.priceLabel}
            </a>
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
            Acceso activado por el módulo maestro tras el pago.
          </div>
        </section>
      </main>
    </div>
  );
}
