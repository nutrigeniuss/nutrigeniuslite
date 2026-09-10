// Constantes y cálculos puros del calculador de NAF/MET (compendio MET).
import { MET_CATALOG } from '../metCatalog.generated';
import type {
  DayMetrics,
  MetDay,
  NafCalculation,
  QuickDurationOption,
  QuickTemplate,
  SelectedActivity,
} from './types';

export const MAX_MET_DAYS = 7;

// La búsqueda ignora tildes para que el usuario encuentre rápido actividades extensas del compendio MET.
export const normalizeSearchValue = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export const roundToTwo = (value: number): number => Math.round(value * 100) / 100;
export const roundToOne = (value: number): number => Math.round(value * 10) / 10;

export const CATEGORIES = [...new Set(MET_CATALOG.map((item) => item.cat))];

export const CATEGORY_LABELS: Record<string, string> = {
  'Ejercicio de acondicionamiento': 'Acondicionamiento físico',
  'Actividades acuáticas': 'Deportes acuáticos',
  'Actividades en casa': 'Actividades domésticas',
  'Ocupación': 'Ocupaciones laborales',
  'Cuidados personales': 'Actividades de autocuidado',
  'Inactividad': 'Descanso y sueño',
  'Caminando': 'Caminar',
  'Césped y jardín': 'Jardinería',
};

export const CATEGORY_PRIORITY = [
  'Ciclismo',
  'Ejercicio de acondicionamiento',
  'Correr',
  'Caminando',
  'Actividades acuáticas',
  'Actividades en casa',
  'Ocupación',
  'Cuidados personales',
  'Inactividad',
  'Baile',
  'Césped y jardín',
  'Deportes',
  'Transporte',
  'Actividades de invierno',
  'Pesca y caza',
  'Reparación del hogar',
  'Actividades de voluntariado',
  'Actividades religiosas',
  'Actividad sexual',
  'Juegos de vídeo',
  'Música sonando',
  'Misceláneas',
];

// ── Tipos de actividad, para colorear el día ────────────────────────────────
// Las 22 categorías del compendio se agrupan en seis tipos, que son los que
// pintan la barra de 24 h y el borde de cada fila.
//
// POR QUÉ POR TIPO Y NO POR INTENSIDAD. La barra se coloreaba según los MET, y
// el día de una persona normal es entero de menos de 3 MET (dormir, oficina,
// televisión): salía de un solo color de punta a punta, sin decir nada. El tipo
// de actividad SÍ cambia a lo largo del día, y es justo lo que pregunta el
// título de la barra: en qué se le van las horas. La intensidad no se pierde —
// cada fila lleva su MET y el catálogo colorea la insignia con la escala.
//
// Los seis colores están validados para daltonismo y para contraste sobre fondo
// claro (ninguna pareja se confunde); no se cambian de a uno sin volver a
// comprobarlos. El gris queda RESERVADO para las horas sin asignar.
export type ActivityGroup = { id: string; label: string; color: string };

export const ACTIVITY_GROUPS: ActivityGroup[] = [
  { id: 'descanso', label: 'Descanso', color: '#4a3aa7' },
  { id: 'trabajo', label: 'Trabajo', color: '#2a78d6' },
  { id: 'casa', label: 'Casa y cuidado', color: '#1baf7a' },
  { id: 'traslados', label: 'Traslados', color: '#eda100' },
  { id: 'ejercicio', label: 'Ejercicio', color: '#ff5c57' },
  { id: 'ocio', label: 'Ocio y otras', color: '#b5379a' },
];

const CATEGORY_GROUP: Record<string, string> = {
  'Inactividad': 'descanso',
  'Ocupación': 'trabajo',
  'Actividades en casa': 'casa',
  'Cuidados personales': 'casa',
  'Reparación del hogar': 'casa',
  'Césped y jardín': 'casa',
  'Transporte': 'traslados',
  'Ciclismo': 'ejercicio',
  'Correr': 'ejercicio',
  'Caminando': 'ejercicio',
  'Ejercicio de acondicionamiento': 'ejercicio',
  'Actividades acuáticas': 'ejercicio',
  'Actividades de invierno': 'ejercicio',
  'Deportes': 'ejercicio',
  'Baile': 'ejercicio',
};

