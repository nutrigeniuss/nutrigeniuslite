import { useState, type FormEvent } from 'react';
import type { AccessDays } from '@/lib/adminAccess';
import AccessDurationPicker from '@/components/admin/AccessDurationPicker';

type Props = {
  busy: boolean;
  onSubmit: (input: {
    fullName: string;
    email: string;
    password: string;
    grantAccess: boolean;
    accessDays: AccessDays;
  }) => Promise<void>;
};

export default function CreateNutritionistForm({ busy, onSubmit }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [grantAccess, setGrantAccess] = useState(true);
  const [accessDays, setAccessDays] = useState<AccessDays>(45);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('El email es obligatorio');
      return;
    }
    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: trimmedEmail,
        password,
        grantAccess,
        accessDays,
      });
      setFullName('');
      setEmail('');
      setPassword('');
      setGrantAccess(true);
      setAccessDays(45);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
    }
  };

  return (
    <form className="ng-card ng-inset space-y-4" onSubmit={(e) => void handleSubmit(e)}>
      <div>
        <h2 className="text-sm font-bold text-slate-900">Crear nutricionista</h2>
        <p className="ng-muted mt-1">Alta con contraseña temporal y acceso opcional</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="create-nutri-name">
          Nombre
        </label>
        <input
          id="create-nutri-name"
          className="ng-input !mt-0"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={busy}
          autoComplete="name"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="create-nutri-email">
          Email
        </label>
        <input
          id="create-nutri-email"
          type="email"
          required
          className="ng-input !mt-0"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          autoComplete="email"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="create-nutri-password">
          Contraseña temporal
        </label>
        <input
          id="create-nutri-password"
          type="password"
          required
          minLength={6}
          className="ng-input !mt-0"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500">Duración del acceso</p>
        <AccessDurationPicker value={accessDays} onChange={setAccessDays} disabled={busy || !grantAccess} />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={grantAccess}
          onChange={(e) => setGrantAccess(e.target.checked)}
          disabled={busy}
          className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500/30"
        />
        Dar acceso al crear
      </label>

      {localError ? (
        <p className="rounded-2xl bg-coral-50 px-4 py-3 text-sm text-coral-600">{localError}</p>
      ) : null}

      <button type="submit" disabled={busy} className="ng-btn-primary disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  );
}
