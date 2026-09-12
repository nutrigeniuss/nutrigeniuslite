import { useCallback, useMemo } from 'react';
import Recall24hEditor from './Recall24hEditor';

type Measurement = {
  date?: string | null;
  recall_24h?: unknown[];
  requirement?: { calories?: number | null; [key: string]: unknown };
  [key: string]: unknown;
};

type PatientLike = {
  measurements?: Measurement[];
  requirement?: { calories?: number | null; [key: string]: unknown };
  target_calories?: number | null;
  [key: string]: unknown;
};

type Props = {
  patient: PatientLike;
  consultIndex: number;
  onUpdate: (patch: { measurements: Measurement[] }) => Promise<boolean> | boolean;
  registerAutosave?: (handler: (() => Promise<void>) | null) => void;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Host SOLID: orquesta persistencia del R24h en la medición de sesión.
 * No conoce Supabase patients — solo el puerto onUpdate de la ficha Lite.
 */
export default function DieteticaPanel({
  patient,
  consultIndex,
  onUpdate,
  registerAutosave,
}: Props) {
  const measurement = useMemo(() => {
    const list = patient.measurements || [];
    return list[consultIndex] || { date: todayISO(), recall_24h: [] };
  }, [patient.measurements, consultIndex]);

  const targetCalories = useMemo(() => {
    const fromReq =
      Number(measurement?.requirement?.calories) ||
      Number(patient.requirement?.calories) ||
      Number(patient.target_calories) ||
      0;
    return fromReq > 0 ? fromReq : 0;
  }, [measurement, patient.requirement, patient.target_calories]);

  const persistRecall = useCallback(
    async (meals: unknown[] | null): Promise<boolean> => {
      const list = [...(patient.measurements || [])];
      while (list.length <= consultIndex) {
        list.push({ date: todayISO() });
      }
      const current = { ...(list[consultIndex] || { date: todayISO() }) };
      current.recall_24h = Array.isArray(meals) ? meals : [];
      if (!current.date) current.date = todayISO();
      list[consultIndex] = current;
      const ok = await onUpdate({ measurements: list });
      return ok !== false;
    },
    [patient.measurements, consultIndex, onUpdate],
  );

  const handleSave = useCallback(
    async (meals: unknown[]) => persistRecall(meals),
    [persistRecall],
  );

  return (
    <Recall24hEditor
      measurement={measurement}
      onSave={handleSave}
      targetCalories={targetCalories}
      registerAutosave={registerAutosave}
      wide
      embedded
    />
  );
}
