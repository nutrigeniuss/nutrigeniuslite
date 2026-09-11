import { useState, type FormEvent } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import type { AccessDays } from '@/lib/adminAccess';
import {
  buildCredentialsWhatsAppMessage,
  normalizeWhatsAppPhone,
  whatsAppSendUrl,
} from '@/lib/adminWhatsAppInvite';
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

type InvitePreview = {
  phone: string;
  message: string;
};

export default function CreateNutritionistForm({ busy, onSubmit }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [grantAccess, setGrantAccess] = useState(true);
  const [accessDays, setAccessDays] = useState<AccessDays>(45);
  const [localError, setLocalError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [copied, setCopied] = useState(false);

  const resetFormFields = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setPhone('');
    setGrantAccess(true);
    setAccessDays(45);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    setInvite(null);
    setCopied(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('El email es obligatorio');
      return;
    }
    if (password.length < 6) {
      setLocalError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    const phoneDigits = normalizeWhatsAppPhone(phone);
    if (phone.trim() && phoneDigits.length < 9) {
      setLocalError('Número de WhatsApp inválido (usa 9 dígitos o con código de país)');
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

      const message = buildCredentialsWhatsAppMessage({
        fullName: fullName.trim(),
        email: trimmedEmail,
        password,
      });
      setInvite({ phone: phoneDigits, message });

      if (phoneDigits) {
        window.open(whatsAppSendUrl(phoneDigits, message), '_blank', 'noopener,noreferrer');
      }

      resetFormFields();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'No se pudo crear la cuenta');
    }
  };

  const copyMessage = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setLocalError('No se pudo copiar el mensaje');
    }
  };

  return (
    <div className="space-y-4">
      <form className="ng-card ng-inset space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Crear nutricionista</h2>
          <p className="ng-muted mt-1">Alta con contraseña temporal, WhatsApp opcional y acceso</p>
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
            type="text"
            required
            minLength={6}
            className="ng-input !mt-0 font-mono tracking-wide"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            placeholder="Visible para que puedas copiarla al mensaje"
          />
          <p className="ng-muted mt-1.5">Se muestra en texto claro a propósito (solo tú la ves aquí).</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-500" htmlFor="create-nutri-phone">
            WhatsApp (opcional)
          </label>
          <input
            id="create-nutri-phone"
            type="tel"
            inputMode="tel"
            className="ng-input !mt-0"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
            placeholder="999 888 777 o 51999888777"
            autoComplete="tel"
          />
          <p className="ng-muted mt-1.5">
            Si lo llenas, al crear se abre WhatsApp con el mensaje de credenciales.
          </p>
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

      {invite ? (
        <div className="ng-card ng-inset space-y-3 border-energy-600/20 bg-energy-50/40">
          <div>
            <p className="text-sm font-bold text-slate-900">Cuenta creada · mensaje para WhatsApp</p>
            <p className="ng-muted mt-1">
              Revisa el texto, cópialo o ábrelo de nuevo en WhatsApp.
            </p>
          </div>
          <textarea
            readOnly
            rows={12}
            className="ng-input !mt-0 resize-y font-sans text-[13px] leading-relaxed"
            value={invite.message}
            onChange={() => undefined}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copyMessage()} className="ng-btn-ghost">
              <Copy className="h-3.5 w-3.5" />
              {copied ? 'Copiado' : 'Copiar mensaje'}
            </button>
            <a
              href={whatsAppSendUrl(invite.phone, invite.message)}
              target="_blank"
              rel="noopener noreferrer"
              className="ng-btn-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {invite.phone ? 'Abrir WhatsApp' : 'Abrir WhatsApp (elegir chat)'}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
