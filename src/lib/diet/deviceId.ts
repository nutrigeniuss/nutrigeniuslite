// Quién es este celular.
//
// El enlace de la dieta ya no vale por sí solo: cada celular que lo abre queda
// registrado en el servidor, y para registrarse hay que escribir la fecha de
// nacimiento del paciente. Aquí se resuelve la mitad que vive en el navegador:
// un identificador que se guarda una vez y se repite en cada visita, para que
// el paciente NO tenga que escribir su fecha cada vez que abre su plan.
//
// ESTE IDENTIFICADOR ES, EN LA PRÁCTICA, LA CONTRASEÑA DE ESTE CELULAR. Por eso
// se genera con `crypto.randomUUID()` —aleatorio de verdad— y por eso el
// servidor solo guarda su huella, nunca el valor. Quien lo copie del navegador
// del paciente entra sin la fecha; pero para copiarlo hay que tener el celular
// desbloqueado en la mano, y a esas alturas ya se está viendo la dieta.

/** Dónde vive. El nombre importa: se ve en las herramientas del navegador. */
const CLAVE_ALMACEN = 'nutrigenius.dieta.celular';

/**
 * El identificador de ESTE celular, creándolo la primera vez.
 *
 * SI EL NAVEGADOR NO DEJA GUARDAR NADA —modo incógnito, o el paciente que borra
 * los datos del sitio— devuelve uno nuevo cada vez. La consecuencia es que le
 * pedirá la fecha de nacimiento en cada visita y que irá gastando puestos de la
 * lista de tres. No se disimula: es incómodo, pero es lo honesto. Guardar la
 * dieta en la pantalla de inicio, que es lo que la propia pantalla le propone,
 * resuelve el caso de verdad.
 */
export const obtenerIdDeCelular = (): string => {
  const nuevo = (): string => {
    // `randomUUID` no existe en navegadores viejos ni fuera de https. La
    // alternativa no tiene por qué ser criptográfica para lo que aquí se usa
    // —identificar un aparato, no firmar nada—, pero sí irrepetible.
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  };

  try {
    const guardado = window.localStorage.getItem(CLAVE_ALMACEN);
    // El servidor exige entre 20 y 64 caracteres: un valor a medio escribir —o
    // manipulado a mano— se descarta y se genera otro, en vez de mandar algo
    // que el servidor va a rechazar dejando al paciente sin dieta y sin
    // explicación.
    if (guardado && /^[a-z0-9-]{20,64}$/i.test(guardado)) return guardado.toLowerCase();

    const creado = nuevo();
    window.localStorage.setItem(CLAVE_ALMACEN, creado);
    return creado;
  } catch {
    return nuevo();
  }
};

/**
 * Cómo se llamará este celular en la ficha del nutricionista.
 *
 * Es COSMÉTICO. Sirve para que el nutricionista mire la lista y reconozca las
 * filas —«esto es el suyo, esto es el icono que se guardó»— y para nada más:
 * el servidor no decide nada con esto y lo recorta antes de guardarlo, porque
 * lo manda el navegador y el navegador dice lo que quiere.
 *
 * No se usa una biblioteca de detección: son cuatro casos y lo único que se
 * pretende es que la fila no diga «Mozilla/5.0 (Linux; Android 13; SM-A155M)».
 */
export const describirEsteCelular = (): string => {
  if (typeof navigator === 'undefined') return '';

  const ua = navigator.userAgent || '';

  const sistema = /iPhone|iPad|iPod/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Macintosh/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : '';

  // Guardado en la pantalla de inicio. Es la fila que más confunde si no se
  // nombra: para el navegador es un sitio distinto del suyo de siempre, así que
  // el paciente aparece dos veces sin haber hecho nada raro.
  const instalada = typeof window !== 'undefined'
    && ((window.navigator as unknown as { standalone?: boolean }).standalone === true
      || window.matchMedia?.('(display-mode: standalone)')?.matches === true);

  if (instalada) return sistema ? `Icono guardado en ${sistema}` : 'Icono guardado';

  // El orden importa: Edge y Chrome se anuncian los dos como Chrome, y el
  // navegador interno de WhatsApp se anuncia como Chrome en Android.
  const navegador = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Navegador';

  return sistema ? `${navegador} en ${sistema}` : navegador;
};
