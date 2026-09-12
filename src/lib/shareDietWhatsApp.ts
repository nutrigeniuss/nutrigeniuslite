import { normalizeWhatsAppPhone, whatsAppSendUrl } from '@/lib/adminWhatsAppInvite';
import { downloadPdfFile } from '@/lib/pdfFromHtml';

export function buildDietWhatsAppMessage(input: {
  patientName?: string;
  planTitle?: string;
}): string {
  const name = (input.patientName || '').trim();
  const title = (input.planTitle || '').trim();
  const hello = name ? `Hola ${name.split(/\s+/)[0]}` : 'Hola';
  const planLine = title
    ? `Te envío tu plan alimentario: *${title}*.`
    : 'Te envío tu plan alimentario.';
  return [
    `${hello} 👋`,
    '',
    planLine,
    '',
    'Cualquier duda, escríbeme por aquí.',
  ].join('\n');
}

export type SendDietWhatsAppResult =
  | { ok: true; mode: 'share' | 'download+wa' | 'cancelled' }
  | { ok: false; reason: 'missing-phone' | 'error'; message?: string };

/**
 * Genera el PDF (vía getPdfFile), intenta compartirlo y abre WhatsApp
 * al número del paciente cuando hace falta adjuntar manualmente.
 */
export async function sendDietViaWhatsApp(input: {
  phoneRaw: string;
  patientName?: string;
  planTitle?: string;
  getPdfFile: () => Promise<File>;
}): Promise<SendDietWhatsAppResult> {
  const phone = normalizeWhatsAppPhone(input.phoneRaw);
  if (phone.length < 11) {
    return { ok: false, reason: 'missing-phone' };
  }

  const message = buildDietWhatsAppMessage({
    patientName: input.patientName,
    planTitle: input.planTitle,
  });
  const waUrl = whatsAppSendUrl(phone, message);

  let file: File;
  try {
    file = await input.getPdfFile();
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : 'No se pudo generar el PDF',
    };
  }

  const canShareFiles =
    typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] });

  if (canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: input.planTitle || 'Plan alimentario',
        text: message,
      });
      return { ok: true, mode: 'share' };
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      if (name === 'AbortError') {
        return { ok: true, mode: 'cancelled' };
      }
      // Sigue con descarga + chat
    }
  }

  downloadPdfFile(file);
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  return { ok: true, mode: 'download+wa' };
}
