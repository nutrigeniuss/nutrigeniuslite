// Semanas de lunes a domingo, calculadas SIEMPRE en hora local.
//
// Estas funciones existen por dos fallos reales de la impresión semanal:
//
//   1. `new Date().toISOString().split('T')[0]` daba la fecha en UTC. Perú va
//      cinco horas por detrás, así que un domingo a las 20:00 locales ya era
//      lunes en UTC: el sistema imprimía la semana siguiente. Cualquier
//      conversión con toISOString tiene el mismo problema, de ahí que aquí se
//      arme la cadena a mano con getFullYear/getMonth/getDate.
//
//   2. `new Date('2026-08-10')` NO es el 10 de agosto local: el formato corto
//      lo interpreta el motor como medianoche UTC, que en Perú son las 19:00
//      del día 9. Al pedirle el día de la semana devolvía el anterior y la
//      semana salía corrida un día. Por eso `parseLocalDate` construye la
//      fecha con el constructor de tres argumentos, que sí es local.
//
// Todo lo de aquí es puro: sin React, sin base de datos, comprobable.

export type WeekRange = {
  /** Lunes de la semana, 'YYYY-MM-DD'. */
  start: string;
  /** Domingo de la semana, 'YYYY-MM-DD'. */
  end: string;
  /** Los siete días, de lunes a domingo. */
  days: string[];
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const pad = (value: number): string => String(value).padStart(2, '0');

/** Fecha local en 'YYYY-MM-DD'. Nunca uses toISOString para esto. */
export const toLocalDateStr = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Hoy, en hora local. */
export const todayLocalDateStr = (): string => toLocalDateStr(new Date());

/**
 * Convierte 'YYYY-MM-DD' en un Date a medianoche LOCAL.
 * Devuelve null si la cadena no tiene ese formato o no es una fecha real
 * (un 31 de febrero, por ejemplo, que el constructor desbordaría a marzo).
 */
export const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  // El constructor desborda en silencio (32 de enero → 1 de febrero). Si al
  // releerlo no coincide, la fecha original no existía.
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const addDaysLocal = (date: Date, amount: number): Date => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
};

/**
 * La semana (lunes a domingo) que contiene `dateStr`.
 * Con una fecha inválida cae en la semana de hoy, que es lo menos sorprendente
 * para el que está delante: ve algo, no una pantalla rota.
 */
export const weekRangeOf = (dateStr: string | null | undefined): WeekRange => {
  const anchor = parseLocalDate(dateStr) ?? parseLocalDate(todayLocalDateStr()) ?? new Date();

  // getDay(): 0 = domingo … 6 = sábado. Para anclar al LUNES hay que restar
  // (getDay + 6) % 7, que manda el domingo seis días atrás en vez de dejarlo
  // abriendo su propia semana.
  const monday = addDaysLocal(anchor, -(((anchor.getDay() + 6) % 7)));
  const days = Array.from({ length: 7 }, (_, index) => toLocalDateStr(addDaysLocal(monday, index)));

  return { start: days[0], end: days[6], days };
};

/** Salta `delta` semanas (negativo hacia atrás) conservando el lunes. */
export const shiftWeek = (dateStr: string | null | undefined, delta: number): string => {
  const { start } = weekRangeOf(dateStr);
  const monday = parseLocalDate(start);
  if (!monday) return todayLocalDateStr();
  return toLocalDateStr(addDaysLocal(monday, delta * 7));
};

/**
 * Etiqueta legible del rango: «10 – 16 de agosto de 2026».
 * Repite mes o año solo cuando la semana los cruza, para no leer dos veces lo
 * mismo en el caso habitual.
 */
export const formatWeekRange = (range: WeekRange): string => {
  const start = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  if (!start || !end) return '';

  const mismoAnio = start.getFullYear() === end.getFullYear();
  const mismoMes = mismoAnio && start.getMonth() === end.getMonth();

  if (mismoMes) {
    return `${start.getDate()} – ${end.getDate()} de ${MESES[end.getMonth()]} de ${end.getFullYear()}`;
  }

  if (mismoAnio) {
    return `${start.getDate()} de ${MESES[start.getMonth()]} – ${end.getDate()} de ${MESES[end.getMonth()]} de ${end.getFullYear()}`;
  }

  return `${start.getDate()} de ${MESES[start.getMonth()]} de ${start.getFullYear()} – ${end.getDate()} de ${MESES[end.getMonth()]} de ${end.getFullYear()}`;
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** «13 de agosto de 2026». Cadena vacía si la fecha no es válida. */
export const formatLongDate = (dateStr: string | null | undefined): string => {
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  return `${date.getDate()} de ${MESES[date.getMonth()]} de ${date.getFullYear()}`;
};

/** «Jueves 13», para encabezar el panel del día. */
export const formatDayTitle = (dateStr: string | null | undefined): string => {
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  return `${DIAS[date.getDay()]} ${date.getDate()}`;
};

/** «Viernes 14 de agosto», para las listas de dietas que se pueden copiar. */
export const formatDayWithMonth = (dateStr: string | null | undefined): string => {
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  return `${DIAS[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]}`;
};

/** «Agosto 2026», para la cabecera del mes. */
export const formatMonthTitle = (dateStr: string | null | undefined): string => {
  const date = parseLocalDate(dateStr);
  if (!date) return '';
  const mes = MESES[date.getMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${date.getFullYear()}`;
};

/** Versión corta para el botón: «del 10 al 16». */
export const formatWeekRangeShort = (range: WeekRange): string => {
  const start = parseLocalDate(range.start);
  const end = parseLocalDate(range.end);
  if (!start || !end) return '';

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `del ${start.getDate()} al ${end.getDate()}`;
  }
  return `del ${start.getDate()} de ${MESES[start.getMonth()]} al ${end.getDate()} de ${MESES[end.getMonth()]}`;
};
