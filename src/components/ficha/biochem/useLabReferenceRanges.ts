import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import type { LabRange } from './biochemConfig';

export type AccountRanges = Record<string, LabRange>;

const storageKey = (userId: string) => `ng_calc_lab_ranges_${userId}`;

/** Rangos propios del nutri (“mi laboratorio”), en localStorage (Lite Calc). */
export function useLabReferenceRanges(): {
  ranges: AccountRanges;
  loading: boolean;
  saveRange: (key: string, range: LabRange | null) => Promise<void>;
} {
  const { user } = useAuth();
  const [ranges, setRanges] = useState<AccountRanges>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setRanges({});
      setLoading(false);
      return;
    }
    try {
      const raw = localStorage.getItem(storageKey(user.id));
      setRanges(raw ? (JSON.parse(raw) as AccountRanges) : {});
    } catch {
      setRanges({});
    }
    setLoading(false);
  }, [user?.id]);

  const saveRange = useCallback(async (key: string, range: LabRange | null): Promise<void> => {
    if (!user?.id) return;
    setRanges((prev) => {
      const next: AccountRanges = { ...prev };
      if (range && (range.min != null || range.max != null)) next[key] = range;
      else delete next[key];
      localStorage.setItem(storageKey(user.id), JSON.stringify(next));
      return next;
    });
  }, [user?.id]);

  return { ranges, loading, saveRange };
}
