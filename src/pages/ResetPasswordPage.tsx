import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import BackNav from '@/components/BackNav';
import BrandLogo from '@/components/BrandLogo';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/lib/passwordPolicy';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const { updatePassword, configured } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;

    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED'))) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const invalid = validatePassword(password);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    window.setTimeout(() => navigate('/app', { replace: true }), 1200);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <BackNav to="/login" label="Volver al login" className="mb-5 self-start" />

      <Link to="/" className="mb-8 self-start">
        <BrandLogo alt="NutriGenius Lite" showLite />
      </Link>

      <div className="ng-card p-6 sm:p-8">
        <h1 className="ng-page-title">Nueva contraseña</h1>
        <p className="ng-muted mt-1">Define una contraseña segura para tu cuenta</p>

        {!configured ? (
          <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Falta configurar Supabase en `.env.local`.
          </p>
        ) : null}

        {configured && !ready && !done ? (
          <p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Abre el enlace del correo de recuperación para continuar. Si ya lo abriste, espera un momento…
          </p>
        ) : null}

        {done ? (
          <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Contraseña actualizada. Redirigiendo…
          </p>
        ) : null}

        {ready && !done ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="password">
                Nueva contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="confirm">
                Confirmar contraseña
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                className="w-full rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>

            {error ? <p className="text-sm font-medium text-coral-600">{error}</p> : null}

            <button
              type="submit"
              disabled={busy || !configured}
              className="w-full rounded-full bg-brand-500 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(59,95,235,0.28)] transition hover:bg-brand-600 disabled:opacity-60"
            >
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