/** Tipo de actividad de una categoría del compendio. Lo no clasificado es ocio. */
export const getActivityGroup = (category: string): ActivityGroup => {
  const id = CATEGORY_GROUP[category] ?? 'ocio';
  return ACTIVITY_GROUPS.find((group) => group.id === id) ?? ACTIVITY_GROUPS[ACTIVITY_GROUPS.length - 1];
};

export const QUICK_DURATION_OPTIONS: QuickDurationOption[] = [
  { label: '15m', hours: 0, mins: 15 },
  { label: '30m', hours: 0, mins: 30 },
  { label: '1h', hours: 1, mins: 0 },
  { label: '2h', hours: 2, mins: 0 },
  { label: '8h', hours: 8, mins: 0 },
];

// NO HAY AQUÍ UNA ESCALA DE CATEGORÍAS (Sedentario / Ligero / Moderado...).
//
// La había: clasificaba el NAF en cinco tramos y de ahí salía la etiqueta que
// se mostraba junto al número. Se retiró porque NO SE PUDO CITAR SU ORIGEN.
// Sus cortes no coinciden con los de la FAO/OMS/UNU -que sitúa el sedentarismo
// hasta 1,55 mientras esta tabla lo cortaba en 1,39- ni con ninguna otra
// referencia identificable.
//
// Un paciente con NAF 1,43 salía etiquetado "Ligero" por esa tabla y sería
// "sedentario" según la FAO. Poner una etiqueta clínica que nadie puede
// respaldar es peor que no poner ninguna: el NAF numérico se defiende solo,
// porque sale de las horas que el propio nutricionista cargó.
//
// Si se quiere recuperar, hay que decidir antes QUÉ referencia se adopta y
// citarla, como se hace con Gallagher, Frisancho o Kerr en el resto del módulo.

// Cada plantilla suma 24 h para que el NAF (Σ MET·h / 24) sea representativo.
// Los `match`/`category` deben coincidir con nombres reales del compendio MET
// (ver metCatalog.generated.ts); resolveTemplateActivities los busca por
// substring insensible a tildes.
export const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: 'sedentario',
    label: 'Día sedentario',
    // La descripción se muestra bajo el nombre de la plantilla, junto al NAF
    // REAL que calcula la tarjeta: repetirlo aquí como "(NAF ≈ 1.2)" era decir
    // dos veces lo mismo, y encima aproximado.
    description: 'Sueño, oficina y ocio. Sin ejercicio.',
    items: [
      { match: 'Durmiendo', category: 'Inactividad', hours: 8, mins: 0 },
      { match: 'Asearse, lavarse las manos', category: 'Cuidados personales', hours: 0, mins: 30 },
      { match: 'Sentado, trabajando con la computadora', category: 'Ocupación', hours: 8, mins: 0 },
      { match: 'Sentado: hablar en persona', category: 'Misceláneas', hours: 3, mins: 0 },
      { match: 'mira la televisión', category: 'Inactividad', hours: 2, mins: 30 },
      { match: 'Viajar en autobús o tren', category: 'Transporte', hours: 1, mins: 0 },
      { match: 'Cocinar o preparar alimentos: de pie', category: 'Actividades en casa', hours: 1, mins: 0 },
    ],
  },
  {
    id: 'laboral',
    label: 'Día laboral',
    description: 'Oficina, traslados a pie y tareas de casa.',
    items: [
      { match: 'Durmiendo', category: 'Inactividad', hours: 7, mins: 30 },
      { match: 'Asearse, lavarse las manos', category: 'Cuidados personales', hours: 0, mins: 30 },
      { match: 'Sentado, trabajando con la computadora', category: 'Ocupación', hours: 8, mins: 0 },
      { match: 'Caminar para transportarse', category: 'Transporte', hours: 1, mins: 30 },
      { match: 'Actividad de cocina, general', category: 'Actividades en casa', hours: 1, mins: 0 },
      { match: 'Cocinar o preparar alimentos: de pie', category: 'Actividades en casa', hours: 1, mins: 0 },
      { match: 'mira la televisión', category: 'Inactividad', hours: 3, mins: 0 },
      { match: 'Sentado: hablar en persona', category: 'Misceláneas', hours: 1, mins: 30 },
    ],
  },
  {
    id: 'activo',
    label: 'Día activo',
    description: 'Gimnasio y cardio, además de la jornada.',
    items: [
      { match: 'Durmiendo', category: 'Inactividad', hours: 7, mins: 30 },
      { match: 'Asearse, lavarse las manos', category: 'Cuidados personales', hours: 0, mins: 30 },
      { match: 'Sentado, trabajando con la computadora', category: 'Ocupación', hours: 6, mins: 0 },
      { match: 'Ejercicio en gimnasios, general', category: 'Ejercicio de acondicionamiento', hours: 1, mins: 0 },
      { match: 'Ciclismo, general', category: 'Ciclismo', hours: 1, mins: 0 },
      { match: 'Caminar, de 3,5 a 3,9 mph', category: 'Caminando', hours: 1, mins: 0 },
      { match: 'Cocinar o preparar alimentos: de pie', category: 'Actividades en casa', hours: 1, mins: 0 },
      { match: 'Sentado: hablar en persona', category: 'Misceláneas', hours: 3, mins: 0 },
      { match: 'mira la televisión', category: 'Inactividad', hours: 3, mins: 0 },
    ],
  },
];

