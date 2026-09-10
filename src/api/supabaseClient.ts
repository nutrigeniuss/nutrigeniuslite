import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { supabase as appSupabase } from '@/lib/supabase';
import { isSessionDietTable, localFrom } from '@/lib/sessionDietDb';

/**
 * Mismo proyecto calc (auth + foods).
 * diet_plans / exchange_diets siguen en localStorage (ficha sin gestión).
 */

if (!appSupabase) {
  console.error('[Lite] Supabase no configurado: revisa VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
}

export type LocalUser = {
  id: string;
  name: string;
  email?: string;
  role: string;
  country?: string;
  brandName?: string;
  brandLogoUrl?: string;
  [key: string]: unknown;
};

type FromFn = SupabaseClient['from'];

function wrapFrom(client: SupabaseClient): FromFn {
  return ((table: string) => {
    if (isSessionDietTable(table)) {
      return localFrom(table) as unknown as ReturnType<FromFn>;
    }
    return client.from(table);
  }) as FromFn;
}

const base = appSupabase as SupabaseClient;

export const supabase = new Proxy(base, {
  get(target, prop, receiver) {
    if (prop === 'from') return wrapFrom(target);
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
}) as SupabaseClient;

export function mapNutritionistRowToLocalUser(_row: unknown): LocalUser {
  return { id: '', name: '', role: 'user' };
}

export type { User };
