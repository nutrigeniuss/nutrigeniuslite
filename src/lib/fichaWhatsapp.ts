/** Lee el WhatsApp guardado en la ficha de sesión (Lite). */
export function readFichaWhatsappFromStorage(): string {
  try {
    const raw = localStorage.getItem('ng_lite_calc_ficha_v2');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { patient?: { whatsapp?: string | null } };
    return typeof parsed.patient?.whatsapp === 'string' ? parsed.patient.whatsapp.trim() : '';
  } catch {
    return '';
  }
}

export function resolvePatientWhatsapp(urlValue: string | null | undefined): string {
  const fromUrl = (urlValue || '').trim();
  if (fromUrl) return fromUrl;
  return readFichaWhatsappFromStorage();
}
