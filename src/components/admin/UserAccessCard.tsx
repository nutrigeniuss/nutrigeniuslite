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
      return 'Acceso permanente';
    case 'active': {
      const expiry = formatExpiry(expiresAt);
      return expiry ? `con acceso · vence ${expiry}` : 'con acceso · sin vencimiento';
    }
    case 'expired':
      return 'vencido';
    case 'disabled':
      return 'sin acceso';
    case 'pending':
      return 'pendiente';
  }
}

function statusClass(status: AdminRowStatus): string {
  switch (status) {
    case 'admin':
      return 'text-slate-600';
    case 'active':
      return 'text-energy-600';
    case 'expired':
      return 'text-coral-600';
    case 'disabled':
      return 'text-coral-600';
    case 'pending':
      return 'text-amber-600';
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
  const status = resolveAdminRowStatus(row);
  const isAdmin = isAdminProfile(row);
  const isSelf = Boolean(selfId && selfId === row.id);
  const canManage = !isAdmin && !isSelf;

  return (
    <div className="ng-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">
            {row.full_name || 'Sin nombre'}
            {isSelf ? <span className="ng-muted ml-2">(tú)</span> : null}
          </p>
          <p className="ng-muted">{row.email}</p>
          <p className={`mt-1 text-xs font-semibold ${statusClass(status)}`}>
            {statusLabel(status, row.access_expires_at)}
          </p>
        </div>

        {isAdmin ? (
          <span className="ng-pill ng-pill-idle">Acceso permanente</span>
        ) : null}
      </div>

      {canManage ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
          <AccessDurationPicker
            value={durationDraft}
            onChange={onDurationDraftChange}
            disabled={busy}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onGrant}
              className="ng-btn-primary disabled:opacity-40"
            >
              Dar / Renovar acceso
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRevoke}
              className="ng-btn-ghost text-coral-600 disabled:opacity-40"
            >
              Quitar acceso
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onResetPassword}
              className="ng-btn-ghost disabled:opacity-40"
            >
              Cambiar clave
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="ng-btn-ghost text-coral-600 disabled:opacity-40"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
