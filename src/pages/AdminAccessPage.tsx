import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  access_mode: string | null;
  is_active: boolean | null;
};

export default function AdminAccessPage() {
  const { admin, refreshProfile } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase no configurado');
      return;
    }
    const { data, error: qErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, access_mode, is_active')
      .order('email');
    if (qErr) {
      setError(qErr.message);
      return;
    }
    setRows((data ?? []) as UserRow[]);
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setAccess = async (id: string, mode: 'manual_preview' | 'lite_disabled' | 'billing_managed') => {
    if (!supabase) return;
    setBusyId(id);
    const { error: uErr } = await supabase
      .from('profiles')
      .update({
        access_mode: mode,
        is_active: mode === 'manual_preview',
        access_expires_at: mode === 'manual_preview'
          ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString()
          : null,
      })
      .eq('id', id);
    setBusyId(null);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    await load();
    await refreshProfile();
  };

  if (!admin) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-sm text-slate-500">Solo el módulo maestro puede ver esta pantalla.</p>
        <Link to="/app" className="mt-4 inline-block text-sm font-semibold text-brand-500">Volver</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <Link to="/app" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-brand-500">
            <ArrowLeft className="h-4 w-4" /> Calculadora
          </Link>
          <h1 className="ng-display mt-2 text-2xl font-semibold text-slate-950">Módulo maestro</h1>
          <p className="text-sm text-slate-400">Activar o revocar acceso Lite</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-200">
          Actualizar
        </button>
      </div>

      {error ? <p className="mb-3 rounded-2xl bg-coral-50 px-4 py-3 text-sm text-coral-600">{error}</p> : null}

      <div className="space-y-2">
        {rows.map((row) => {
          const active = row.access_mode === 'manual_preview' || row.access_mode === 'internal_admin' || row.role === 'admin';
          return (
            <div key={row.id} className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{row.full_name || 'Sin nombre'}</p>
                  <p className="text-xs text-slate-400">{row.email}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">
                    {row.role === 'admin' ? 'Admin · ' : ''}
                    {row.access_mode || 'billing_managed'}
                    {active ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-energy-600"><Check className="h-3 w-3" /> activo</span>
                    ) : (
                      <span className="ml-2 text-amber-600">pendiente</span>
                    )}
                  </p>
                </div>
                {row.role === 'admin' ? null : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void setAccess(row.id, 'manual_preview')}
                      className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Activar
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void setAccess(row.id, 'lite_disabled')}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-coral-600 ring-1 ring-coral-100 disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && !error ? (
          <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200/80">
            Aún no hay perfiles. Aplica el SQL de `supabase/schema.sql` y registra un usuario.
          </p>
        ) : null}
      </div>
    </div>
  );
}
