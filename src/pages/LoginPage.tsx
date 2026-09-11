import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import BrandLogo from '@/components/BrandLogo';
import PaymentTransferDetails from '@/components/PaymentTransferDetails';

export default function LoginPage() {
  const { signIn, signUp, session, ready, configured } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && session) return <Navigate to="/app" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
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
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-slate-500 transition hover:text-brand-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al inicio
      </Link>

      <Link to="/" className="mb-8 self-start">
        <BrandLogo alt="NutriGenius Lite" showLite />
      </Link>

      <div className="ng-card p-6 sm:p-8">
        <h1 className="ng-page-title">
          {mode === 'in' ? 'Entrar' : 'Crear cuenta'}
        </h1>
        <p className="ng-muted mt-1">Acceso a la calculadora</p>

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
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error ? <p className="text-sm font-medium text-coral-600">{error}</p> : null}

          {mode === 'up' ? <PaymentTransferDetails /> : null}

          <button
            type="submit"
            disabled={busy || !configured}
            className="w-full rounded-full bg-brand-500 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(59,95,235,0.28)] transition hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? 'Espera…' : mode === 'in' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm font-semibold text-slate-500 hover:text-brand-500"
          onClick={() => {
            setMode((m) => (m === 'in' ? 'up' : 'in'));
            setError(null);
          }}
        >
          {mode === 'in' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Entra'}
        </button>
      </div>
    </div>
  );
}