export const EMPTY_CALCULATION: NafCalculation = {
  naf: 0,
  factor: 1.0,
  totalMetHours: 0,
};

export const EMPTY_DAY_METRICS: DayMetrics = {
  baseCalculation: EMPTY_CALCULATION,
  correctedCalculation: EMPTY_CALCULATION,
  totalHours: 0,
};

export const getCategoryLabel = (category: string): string => CATEGORY_LABELS[category] || category;

export const getCategoryChipClassName = (isActive: boolean): string => {
  return `rounded-full border px-2.5 py-1 text-[11px] leading-tight font-medium transition-all duration-200 ${isActive
    ? 'border-brand-500 bg-brand-500 text-white ring-2 ring-brand-50 shadow-[0_4px_12px_rgba(59,95,235,0.16)]'
    : 'border-slate-200 bg-white text-slate-500 hover:border-brand-200 hover:text-brand-700'}`;
};

/**
 * Ajusta un valor MET del compendio al metabolismo real del paciente.
 *
 * El compendio asume la convención 1 MET = 1 kcal/kg/h, válida para un adulto
 * promedio. El gasto real en reposo de ESTE paciente es GEB / (24 × peso), que
 * puede estar bastante por debajo o por encima de 1. Dividir el MET por ese
 * valor reexpresa la actividad en múltiplos de SU reposo, no del reposo teórico.
 *
 * Ejemplo: si su reposo real es 0.9 kcal/kg/h, una actividad de 4 MET le exige
 * 4/0.9 = 4.4 veces su propio basal. En obesidad o adulto mayor la diferencia
 * mueve el NAF de forma apreciable.
 *
 * Devuelve null si falta GEB o peso: sin ellos no hay corrección posible y el
 * llamador se queda con el MET del compendio.
 */
export const calcMetCorregido = (met: number, geb: number, weight: number): number | null => {
  if (!geb || !weight || weight <= 0) return null;
  const gastoRealReposo = geb / (24 * weight);
  if (gastoRealReposo <= 0) return null;
  return roundToTwo(met / gastoRealReposo);
};

/**
 * NAF calculado → factor de actividad clásico (1.2 · 1.375 · 1.55 · 1.725 · 1.9),
 * el que multiplica al GEB en las ecuaciones de requerimiento.
 *
 * Son dos escalas distintas y por eso hay una traducción: el NAF sale del día
 * tipo del paciente y es continuo, mientras que la pestaña "Por nivel de
 * actividad" ofrece esos cinco escalones sueltos.
 *
 * OJO: ESTO NO SIRVE PARA CALCULAR EL GASTO. Redondear a un escalón tira la
 * precisión que se gana cargando el día hora a hora, que es todo el motivo de
 * usar el compendio MET. Un NAF de 1.39 y otro de 1.21 caen en el mismo 1.2, y
 * con un basal de 1742 kcal eso son más de 300 kcal de diferencia. El gasto se
 * calcula SIEMPRE con el NAF exacto.
 *
 * Los cinco escalones tampoco tienen fuente citada, igual que la escala de
 * categorías que se retiró. Están aquí porque la pestaña "Por nivel" los usa;
 * decidir si se sustituyen por los tramos de la FAO/OMS/UNU está pendiente.
 */
