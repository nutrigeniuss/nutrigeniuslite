// Etiqueta relativa de una fecha (sin hora) para los listados de la ficha.
//
// Por qué existe: las fechas se interpretan al mediodía para evitar el
// corrimiento de un día en zonas UTC-negativas. Efecto secundario: una consulta
// registrada HOY, mirada por la mañana, quedaba en el futuro y date-fns la
// mostraba como "en alrededor de 4 horas". Se veía en el listado de Bioquímica
// y en el de Mediciones.
//
// Regla: hoy y ayer se dicen con palabras; el resto usa la distancia habitual.

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

/** Fecha local de hoy en formato YYYY-MM-DD (no UTC). */
const localToday = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const relativeDayLabel = (dateStr?: string | null): string => {
  if (!dateStr) return '';

  const isoDay = String(dateStr).slice(0, 10);
  const today = localToday();
  if (isoDay === today) return 'hoy';

  const date = new Date(`${isoDay}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';

  const yesterday = new Date(`${today}T12:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getTime() === yesterday.getTime()) return 'ayer';

  return formatDistanceToNow(date, { locale: es, addSuffix: true });
};
