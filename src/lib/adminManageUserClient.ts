import { supabase } from '@/lib/supabase';
import type { AccessDays } from '@/lib/adminAccess';

type FnErrorBody = { error?: string };

async function invokeAdminManageUser<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.functions.invoke('admin-manage-user', { body });
  if (error) {
    let msg = error.message || 'No se pudo contactar admin-manage-user (¿deploy pendiente?)';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as FnErrorBody;
        if (body?.error) msg = String(body.error);
      } catch {
        // keep transport message
      }
    }
    throw new Error(msg);
  }
  const payload = data as FnErrorBody & T;
  if (payload && typeof payload === 'object' && 'error' in payload && payload.error) {
    throw new Error(String(payload.error));
  }
  return payload as T;
}

export async function createNutritionist(input: {
  email: string;
  password: string;
  fullName?: string;
  grantAccess: boolean;
  accessDays: AccessDays;
}): Promise<{ userId: string }> {
  const result = await invokeAdminManageUser<{ ok?: boolean; userId?: string }>({
    action: 'create',
    email: input.email,
    password: input.password,
    fullName: input.fullName ?? '',
    grantAccess: input.grantAccess,
    accessDays: input.accessDays,
  });
  if (!result.userId) throw new Error('Respuesta inválida al crear usuario');
  return { userId: result.userId };
}

export async function setNutritionistPassword(userId: string, password: string): Promise<void> {
  await invokeAdminManageUser({ action: 'set_password', userId, password });
}

export async function deleteNutritionist(userId: string): Promise<void> {
  await invokeAdminManageUser({ action: 'delete', userId });
}
