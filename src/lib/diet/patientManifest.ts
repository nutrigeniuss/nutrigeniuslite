// Manifiesto de "aplicación" para la dieta del paciente.
//
// El manifiesto que ya existe en public/ es el de la aplicación del
// NUTRICIONISTA: se llama NutriGenius y arranca en «/». Si el paciente usara
// ese, tendría en su celular un icono llamado NutriGenius que le abre la página
// de inicio del profesional, no su dieta.
//
// Por eso aquí se arma uno propio y se enchufa solo en esta pantalla:
//   · Arranca en SU enlace, con su clave.
//   · Lleva el nombre del consultorio, no el de la aplicación. El icono que se
//     guarda en el celular dice el nombre de su nutricionista.
//
// Se construye como blob en el navegador porque la clave es distinta para cada
// paciente y no hay un archivo estático que sirva para todos.
//
// EN IPHONE ESTO NO BASTA. Apple no permite que una web ofrezca un botón de
// instalar: el usuario tiene que hacer Compartir → Añadir a pantalla de inicio.
// El manifiesto no estorba allí, pero quien decide qué se muestra es la propia
// pantalla (ver el aviso de PatientDietView).

export type PatientManifestInput = {
  shareKey: string;
  brandName?: string | null;
  brandLogoUrl?: string | null;
};

/**
 * La dirección del manifiesto de este paciente.
 *
 * Lo sirve `api/manifest-dieta.js`. NO se arma como blob en el navegador: la
 * política de seguridad del sitio lleva `manifest-src 'self'`, que no admite
 * `blob:`. Con el blob, el navegador descartaba el manifiesto en silencio —en
 * desarrollo funcionaba, porque ahí no se aplica esa política— y sin manifiesto
 * válido Chrome no ofrece instalar nunca.
 */
export const patientManifestHref = ({ shareKey, brandName }: PatientManifestInput): string => {
  const parametros = new URLSearchParams({ clave: shareKey });
  const nombre = (brandName || '').trim();
  if (nombre) parametros.set('marca', nombre);
  return `/api/manifest-dieta?${parametros.toString()}`;
};

/**
 * Enchufa el manifiesto del paciente en el documento y devuelve la función que
 * lo retira. Deja el manifiesto original en su sitio al salir: si no, volver a
 * la aplicación del nutricionista dejaría la pestaña sin manifiesto.
 */
export const attachPatientManifest = (input: PatientManifestInput): (() => void) => {
  if (typeof document === 'undefined') return () => {};

  const existente = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  const anterior = existente?.getAttribute('href') ?? null;

  const link = existente ?? document.createElement('link');
  link.rel = 'manifest';
  link.setAttribute('href', patientManifestHref(input));
  if (!existente) document.head.appendChild(link);

  return () => {
    if (existente && anterior) existente.setAttribute('href', anterior);
    else link.remove();
  };
};

/** Detecta iPhone/iPad, donde no hay botón de instalar y hay que explicarlo. */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ se anuncia como Mac; se distingue por tener pantalla táctil.
  const iPadModerno = /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
  return /iPad|iPhone|iPod/.test(ua) || iPadModerno;
};

/** Ya está abierto como aplicación instalada: no hay que ofrecer instalarla. */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
};
