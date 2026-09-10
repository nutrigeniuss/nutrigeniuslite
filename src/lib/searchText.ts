// Normalización de texto para búsquedas tolerantes a tildes.
//
// Objetivo: que buscar "higado" encuentre "hígado" (y viceversa). Descompone
// los caracteres acentuados (NFD) y elimina los signos diacríticos combinantes
// (rango Unicode U+0300–U+036F), luego pasa a minúsculas y colapsa espacios.
// Así el término tecleado y el nombre del alimento se comparan sobre la misma
// forma "plana".
//
// Nota: la ñ se descompone a n + tilde combinante (U+0303), que también se
// elimina — es el comportamiento deseado para catálogos de alimentos en
// español, donde "ñoqui"/"noqui" deben coincidir igual que hígado/higado.
export const normalizeSearchText = (value: string | null | undefined): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
