import { useEffect, useState } from 'react';
import { Download, Share } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * CTA para instalar Lite como acceso directo (PWA).
 * Chrome/Android: beforeinstallprompt. iOS: instrucción Compartir → Añadir a inicio.
 */
export default function InstallAppButton({
  className = '',
  compact = false,
}: {
  className?: string;
  /** En móvil: solo icono para no apretar el header. */
  compact?: boolean;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    const onInstalled = () => {
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (standalone) return null;

  const showIos = isIos() && !deferred;

  const handleClick = async () => {
    if (deferred) {
      setBusy(true);
      try {
        await deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (showIos) {
      setIosHint((v) => !v);
    }
  };

  // Sin evento de install y no es iOS: ocultar (Firefox desktop, etc.).
  if (!deferred && !showIos) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy}
        aria-label={busy ? 'Instalando' : 'Instalar app'}
        title={busy ? 'Instalando…' : 'Instalar app'}
        className={compact ? 'ng-btn-ghost !min-h-11 !w-11 !px-0' : 'ng-btn-ghost'}
      >
        {showIos ? <Share className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        {compact ? null : busy ? 'Instalando…' : 'Instalar app'}
      </button>
      {iosHint ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-left text-[11px] leading-relaxed text-slate-600 shadow-lg">
          <p className="font-semibold text-slate-800">Añadir a inicio (iPhone)</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            <li>Toca el botón <strong>Compartir</strong> de Safari</li>
            <li>Elige <strong>Añadir a pantalla de inicio</strong></li>
            <li>Confirma <strong>Añadir</strong></li>
          </ol>
          <button
            type="button"
            className="mt-2 min-h-11 text-[11px] font-semibold text-brand-500"
            onClick={() => setIosHint(false)}
          >
            Entendido
          </button>
        </div>
      ) : null}
    </div>
  );
}
