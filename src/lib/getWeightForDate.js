// Utilidad para obtener el peso de un paciente en una fecha exacta
// Si no hay medición exacta, retorna null
// Cuando exista la tabla real, reemplazar fetch por consulta a Supabase

/**
 * Busca el peso del paciente para una fecha exacta (YYYY-MM-DD)
 * @param {Array<{date: string, weight: number}>} measurements - Mediciones del paciente
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {number|null} Peso en kg o null si no hay medición exacta
 */
export function getWeightForDate(measurements, date) {
  if (!Array.isArray(measurements)) return null;
  const found = measurements.find(m => m.date === date && typeof m.weight === 'number');
  return found ? found.weight : null;
}

// Ejemplo de uso:
// const peso = getWeightForDate([{date: '2026-03-26', weight: 70}], '2026-03-26'); // 70
