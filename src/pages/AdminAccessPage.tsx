import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { resolveLiteAccess } from '@/lib/access';
import { supabase } from '@/lib/supabase';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  access_mode: string | null;
  is_active: boolean | null;
  access_expires_at: string | null;
};

function rowStatus(row: UserRow) {
  return resolveLiteAccess({
    role: row.role,
    accessMode: row.access_mode,
    isActive: row.is_active,
    accessExpiresAt: row.access_expires_at,
  });
}

export default function AdminAccessPage() {
  const { admin, refreshProfile, user } = useAuth();
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
      .select('id, email, full_name, role, access_mode, is_active, access_expires_at')
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

  const grantAccess = async (id: string) => {
    if (!supabase) return;
    setBusyId(id);
    const { error: uErr } = await supabase
      .from('profiles')
      .update({
        access_mode: 'manual_preview',
        is_active: true,
        access_expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString(),
        updated_at: new Date().toISOString(),
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

  const revokeAccess = async (id: string) => {
    if (!supabase) return;
    setBusyId(id);
    const { error: uErr } = await supabase
      .from('profiles')
      .update({
        access_mode: 'lite_disabled',
        is_active: false,
        access_expires_at: null,
        updated_at: new Date().toISOString(),
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
          <Link to="/app" className="ng-muted inline-flex items-center gap-1 hover:text-brand-500">
            <ArrowLeft className="h-4 w-4" /> Calculadora
          </Link>
          <h1 className="ng-page-title mt-2">Módulo maestro</h1>
          <p className="ng-muted mt-1">Acceso de cuentas · subir base maestra de alimentos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/alimentos" className="ng-btn-primary">
            Subir base maestra
          </Link>
          <button type="button" onClick={() => void load()} className="ng-btn-ghost">
            Actualizar
          </button>
        </div>
      </div>

      {error ? <p className="mb-3 rounded-2xl bg-coral-50 px-4 py-3 text-sm text-coral-600">{error}</p> : null}

      <div className="space-y-2">
        {rows.map((row) => {
          const status = rowStatus(row);
          const isSelf = row.id === user?.id;
          const isAdminRow = row.role === 'admin' || row.access_mode === 'internal_admin';
          const hasAccess = status === 'active';

          return (
            <div key={row.id} className="ng-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {row.full_name || 'Sin nombre'}
                    {isSelf ? <span className="ng-muted ml-2">(tú)</span> : null}
                  </p>
                  <p className="ng-muted">{row.email}</p>
                  <p className="ng-muted mt-1">
                    {isAdminRow ? 'Admin · ' : ''}
                    {hasAccess ? (
                      <span className="inline-flex items-center gap-1 text-energy-600"><Check className="h-3 w-3" /> con acceso</span>
                    ) : status === 'disabled' ? (
                      <span className="inline-flex items-center gap-1 text-coral-600"><X className="h-3 w-3" /> sin acceso</span>
                    ) : (
                      <span className="text-amber-600">pendiente de pago</span>
                    )}
                  </p>
                </div>

                {isAdminRow ? (
                  <span className="ng-pill ng-pill-idle">
                    Acceso permanente
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.id || hasAccess}
                      onClick={() => void grantAccess(row.id)}
                      className="ng-btn-primary disabled:opacity-40"
                    >
                      Dar acceso
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id || !hasAccess}
                      onClick={() => void revokeAccess(row.id)}
                      className="ng-btn-ghost text-coral-600 disabled:opacity-40"
                    >
                      Quitar acceso
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && !error ? (
          <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200/80">
            Aún no hay perfiles. Cuando alguien se registre, aparece aquí.
          </p>
        ) : null}
      </div>
    </div>
  );
}
