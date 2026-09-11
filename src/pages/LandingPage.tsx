import { Link } from 'react-router-dom';
import { Activity, BookOpen, Calculator, Flame, RefreshCw } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { LITE_PAYMENT } from '@/config/litePayment';

const FEATURES = [
  {
    icon: Calculator,
    title: 'Antropometría',
    text: 'IMC, pliegues, composición y riesgos en un flujo claro.',
    tone: {
      glow: 'rgba(59, 95, 235, 0.45)',
      shadow: 'rgba(59, 95, 235, 0.32)',
      icon: 'linear-gradient(145deg, #5b7cff 0%, #3b5feb 100%)',
      wash: 'linear-gradient(160deg, #ffffff 0%, #eef2ff 100%)',
    },
  },
  {
    icon: Flame,
    title: 'Calorías',
    text: 'TMB, NAF y macros listos para orientar la consulta.',
    tone: {
      glow: 'rgba(255, 92, 87, 0.42)',
      shadow: 'rgba(255, 92, 87, 0.3)',
      icon: 'linear-gradient(145deg, #ff7a6d 0%, #ff5c57 100%)',
      wash: 'linear-gradient(160deg, #ffffff 0%, #fff1f0 100%)',
    },
  },
  {
    icon: Activity,
    title: 'Resultados',
    text: 'Diagnóstico escaneable y listo para la consulta.',
    tone: {
      glow: 'rgba(22, 163, 74, 0.4)',
      shadow: 'rgba(22, 163, 74, 0.28)',
      icon: 'linear-gradient(145deg, #34d399 0%, #16a34a 100%)',
      wash: 'linear-gradient(160deg, #ffffff 0%, #ecfaed 100%)',
    },
  },
  {
    icon: RefreshCw,
    title: 'Actualizaciones gratis',
    text: 'Mejoras y nuevas funciones incluidas en tu plan, sin costo extra.',
    tone: {
      glow: 'rgba(14, 165, 233, 0.4)',
      shadow: 'rgba(14, 165, 233, 0.28)',
      icon: 'linear-gradient(145deg, #38bdf8 0%, #0284c7 100%)',
      wash: 'linear-gradient(160deg, #ffffff 0%, #e0f2fe 100%)',
    },
  },
  {
    icon: BookOpen,
    title: 'Material educativo gratis',
    text: 'Recursos editables e imprimibles para apoyar la educación al paciente.',
    tone: {
      glow: 'rgba(245, 158, 11, 0.4)',
      shadow: 'rgba(245, 158, 11, 0.28)',
      icon: 'linear-gradient(145deg, #fbbf24 0%, #f59e0b 100%)',
      wash: 'linear-gradient(160deg, #ffffff 0%, #fffbeb 100%)',
    },
  },
] as const;

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

      <main className="mt-14 flex flex-1 flex-col gap-16 sm:mt-20 lg:gap-24">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-500">Incluye</p>
              <h2 className="ng-display mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Todo lo que usas en consulta
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              Herramientas claras, rápidas y listas para el día a día del nutricionista.
            </p>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {FEATURES.map(({ icon: Icon, title, text, tone }, index) => {
              const span = index < 3 ? 'lg:col-span-2' : 'lg:col-span-3';
              return (
                <article
                  key={title}
                  className={`ng-feature-card ${span}`}
                  style={{
                    background: tone.wash,
                    animationDelay: `${index * 70}ms`,
                    ['--ng-feature-glow' as string]: tone.glow,
                    ['--ng-feature-shadow' as string]: tone.shadow,
                  }}
                >
                  <span className="ng-feature-icon" style={{ background: tone.icon }}>
                    <Icon className="h-5 w-5" strokeWidth={2.1} />
                  </span>
                  <h3 className="relative mt-5 text-[1.05rem] font-bold tracking-tight text-slate-900">
                    {title}
                  </h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-500">{text}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
