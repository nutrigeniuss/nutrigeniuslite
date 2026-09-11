import { Link } from 'react-router-dom';
import { Activity, BookOpen, Calculator, Flame, RefreshCw } from 'lucide-react';
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
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          Entrar
        </Link>
      </header>

      <main className="mt-14 flex flex-1 flex-col gap-16 sm:mt-20 lg:gap-20">
        <section className="max-w-2xl">
          <h1 className="ng-display text-4xl font-semibold leading-[1.1] tracking-tight text-slate-950 sm:text-5xl">
            La calculadora clínica, limpia y rápida.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Medidas, resultados y calorías en un solo lugar, pensado para la consulta.
          </p>
          <p className="mt-5 text-sm font-medium text-slate-600">
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
              className="rounded-full bg-[#25D366]/15 px-5 py-3 text-sm font-bold text-[#128C7E] ring-1 ring-[#25D366]/35 transition hover:bg-[#25D366]/25"
              target="_blank"
              rel="noreferrer"
            >
              Contactar
            </a>
          </div>
        </section>

        <section>
          <h2 className="ng-display text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            Todo lo que usas en consulta
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-base">
            Funciones pensadas para nutricionistas: rápidas, claras y listas para el día a día.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-[1.5rem] border border-brand-500/10 bg-gradient-to-br from-white to-brand-50/40 p-5 shadow-[0_12px_40px_rgba(59,95,235,0.08)]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-[0_8px_18px_rgba(59,95,235,0.28)]">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
