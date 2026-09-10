import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

type UseAutosaveOnLeaveOptions = {
  hasUnsavedChanges: boolean;
  onAutosave: () => Promise<void> | void;
};

export function useAutosaveOnLeave({ hasUnsavedChanges, onAutosave }: UseAutosaveOnLeaveOptions): () => Promise<void> {
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const onAutosaveRef = useRef(onAutosave);
  const isSavingRef = useRef(false);

  useLayoutEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useLayoutEffect(() => {
    onAutosaveRef.current = onAutosave;
  }, [onAutosave]);

  const flushAutosave = useCallback((): Promise<void> => {
    if (!hasUnsavedChangesRef.current || isSavingRef.current) {
      return Promise.resolve();
    }

    isSavingRef.current = true;

    return Promise.resolve(onAutosaveRef.current()).finally(() => {
      isSavingRef.current = false;
    });
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (): void => {
      void flushAutosave();
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        void flushAutosave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', flushAutosave);
    window.addEventListener('popstate', flushAutosave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // El desmontaje por cambio de interfaz no siempre pasa por pagehide; se fuerza el flush aqui.
      void flushAutosave();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', flushAutosave);
      window.removeEventListener('popstate', flushAutosave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [flushAutosave]);

  return flushAutosave;
}