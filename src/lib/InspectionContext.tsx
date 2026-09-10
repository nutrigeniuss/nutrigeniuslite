// =============================================================================
// InspectionContext — "modo inspección" del titular (Pro+).
// -----------------------------------------------------------------------------
// Cuando el titular pulsa "Inspeccionar" en Mi equipo, recorre la app como si
// fuera el trabajador, pero en SOLO LECTURA. Aquí guardamos a quién inspecciona
// (en sessionStorage, para que sobreviva a recargas). Las pantallas apuntan sus
// consultas a este id; la escritura la bloquea la RLS del servidor.
// =============================================================================

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'ng_inspection_target';

type InspectionTarget = { id: string; name: string } | null;

type InspectionContextValue = {
  inspectedId: string | null;
  inspectedName: string | null;
  isInspecting: boolean;
  startInspection: (id: string, name: string) => void;
  stopInspection: () => void;
};

const readStored = (): InspectionTarget => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InspectionTarget) : null;
  } catch {
    return null;
  }
};

const DEFAULT_VALUE: InspectionContextValue = {
  inspectedId: null,
  inspectedName: null,
  isInspecting: false,
  startInspection: () => {},
  stopInspection: () => {},
};

const InspectionContext = createContext<InspectionContextValue>(DEFAULT_VALUE);

export function InspectionProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<InspectionTarget>(readStored);

  const startInspection = useCallback((id: string, name: string) => {
    const next = { id, name };
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setTarget(next);
  }, []);

  const stopInspection = useCallback(() => {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setTarget(null);
  }, []);

  return (
    <InspectionContext.Provider
      value={{
        inspectedId: target?.id ?? null,
        inspectedName: target?.name ?? null,
        isInspecting: Boolean(target),
        startInspection,
        stopInspection,
      }}
    >
      {children}
    </InspectionContext.Provider>
  );
}

// Seguro fuera del provider: devuelve el valor por defecto (no lanza).
export const useInspection = (): InspectionContextValue => useContext(InspectionContext);
