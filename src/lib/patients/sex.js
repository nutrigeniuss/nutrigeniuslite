// =============================================================================
// El sexo del paciente: un solo lugar donde se interpreta ese campo.
// -----------------------------------------------------------------------------
// EN JAVASCRIPT A PROPÓSITO. Lo consumen dos mundos que no comparten compilador:
// el cliente (TypeScript, vía lib/anthropometry) y el servidor (lib/ai y
// lib/lab, que corren como función de Vercel en JS puro y no pueden importar
// TypeScript). Es la misma razón por la que labAnalytes.js está en JS.
//
// POR QUÉ HAY QUE CENTRALIZARLO. Llegó a haber CUATRO lecturas distintas del
// mismo dato y no coincidían entre sí:
//   · antropometría de adulto  → la letra "M" suelta era MUJER
//   · antropometría pediátrica → la misma "M" era VARÓN
//   · requerimiento calórico   → comparaba con la cadena exacta 'Masculino',
//                                así que "masculino" en minúscula caía en la
//                                ecuación de mujer (166 kcal de diferencia)
//   · laboratorio              → su propia copia, con la "M" como varón
// El mismo paciente podía salir de un sexo en una pestaña y del otro en la de
// al lado, arrastrando los cortes de riesgo, el peso ideal, la TMB y el rango
// de referencia de la hemoglobina.
//
// "M" ES MASCULINO Y "F" ES FEMENINO, en todos los módulos. Lo fija el
// nutricionista y no se discute por archivo: la letra es la inicial del sexo,
// como en cualquier ficha clínica. Antes la antropometría de adulto leía la "M"
// suelta como MUJER —de ahí venía media confusión— y por eso Cálculos rápidos
// tenía que convertir a la palabra completa antes de llamar a nadie.
//
// La palabra "Mujer" sigue siendo femenino: se comprueba ANTES que el patrón
// masculino, igual que "femenino" se comprueba antes que "niño" (femeNINO
// contiene "nino"). Solo la letra sola cae en la regla de la inicial.
// =============================================================================

/**
 * Normaliza el sexo del paciente a 'M' (masculino) | 'F' (femenino) | null.
 * @param {string | null | undefined} raw
 * @returns {'M' | 'F' | null}
 */
export const normalizeSexRaw = (raw) => {
  if (!raw) return null;
  // Sin tildes y en minúscula: "varón" y "varon" son el mismo dato.
  const s = String(raw).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!s) return null;

  // La inicial sola: M masculino, F femenino. Se resuelve antes que los
  // patrones de palabra para que no dependa del orden de los demás.
  if (s === 'm') return 'M';
  if (s === 'f') return 'F';
  if (s === 'v' || s === 'h') return 'M'; // varón / hombre abreviados

  // Femenino PRIMERO: "femenino" contiene "nino" y matchearía el patrón de niño.
  if (/^(femenin|female|mujer|nina|woman|girl)/.test(s)) return 'F';
  if (/^(masculin|male|hombre|varon|nino|man|boy)/.test(s)) return 'M';
  return null;
};
