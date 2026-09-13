import { Link } from 'react-router-dom';
import { Activity, BookOpen, Calculator, Flame, MessageCircle, RefreshCw } from 'lucide-react';
import BrandLogo from '@/components/BrandLogo';
import { LITE_PAYMENT, LITE_PLANS } from '@/config/litePayment';

const FEATURES = [
  {
    icon: Calculator,
    title: 'Antropometría',
    text: 'IMC, pliegues, composición y riesgos en un flujo claro.',
    tint: 'bg-brand-50 text-brand-500',
  },
  {
    icon: Flame,
    title: 'Calorías',
    text: 'TMB, NAF y macros listos para orientar la consulta.',
    tint: 'bg-coral-50 text-coral-500',
  },
  {
    icon: Activity,
    title: 'Resultados',
    text: 'Diagnóstico escaneable y listo para la consulta.',
    tint: 'bg-energy-50 text-energy-600',
  },
  {
    icon: RefreshCw,
    title: 'Actualizaciones gratis',
    text: 'Mejoras y nuevas funciones incluidas en tu plan, sin costo extra.',
    tint: 'bg-sky-50 text-sky-600',
  },
  {
    icon: BookOpen,
    title: 'Material educativo gratis',
    text: 'Recursos editables e imprimibles para apoyar la educación al paciente.',
    tint: 'bg-amber-50 text-amber-600',
  },
] as const;

const waHref = `https://wa.me/${LITE_PAYMENT.whatsappNotify}`;

const HERO_SHOTS = [
  {
    src: '/landing/resultados-adulto.png',
    alt: 'Resultados de antropometría: IMC, grasa y riesgo por perímetros',
  },
  {
    src: '/landing/resultados-pediatrico.png',
    alt: 'Evaluación pediátrica OMS con z-scores e indicadores',
  },
  {
    src: '/landing/resultados-gestante.png',
    alt: 'Evaluación de la gestante: ganancia de peso e IMC pregestacional',
  },
] as const;

