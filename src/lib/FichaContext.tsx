import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { clearPatientDietCache } from '@/lib/patientDietCache';
import { clearSessionDietStorage } from '@/lib/sessionDietDb';
import { SESSION_FICHA_ID } from '@/lib/sessionFicha';
import { todayLocalDateStr, toLocalDateStr } from '@/lib/weekRange';

const STORAGE_KEY = 'ng_lite_calc_ficha_v2';
const LEGACY_STORAGE_KEYS = ['ng_lite_calc_ficha_v1'];

// Borrador de trabajo en el navegador (calculadora). No es archivo clínico:
// se limpia con «Nueva ficha». Bioquímica NUNCA se persiste.

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
  /** Siempre [] en Lite: bioquímica solo en memoria de la pestaña. */
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
  /** Sube con «Nueva ficha» para remount de ConsultDetail / Bioquímica. */
  fichaRevision: number;
  updatePatient: (patch: Partial<FichaPatient>) => Promise<boolean>;
  setDietMode: (mode: DietMode) => void;
  setDietWeek: (week: DietWeekDay[] | ((prev: DietWeekDay[]) => DietWeekDay[])) => void;
  resetFicha: () => void;
};

function todayISO() {
  // Hora local (Perú UTC−5). toISOString() corría la fecha al día siguiente de noche.
  return todayLocalDateStr();
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
      dateStr: toLocalDateStr(d),
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
    id: SESSION_FICHA_ID,
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

function stripBiochemistry(patient: FichaPatient): FichaPatient {
  const { biochemistry: _drop, ...rest } = patient;
  return { ...rest, biochemistry: [] };
}

function persistablePatient(patient: FichaPatient): FichaPatient {
  return stripBiochemistry(patient);
}

function loadStored(): { patient: FichaPatient; dietMode: DietMode; dietWeek: DietWeekDay[] } {
  try {
    // Purga claves viejas que pudieron guardar bioquímica.
    for (const legacy of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(legacy);
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { patient: defaultPatient(), dietMode: 'alimentos', dietWeek: emptyWeek() };
    const parsed = JSON.parse(raw) as Partial<{ patient: FichaPatient; dietMode: DietMode; dietWeek: DietWeekDay[] }>;
    const merged = {
      ...defaultPatient(),
      ...(parsed.patient || {}),
      measurements: parsed.patient?.measurements?.length
        ? parsed.patient.measurements
        : defaultPatient().measurements,
    };
    return {
      patient: persistablePatient(merged),
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
  const [fichaRevision, setFichaRevision] = useState(0);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        // Solo paciente: dietMode/dietWeek ya no se usan (dietas en sessionDietDb).
        patient: persistablePatient(patient),
      }),
    );
  }, [patient]);

  const updatePatient = useCallback(async (patch: Partial<FichaPatient>) => {
    // Bioquímica no entra al estado de ficha ni a localStorage.
    if (patch && 'biochemistry' in patch) {
      const { biochemistry: _drop, ...rest } = patch;
      if (Object.keys(rest).length === 0) return true;
      setPatient((prev) => persistablePatient({ ...prev, ...rest }));
      return true;
    }
    setPatient((prev) => persistablePatient({ ...prev, ...patch }));
    return true;
  }, []);

  const resetFicha = useCallback(() => {
    const blank = defaultPatient();
    setPatient(blank);
    setDietMode('alimentos');
    setDietWeek(emptyWeek());
    setFichaRevision((n) => n + 1);
    try {
      for (const legacy of LEGACY_STORAGE_KEYS) localStorage.removeItem(legacy);
      localStorage.removeItem(STORAGE_KEY);
      // Dietas multi-día de la consulta: solo se borran aquí (Nueva ficha).
      clearSessionDietStorage();
      clearPatientDietCache(SESSION_FICHA_ID);
      clearPatientDietCache('');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        patient: blank,
        dietMode: 'alimentos',
        dietWeek: emptyWeek(),
      }));
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith('ng_session_diet')
          || key.startsWith('nutrigenius_session')
          || key.startsWith('ng_calc_ficha')
          || key.startsWith('ng_lite_calc_ficha')
        ) {
          localStorage.removeItem(key);
        }
      });
      // Reponer ficha limpia tras el barrido amplio.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        patient: blank,
        dietMode: 'alimentos',
        dietWeek: emptyWeek(),
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<FichaState>(() => ({
    patient,
    dietMode,
    dietWeek,
    fichaRevision,
    updatePatient,
    setDietMode,
    setDietWeek,
    resetFicha,
  }), [patient, dietMode, dietWeek, fichaRevision, updatePatient, resetFicha]);

  return <FichaContext.Provider value={value}>{children}</FichaContext.Provider>;
}

export function useFicha(): FichaState {
  const ctx = useContext(FichaContext);
  if (!ctx) throw new Error('useFicha debe usarse dentro de FichaProvider');
  return ctx;
}
