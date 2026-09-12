import { useState } from 'react';
import {
  isAdminProfile,
  resolveAdminRowStatus,
  type AccessDays,
  type AdminRowStatus,
} from '@/lib/adminAccess';
import AccessDurationPicker from '@/components/admin/AccessDurationPicker';

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  access_mode: string | null;
  is_active: boolean | null;
  access_expires_at: string | null;
};

type Props = {
  row: ProfileRow;
  selfId?: string;
  busy: boolean;
  durationDraft: AccessDays;
  onDurationDraftChange: (days: AccessDays) => void;
  onGrant: () => void;
  onRevoke: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
};

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function statusLabel(status: AdminRowStatus, expiresAt: string | null): string {
  switch (status) {
    case 'admin':
      return 'Admin';
    case 'active': {
      const expiry = formatExpiry(expiresAt);
      return expiry ? `Activo · ${expiry}` : 'Activo · sin vencer';
    }
    case 'expired':
      return 'Vencido';
    case 'disabled':
      return 'Sin acceso';
    case 'pending':
      return 'Pendiente';
  }
}

function statusClass(status: AdminRowStatus): string {
  switch (status) {
    case 'admin':
      return 'bg-slate-100 text-slate-700';
    case 'active':
      return 'bg-emerald-50 text-emerald-700';
    case 'expired':
      return 'bg-coral-50 text-coral-700';
    case 'disabled':
      return 'bg-slate-50 text-slate-500';
    case 'pending':
      return 'bg-amber-50 text-amber-700';
  }
}

export default function UserAccessCard({
  row,
  selfId,
  busy,
  durationDraft,
  onDurationDraftChange,
  onGrant,
  onRevoke,
  onResetPassword,
  onDelete,
}: Props) {
  const [grantOpen, setGrantOpen] = useState(false);
  const status = resolveAdminRowStatus(row);
  const isAdmin = isAdminProfile(row);
  const isSelf = Boolean(selfId && selfId === row.id);
  const canManage = !isAdmin && !isSelf;

  return (
    <div className="border-b border-slate-100 px-3 py-2.5 last:border-b-0 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {row.full_name || 'Sin nombre'}
            {isSelf ? <span className="ml-1.5 text-xs font-medium text-slate-400">(tú)</span> : null}
          </p>
          <p className="truncate text-xs text-slate-500">{row.email}</p>
        </div>

        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusClass(status)}`}>
          {statusLabel(status, row.access_expires_at)}
        </span>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => setGrantOpen((open) => !open)}
              className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {status === 'active' ? 'Renovar' : 'Dar acceso'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRevoke}
              className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Quitar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onResetPassword}
              className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Clave
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-coral-600 hover:bg-coral-50 disabled:opacity-40"
            >
              Eliminar
            </button>
          </div>
        ) : null}
      </div>

      {canManage && grantOpen ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
          <AccessDurationPicker
            value={durationDraft}
            onChange={onDurationDraftChange}
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onGrant();
              setGrantOpen(false);
            }}
            className="rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          >
            Confirmar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setGrantOpen(false)}
            className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-white disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </div>
  );
}
