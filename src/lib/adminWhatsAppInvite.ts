import { publicSiteLabel, publicSiteUrl } from '@/lib/publicSite';

/** Deja solo dígitos; si es celular PE de 9 dígitos, antepone 51. */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 9 && digits.startsWith('9')) return `51${digits}`;
  return digits;
}

export function buildCredentialsWhatsAppMessage(input: {
  fullName: string;
  email: string;
  password: string;
}): string {
  const name = input.fullName.trim() || 'hola';
  const site = publicSiteLabel();
  const loginUrl = `${publicSiteUrl().replace(/\/$/, '')}/login`;

  return [
    `¡Hola ${name}! 👋`,
    '',
    `Ya tienes acceso a *${site}*.`,
    '',
    'Tus credenciales:',
    `• Correo: ${input.email.trim()}`,
    `• Contraseña: ${input.password}`,
    '',
    `Entra aquí: ${loginUrl}`,
    '',
    'Te recomiendo cambiar la contraseña después de iniciar sesión.',
    'Si tienes dudas, responde a este mensaje.',
  ].join('\n');
}

export function whatsAppSendUrl(phoneDigits: string, message: string): string {
  const phone = normalizeWhatsAppPhone(phoneDigits);
  const text = encodeURIComponent(message);
  if (!phone) return `https://wa.me/?text=${text}`;
  return `https://wa.me/${phone}?text=${text}`;
}
