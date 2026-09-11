// Datos de contacto / pago manual de NutriGenius Lite.
// Un solo módulo: landing, awaiting-access y CTAs leen de aquí.

export const LITE_PLANS = [
  { months: 1, label: '1 mes', priceLabel: 'S/ 30', price: 30 },
  { months: 2, label: '2 meses', priceLabel: 'S/ 50', price: 50 },
  { months: 3, label: '3 meses', priceLabel: 'S/ 70', price: 70 },
] as const;

export const LITE_PAYMENT = {
  /** WhatsApp de contacto (formato legible). */
  contactPhoneDisplay: '910 249 582',
  /** Yape (número a yapear). */
  yapePhone: '935 055 012',
  holderName: 'Edhel Josue Romero Huayllani',
  /** Cuenta BCP soles. */
  bcpAccount: '19194056382044',
  /** CCI / cuenta interbancaria. */
  cci: '00219119405638204454',
  /** wa.me: código país PE + WhatsApp sin espacios. */
  whatsappNotify: '51910249582',
  /** Resumen corto para CTAs (plan de entrada). */
  priceLabel: 'desde S/ 30',
  currency: 'PEN',
  plans: LITE_PLANS,
} as const;
