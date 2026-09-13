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
    'Te adjunto el PDF del plan.',
    'Cualquier duda, escríbeme por aquí.',
  ].join('\n');
}

export type SendDietWhatsAppResult =
  | { ok: true; mode: 'download+wa'; pdfOk: boolean }
  | { ok: false; reason: 'missing-phone' | 'error'; message?: string };

/** Abre WhatsApp sin depender de window.open tras un await (móvil lo bloquea). */
export function openWhatsAppChat(waUrl: string): void {
  try {
    const opened = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (opened) return;
  } catch {
    /* ancla */
  }

  const anchor = document.createElement('a');
  anchor.href = waUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Abre el chat de WhatsApp al toque (gesto del usuario) y en paralelo
 * genera/descarga el PDF para adjuntarlo en ese chat.
 */
export async function sendDietViaWhatsApp(input: {
  phoneRaw: string;
  patientName?: string;
  planTitle?: string;
  getPdfFile: () => Promise<File>;
}): Promise<SendDietWhatsAppResult> {
  const phone = normalizeWhatsAppPhone(input.phoneRaw);
  // PE: 51 + 9 = 11. Aceptamos ≥ 10 (otros países).
  if (phone.length < 10) {
    return { ok: false, reason: 'missing-phone' };
  }

  const message = buildDietWhatsAppMessage({
    patientName: input.patientName,
    planTitle: input.planTitle,
  });
  const waUrl = whatsAppSendUrl(phone, message);

  // 1) Abrir WhatsApp YA — aún dentro del gesto del click (antes de await).
  openWhatsAppChat(waUrl);

  // 2) Generar y descargar PDF (el nutri lo adjunta en el chat ya abierto).
  try {
    const file = await input.getPdfFile();
    downloadPdfFile(file);
    return { ok: true, mode: 'download+wa', pdfOk: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error
        ? `${err.message} WhatsApp ya está abierto: usa PDF / Imprimir y adjúntalo.`
        : 'WhatsApp ya está abierto: usa PDF / Imprimir y adjúntalo al chat.',
    };
  }
}