export const getFactorForNAF = (naf: number): number => {
  if (naf < 1.4) return 1.2;
  if (naf < 1.6) return 1.375;
  if (naf < 1.9) return 1.55;
  if (naf < 2.5) return 1.725;
  return 1.9;
};

/**
 * Cierra el cálculo de un día: NAF, su rango, el factor y las MET·h totales.
 *
 * La división entre 24 es la razón por la que el día tipo DEBE cubrir las 24
 * horas. Si el nutricionista solo carga las 8 h de trabajo, las 16 restantes
 * cuentan como cero y el NAF sale artificialmente bajo — no como "sin datos".
 */
export const buildCalculation = (sum: number): NafCalculation => {
  const nafValue = sum / 24;

  return {
    naf: roundToTwo(nafValue),
    factor: nafValue > 0 ? getFactorForNAF(nafValue) : 1.0,
    totalMetHours: roundToOne(sum),
  };
};

/**
 * Métricas de un día tipo, en sus DOS versiones a la vez: con el MET del
 * compendio y con el MET corregido por el metabolismo del paciente.
 *
 * Se calculan ambas siempre para que alternar el interruptor en pantalla sea
 * instantáneo y para poder comparar. Si falta GEB o peso, la versión corregida
 * cae a la base en lugar de quedar vacía, y la interfaz oculta el interruptor.
 */
export const calculateDayMetrics = (activities: SelectedActivity[], basalKcal?: number | null, weight?: number | null): DayMetrics => {
  const correctedAvailable = !!(basalKcal && weight);
  const baseSum = activities.reduce((accumulator, activity) => {
    const hours = (activity.hours || 0) + (activity.mins || 0) / 60;
    return accumulator + activity.met * hours;
  }, 0);

  const correctedSum = activities.reduce((accumulator, activity) => {
    const hours = (activity.hours || 0) + (activity.mins || 0) / 60;
    const metValue = correctedAvailable ? (calcMetCorregido(activity.met, basalKcal as number, weight as number) ?? activity.met) : activity.met;
    return accumulator + metValue * hours;
  }, 0);

  const totalHours = activities.reduce((accumulator, activity) => accumulator + (activity.hours || 0) + (activity.mins || 0) / 60, 0);

  return {
    baseCalculation: buildCalculation(baseSum),
    correctedCalculation: buildCalculation(correctedAvailable ? correctedSum : baseSum),
    totalHours: roundToTwo(totalHours),
  };
};

export const resolveTemplateActivities = (template: QuickTemplate): SelectedActivity[] => {
  return template.items.map((entry) => {
    const matchText = normalizeSearchValue(entry.match);
    const categoryText = entry.category ? normalizeSearchValue(entry.category) : '';
    const found = MET_CATALOG.find((item) => {
      const matchesActivity = normalizeSearchValue(item.act).includes(matchText);
      const matchesCategory = !categoryText || normalizeSearchValue(item.cat).includes(categoryText);
      return matchesActivity && matchesCategory;
    });

    return found ? { ...found, hours: entry.hours, mins: entry.mins } : null;
  }).filter(Boolean) as SelectedActivity[];
};

// ── Reparto de la semana ────────────────────────────────────────────────────
// Cada perfil de día declara CUÁNTOS DÍAS de la semana representa, y el NAF que
// se aplica es el promedio ponderado por ese número.
//
// Por qué: el promedio simple afirma, sin decirlo, que el paciente vive la
// misma cantidad de días en cada perfil. Con "día de entreno" (NAF 2.10) y "día
// normal" (1.30) daba 1.70 — como si entrenara tres días y medio a la semana.
// Ponderando 2 y 5 da 1.53. Con un basal de 1701 kcal son 289 kcal diarias de
// diferencia, siempre sobreestimando: el día excepcional, que es justo el que
// más trabajo cuesta cargar, es el que inflaba el resultado.
//
// El valor por defecto es 1 para todos, y con eso el resultado es idéntico al
// del promedio simple anterior.
export const DEFAULT_WEEK_DAYS = 1;
export const MAX_WEEK_DAYS = 7;