/** Capturas reales de Resultados — ancla visual del producto. */
function AppMockup() {
  return (
    <div className="landing-mockup relative mx-auto w-full max-w-[440px] lg:max-w-none">
      <div
        className="absolute -inset-8 -z-10 rounded-[40px] opacity-80 blur-2xl"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(59,95,235,0.28), transparent 55%), radial-gradient(circle at 80% 70%, rgba(255,92,87,0.22), transparent 50%)',
        }}
        aria-hidden
      />

      {/* Shot secundaria (pediátrico) — profundidad Fitia */}
      <div className="pointer-events-none absolute -right-3 top-8 hidden w-[58%] rotate-[2.5deg] sm:block lg:-right-6 lg:top-10">
        <div className="landing-shot-back overflow-hidden rounded-[20px] border border-white/90 shadow-[0_18px_40px_-18px_rgba(15,23,42,0.45)] ring-1 ring-slate-200/70">
          <img
            src={HERO_SHOTS[1].src}
            alt=""
            className="block h-auto w-full object-cover object-top"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>

      {/* Shot principal (adulto) */}
      <div className="relative z-[1] overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_28px_60px_-20px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/60">
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-[#fafbfd] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          <span className="ml-3 flex-1 truncate rounded-full bg-slate-100 px-3 py-1 text-[10px] font-medium text-slate-400">
            nutrigeniuslite.app
          </span>
        </div>
        <img
          src={HERO_SHOTS[0].src}
          alt={HERO_SHOTS[0].alt}
          className="block h-auto w-full"
          loading="eager"
          decoding="async"
        />
      </div>

      {/* Shot flotante (gestante) */}
      <div className="landing-shot-float absolute -bottom-6 left-0 z-[2] w-[78%] overflow-hidden rounded-[18px] border border-white shadow-[0_20px_44px_-16px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/80 sm:-left-3 sm:w-[68%] lg:-bottom-8">
        <img
          src={HERO_SHOTS[2].src}
          alt={HERO_SHOTS[2].alt}
          className="block h-auto w-full"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden">
      {/* Atmósfera full-bleed */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(1000px 520px at 8% -8%, rgba(59,95,235,0.16), transparent 55%), radial-gradient(820px 480px at 92% 4%, rgba(255,92,87,0.14), transparent 52%), radial-gradient(700px 400px at 50% 40%, rgba(255,255,255,0.7), transparent 60%), #f4f6fb',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[72vh] opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(15,23,42,0.045) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 95%)',
        }}
        aria-hidden
      />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-16 pt-6 sm:px-8 sm:pb-20 sm:pt-8">
        <header className="landing-rise flex items-center justify-between gap-4">
          <BrandLogo className="min-w-0" alt="NutriGenius Lite" size="lg" showLite />
          <Link
            to="/login"
            className="shrink-0 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(59,95,235,0.28)] transition hover:bg-brand-600 active:scale-[0.98]"
          >
            Entrar
          </Link>
        </header>

        <main className="mt-10 flex flex-1 flex-col gap-20 sm:mt-14 lg:gap-28">
          {/* Hero: marca + copy + CTAs + mockup */}
          <section className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
            <div className="landing-rise max-w-xl" style={{ animationDelay: '60ms' }}>
              <h1 className="ng-display text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[3.25rem]">
                La calculadora clínica, limpia y rápida.
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-500 sm:text-lg">
                Medidas, resultados y calorías en un solo lugar, pensado para la consulta.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-coral-500 px-7 py-3 text-sm font-bold text-white shadow-[0_14px_32px_rgba(255,92,87,0.32)] transition hover:bg-coral-600 active:scale-[0.98]"
                >
                  Empezar
                </Link>
                <a
                  href={waHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#128C7E] shadow-[0_8px_24px_rgba(15,23,42,0.06)] ring-1 ring-[#25D366]/40 transition hover:bg-[#25D366]/10 active:scale-[0.98]"
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Contactar
                </a>
              </div>
              <p className="mt-5 text-sm font-medium text-slate-500">
                Planes desde{' '}
                <span className="font-bold text-slate-800">
                  {LITE_PAYMENT.priceLabel.replace(/^desde\s+/i, '')}
                </span>
                <span className="font-normal text-slate-400"> · 1, 2 o 3 meses</span>
              </p>
            </div>

            <div className="landing-rise landing-mockup-wrap pb-10 sm:pb-14" style={{ animationDelay: '140ms' }}>
              <AppMockup />
            </div>
          </section>

          {/* Beneficios — filas Fitia, sin cards pesadas */}
          <section className="landing-rise" style={{ animationDelay: '200ms' }}>
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-500">Incluye</p>
              <h2 className="ng-display mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Todo lo que usas en consulta
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-500">
                Herramientas claras, rápidas y listas para el día a día del nutricionista.
              </p>
            </div>

            <ul className="mt-10 divide-y divide-slate-200/70 border-y border-slate-200/70">
              {FEATURES.map(({ icon: Icon, title, text, tint }) => (
                <li
                  key={title}
                  className="flex gap-4 py-5 transition hover:bg-white/50 sm:gap-5 sm:py-6"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tint}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.1} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-[1.05rem] font-bold tracking-tight text-slate-900">{title}</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-slate-500">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Planes */}
          <section className="landing-rise" style={{ animationDelay: '260ms' }}>
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-500">Planes</p>
              <h2 className="ng-display mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Elige tu acceso
              </h2>
              <p className="mx-auto mt-3 max-w-md text-base text-slate-500">
                Activa por WhatsApp. Sin suscripción automática.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              {LITE_PLANS.map((plan, index) => {
                const featured = index === 1;
                return (
                  <article
                    key={plan.months}
                    className={`relative flex flex-col rounded-[22px] p-5 transition ${
                      featured
                        ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-[0_20px_40px_-16px_rgba(59,95,235,0.55)]'
                        : 'bg-white/90 text-slate-900 shadow-[0_12px_32px_-18px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/80'
                    }`}
                  >
                    {featured ? (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-coral-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                        Popular
                      </span>
                    ) : null}
                    <p className={`text-sm font-semibold ${featured ? 'text-white/80' : 'text-slate-500'}`}>
                      {plan.label}
                    </p>
                    <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">
                      {plan.priceLabel}
                    </p>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-full text-sm font-bold transition active:scale-[0.98] ${
                        featured
                          ? 'bg-white text-brand-600 hover:bg-brand-50'
                          : 'bg-brand-500 text-white hover:bg-brand-600'
                      }`}
                    >
                      Activar por WhatsApp
                    </a>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Cierre */}
          <section className="landing-rise overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-slate-900 to-brand-600 px-6 py-12 text-center text-white shadow-[0_24px_50px_-20px_rgba(15,23,42,0.45)] sm:px-10">
            <h2 className="ng-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Lista para tu próxima consulta
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
              Entra a la calculadora o escríbenos por WhatsApp para activar tu plan.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-coral-500 px-7 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(255,92,87,0.35)] transition hover:bg-coral-600 active:scale-[0.98]"
              >
                Empezar ahora
              </Link>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/10 px-6 py-3 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/15 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            </div>
          </section>
        </main>

        <footer className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-slate-200/70 pt-6 text-center text-xs text-slate-400 sm:flex-row sm:text-left">
          <p>© {new Date().getFullYear()} NutriGenius Lite</p>
          <p>Calculadora de consulta · EDHEL</p>
        </footer>
      </div>
    </div>
  );
}
