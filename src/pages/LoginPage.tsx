import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import BackNav from '@/components/BackNav';
import BrandLogo from '@/components/BrandLogo';
import PaymentTransferDetails from '@/components/PaymentTransferDetails';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/lib/passwordPolicy';

type Mode = 'in' | 'up' | 'forgot';

export default function LoginPage() {
  const { signIn, signUp, requestPasswordReset, session, ready, configured } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && session && mode !== 'forgot') return <Navigate to="/app" replace />;

  const title =
    mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Recuperar contraseña';
  const subtitle =
    mode === 'forgot'
      ? 'Te enviaremos un enlace a tu correo'
      : 'Acceso a la calculadora';

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    if (mode === 'forgot') {
      const result = await requestPasswordReset(email.trim());
      setBusy(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setInfo('Si el correo existe, recibirás un enlace para restablecer la contraseña.');
      return;
    }

    if (mode === 'up') {
      const invalid = validatePassword(password);
      if (invalid) {
        setBusy(false);
        setError(invalid);
        return;
      }
    }

    const result = mode === 'in'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, fullName.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/app');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <BackNav to="/" label="Volver al inicio" className="mb-5 self-start" />

      <Link to="/" className="mb-8 self-start">
        <BrandLogo alt="NutriGenius Lite" showLite />
      </Link>

      <div className="ng-card p-6 sm:p-8">
        <h1 className="ng-page-title">{title}</h1>
        <p className="ng-muted mt-1">{subtitle}</p>

        {!configured ? (
          <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Falta configurar Supabase en `.env.local`.
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === 'up' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="name">Nombre</label>
              <input
                id="name"
                className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {mode !== 'forgot' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              {mode === 'in' ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-brand-500 hover:underline"
                  onClick={() => {
                    setMode('forgot');
                    setError(null);
                    setInfo(null);
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm font-medium text-coral-600">{error}</p> : null}
          {info ? <p className="text-sm font-medium text-emerald-700">{info}</p> : null}

          {mode === 'up' ? <PaymentTransferDetails /> : null}

          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded-full bg-brand-500 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(59,95,235,0.28)] transition hover:bg-brand-600 disabled:opacity-60"
          >
            {busy
              ? 'Espera…'
              : mode === 'in'
                ? 'Entrar'
                : mode === 'up'
                  ? 'Registrarme'
                  : 'Enviar enlace'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm font-semibold text-slate-500 hover:text-brand-500"
          onClick={() => {
            setMode((m) => (m === 'up' ? 'in' : m === 'forgot' ? 'in' : 'up'));
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'in'
            ? '¿No tienes cuenta? Regístrate'
            : mode === 'up'
              ? '¿Ya tienes cuenta? Entra'
              : 'Volver a entrar'}
        </button>
      </div>
    </div>
  );
}
