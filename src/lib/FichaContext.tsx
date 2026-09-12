import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'ng_lite_calc_ficha_v1';

// Borrador de trabajo en el navegador (calculadora). No es archivo clínico:
// se limpia con «Nueva ficha». Si el usuario sale con datos, es solo sesión local.

export type FichaMeasurement = {
  date?: string;
  weight?: number | null;
  height?: number | null;
  bioimpedance?: Record<string, number | null | undefined>;
  perimeters?: Record<string, number | null | undefined>;
  skinfolds?: Record<string, number | null | undefined>;
  diameters?: Record<string, number | null | undefined>;
  requirement?: Record<string, unknown>;
  recall_24h?: unknown[];
  [key: string]: unknown;
};

export type FichaPatient = {
  id: string;
  full_name?: string;
  birth_date?: string | null;
  gender?: string | null;
  sex?: string | null;
  measurements: FichaMeasurement[];
  pregnancies?: import('@/lib/gestation/gestationalGain').PregnancyRecord[];
  biochemistry?: import('@/components/ficha/biochem/biochemConfig').LabEntry[];
  health_conditions?: { current_pathologies?: string[] };
  requirement?: Record<string, unknown>;
  reference_weights?: Record<string, unknown> | null;
};

export type DietMode = 'alimentos' | 'intercambios' | 'artificial';

export type DietDayMeal = {
  id: string;
  name: string;
  items: Array<{ id: string; name: string; amount?: string; unit?: string; kcal?: number }>;
  notes?: string;
};

export type DietWeekDay = {
  dateStr: string;
  meals: DietDayMeal[];
  exchanges?: Array<{ group: string; portions: number }>;
  artificial?: Array<{ name: string; volumeMl?: number; kcal?: number; proteinG?: number; notes?: string }>;
};

type FichaState = {
  patient: FichaPatient;
  dietMode: DietMode;
  dietWeek: DietWeekDay[];
  updatePatient: (patch: Partial<FichaPatient>) => Promise<boolean>;
  setDietMode: (mode: DietMode) => void;
  setDietWeek: (week: DietWeekDay[] | ((prev: DietWeekDay[]) => DietWeekDay[])) => void;
  resetFicha: () => void;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyWeek(): DietWeekDay[] {
  const start = new Date();
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  const meals = () => ([
    { id: 'des', name: 'Desayuno', items: [] },
    { id: 'am', name: 'Media mañana', items: [] },
    { id: 'al', name: 'Almuerzo', items: [] },
    { id: 'pm', name: 'Media tarde', items: [] },
    { id: 'ce', name: 'Cena', items: [] },
  ]);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      dateStr: d.toISOString().slice(0, 10),
      meals: meals(),
      exchanges: [
        { group: 'Cereales', portions: 0 },
        { group: 'Frutas', portions: 0 },
        { group: 'Verduras', portions: 0 },
        { group: 'Lácteos', portions: 0 },
        { group: 'Carnes', portions: 0 },
        { group: 'Grasas', portions: 0 },
      ],
      artificial: [],
    };
  });
}

function defaultPatient(): FichaPatient {
  return {
    id: 'session-ficha',
    full_name: 'Consulta rápida',
    birth_date: null,
    gender: 'Femenino',
    sex: 'Femenino',
    measurements: [{ date: todayISO() }],
    pregnancies: [],
    biochemistry: [],
    health_conditions: {},
    requirement: {},
    reference_weights: null,
  };
}

function loadStored(): { patient: FichaPatient; dietMode: DietMode; dietWeek: DietWeekDay[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { patient: defaultPatient(), dietMode: 'alimentos', dietWeek: emptyWeek() };
    const parsed = JSON.parse(raw) as Partial<{ patient: FichaPatient; dietMode: DietMode; dietWeek: DietWeekDay[] }>;
    return {
      patient: { ...defaultPatient(), ...(parsed.patient || {}), measurements: parsed.patient?.measurements?.length ? parsed.patient.measurements : defaultPatient().measurements },
      dietMode: parsed.dietMode || 'alimentos',
      dietWeek: parsed.dietWeek?.length ? parsed.dietWeek : emptyWeek(),
    };
  } catch {
    return { patient: defaultPatient(), dietMode: 'alimentos', dietWeek: emptyWeek() };
  }
}

const FichaContext = createContext<FichaState | null>(null);

export function FichaProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadStored(), []);
  const [patient, setPatient] = useState<FichaPatient>(initial.patient);
  const [dietMode, setDietMode] = useState<DietMode>(initial.dietMode);
  const [dietWeek, setDietWeek] = useState<DietWeekDay[]>(initial.dietWeek);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ patient, dietMode, dietWeek }));
  }, [patient, dietMode, dietWeek]);

  const updatePatient = useCallback(async (patch: Partial<FichaPatient>) => {
    setPatient((prev) => ({ ...prev, ...patch }));
    return true;
  }, []);

  const resetFicha = useCallback(() => {
    const blank = defaultPatient();
    setPatient(blank);
    setDietMode('alimentos');
    setDietWeek(emptyWeek());
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        patient: blank,
        dietMode: 'alimentos',
        dietWeek: emptyWeek(),
      }));
      // Dietas de sesión y caches locales de la ficha.
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith('ng_session_diet')
          || key.startsWith('nutrigenius_session')
          || key.startsWith('ng_calc_ficha')
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<FichaState>(() => ({
    patient,
    dietMode,
    dietWeek,
    updatePatient,
    setDietMode,
    setDietWeek,
    resetFicha,
  }), [patient, dietMode, dietWeek, updatePatient, resetFicha]);

  return <FichaContext.Provider value={value}>{children}</FichaContext.Provider>;
}

export function useFicha(): FichaState {
  const ctx = useContext(FichaContext);
  if (!ctx) throw new Error('useFicha debe usarse dentro de FichaProvider');
  return ctx;
}