/**
 * Hasta cuántos días puede llegar ESTE perfil sin que la semana pase de siete.
 *
 * El tope de 1–7 se aplicaba a cada perfil por separado, pero no a la suma: con
 * siete perfiles se podía declarar una semana de 49 días. La pantalla lo avisaba
 * ("15 / 7 días") pero dejaba hacerlo igual.
 *
 * No da un número absurdo —el promedio ponderado se normaliza por el total—,
 * pero sí uno que NO corresponde a la semana que el nutricionista cree haber
 * descrito: marcar 3 días de "día activo" sobre un total de 15 hace que ese
 * perfil pese el 20 % en vez del 43 % que él quiso.
 *
 * Nunca devuelve menos de 1: un perfil que no representa ningún día no tendría
 * sentido, y si los datos ya vienen pasados de siete (guardados antes de este
 * arreglo) se puede seguir BAJANDO, solo no subir.
 */
export const getMaxWeekDaysFor = (days: MetDay[], dayId: string): number => {
  const ocupadoPorLosDemas = days.reduce(
    (suma, day) => (day.id === dayId ? suma : suma + getWeekDays(day)),
    0,
  );

  return Math.max(DEFAULT_WEEK_DAYS, MAX_WEEK_DAYS - ocupadoPorLosDemas);
};

/**
 * Aplica el "+1 / −1 día" de un perfil respetando la semana de siete.
 *
 * Al SUBIR se descuenta lo que ya ocupan los demás perfiles. Al BAJAR solo se
 * respeta el mínimo de 1, para que unos datos ya pasados de siete —guardados
 * antes de este arreglo— se puedan corregir de a poco en vez de saltar a 1.
 */
export const applyWeekDaysChange = (days: MetDay[], dayId: string, delta: number): MetDay[] => {
  const tope = delta > 0 ? getMaxWeekDaysFor(days, dayId) : MAX_WEEK_DAYS;

  return days.map((day) => (day.id === dayId
    ? { ...day, weekDays: Math.min(tope, Math.max(DEFAULT_WEEK_DAYS, getWeekDays(day) + delta)) }
    : day));
};

/** Días de semana de un perfil, acotados a 1–7. Ausente o inválido → 1. */
export const getWeekDays = (day: Pick<MetDay, 'weekDays'>): number => {
  const value = Math.round(day.weekDays ?? DEFAULT_WEEK_DAYS);
  if (!Number.isFinite(value)) return DEFAULT_WEEK_DAYS;
  return Math.min(MAX_WEEK_DAYS, Math.max(DEFAULT_WEEK_DAYS, value));
};

/**
 * Promedio ponderado de los perfiles de día: el NAF que se aplica al
 * requerimiento.
 *
 * Se promedian los NAF YA REDONDEADOS de cada día, que es lo que hacía el
 * promedio simple y lo que se ve en pantalla junto a cada pestaña: así el
 * número de la barra de resultado se puede reconstruir a mano desde los que
 * muestra la cabecera.
 */
export const buildAverageCalculation = (
  entries: Array<{ calculation: NafCalculation; weekDays: number }>,
): NafCalculation => {
  if (!entries.length) return EMPTY_CALCULATION;

  const totalWeight = entries.reduce(
    (accumulator, entry) => accumulator + Math.max(DEFAULT_WEEK_DAYS, entry.weekDays),
    0,
  );
  if (totalWeight <= 0) return EMPTY_CALCULATION;

  const weighted = (pick: (calculation: NafCalculation) => number): number => entries.reduce(
    (accumulator, entry) => accumulator + pick(entry.calculation) * Math.max(DEFAULT_WEEK_DAYS, entry.weekDays),
    0,
  ) / totalWeight;

  const averageNaf = weighted((calculation) => calculation.naf);

  return {
    naf: roundToTwo(averageNaf),
    factor: averageNaf > 0 ? getFactorForNAF(averageNaf) : 1.0,
    totalMetHours: roundToOne(weighted((calculation) => calculation.totalMetHours)),
  };
};

export const getNextDayNumber = (days: MetDay[]): number => {
  const numericLabels = days
    .map((day) => /^Día (\d+)$/.exec(day.label)?.[1])
    .map((value) => (value ? parseInt(value, 10) : null))
    .filter((value): value is number => Number.isFinite(value));

  return numericLabels.length ? Math.max(...numericLabels) + 1 : days.length + 1;
};

export const createMetDay = (index: number): MetDay => ({
  id: `met-day-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: `Día ${index}`,
  activities: [],
  weekDays: DEFAULT_WEEK_DAYS,
});
