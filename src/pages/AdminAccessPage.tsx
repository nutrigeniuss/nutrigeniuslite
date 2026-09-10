import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import {
  buildGrantProfilePatch,
  buildRevokeProfilePatch,
  isAdminProfile,
  type AccessDays,
} from '@/lib/adminAccess';
import {
  createNutritionist,
  deleteNutritionist,
  setNutritionistPassword,
} from '@/lib/adminManageUserClient';
import { supabase } from '@/lib/supabase';
import CreateNutritionistForm from '@/components/admin/CreateNutritionistForm';
import UserAccessCard from '@/components/admin/UserAccessCard';

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  access_mode: string | null;
  is_active: boolean | null;
  access_expires_at: string | null;
};

const CREATE_BUSY = '__create__';
const DEFAULT_DAYS: AccessDays = 45;

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function AdminAccessPage() {
  const { admin, refreshProfile, user } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [durationDrafts, setDurationDrafts] = useState<Record<string, AccessDays>>({});

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

  const draftFor = (id: string): AccessDays => durationDrafts[id] ?? DEFAULT_DAYS;

  const setDraft = (id: string, days: AccessDays) => {
    setDurationDrafts((prev) => ({ ...prev, [id]: days }));
  };

  const grant = async (id: string, days: AccessDays) => {
    if (!supabase) return;
    if (id === user?.id) {
      setError('No puedes gestionar el acceso de tu propia cuenta');
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from('profiles')
        .update(buildGrantProfilePatch(days))
        .eq('id', id);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      await load();
      await refreshProfile();
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (id: string) => {
    if (!supabase) return;
    if (id === user?.id) {
      setError('No puedes quitar el acceso de tu propia cuenta');
      return;
    }
    const row = rows.find((r) => r.id === id);
    if (row && isAdminProfile(row)) {
      setError('No se puede quitar el acceso de una cuenta admin');
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const { error: uErr } = await supabase
        .from('profiles')
        .update(buildRevokeProfilePatch())
        .eq('id', id);
      if (uErr) {
        setError(uErr.message);
        return;
      }
      await load();
      await refreshProfile();
    } finally {
      setBusyId(null);
    }
  };

  const create = async (input: {
    fullName: string;
    email: string;
    password: string;
    grantAccess: boolean;
    accessDays: AccessDays;
  }) => {
    setBusyId(CREATE_BUSY);
    setError(null);
    try {
      await createNutritionist(input);
      await load();
    } catch (err) {
      const msg = errMessage(err, 'No se pudo crear la cuenta');
      setError(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (id: string) => {
    if (id === user?.id) {
      setError('No puedes cambiar la clave de tu propia cuenta desde aquí');
      return;
    }
    const row = rows.find((r) => r.id === id);
    if (row && isAdminProfile(row)) {
      setError('No se puede cambiar la clave de una cuenta admin');
      return;
    }
    const password = window.prompt('Nueva contraseña temporal (mín. 6)');
    if (!password) return;
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await setNutritionistPassword(id, password);
    } catch (err) {
      setError(errMessage(err, 'No se pudo cambiar la contraseña'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (id === user?.id) {
      setError('No puedes eliminar tu propia cuenta');
      return;
    }
    const row = rows.find((r) => r.id === id);
    if (row && isAdminProfile(row)) {
      setError('No se puede eliminar una cuenta admin');
      return;
    }
    if (!window.confirm('¿Eliminar esta cuenta? No se puede deshacer.')) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteNutritionist(id);
      await load();
    } catch (err) {
      setError(errMessage(err, 'No se pudo eliminar la cuenta'));
    } finally {
      setBusyId(null);
    }
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

      <div className="mb-6">
        <CreateNutritionistForm busy={busyId === CREATE_BUSY} onSubmit={create} />
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <UserAccessCard
            key={row.id}
            row={row}
            selfId={user?.id}
            busy={busyId === row.id}
            durationDraft={draftFor(row.id)}
            onDurationDraftChange={(days) => setDraft(row.id, days)}
            onGrant={() => void grant(row.id, draftFor(row.id))}
            onRevoke={() => void revoke(row.id)}
            onResetPassword={() => void resetPassword(row.id)}
            onDelete={() => void remove(row.id)}
          />
        ))}
        {rows.length === 0 && !error ? (
          <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-slate-400 ring-1 ring-slate-200/80">
            Aún no hay perfiles. Crea uno arriba o espera a que alguien se registre.
          </p>
        ) : null}
      </div>
    </div>
  );
}
