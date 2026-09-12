// Edge Function: crear / resetear / borrar cuentas (solo admin).
// Deploy:
//   npx supabase login
//   npx supabase link --project-ref <TU-PROJECT-REF>
//   npx supabase secrets set ALLOWED_ORIGINS=https://tu-dominio.vercel.app,http://localhost:5173
//   npx supabase functions deploy admin-manage-user
//
// Invocar desde la app con el JWT del admin (supabase.functions.invoke).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const MIN_PASSWORD_LENGTH = 8

type Body = {
  action: 'create' | 'set_password' | 'delete'
  email?: string
  password?: string
  fullName?: string
  userId?: string
  grantAccess?: boolean
  accessDays?: 30 | 45 | 90 | null
}

function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('PUBLIC_SITE_URL') || ''
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean)
  // Desarrollo local siempre permitido si no rompe el allowlist vacío
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173']
  return [...new Set([...list, ...defaults])]
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = (req.headers.get('Origin') || '').replace(/\/$/, '')
  const allowed = parseAllowedOrigins()
  const matched = origin && allowed.includes(origin) ? origin : allowed[0] || 'http://localhost:5173'
  return {
    'Access-Control-Allow-Origin': matched,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function json(data: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Falta Authorization' }, 401, corsHeaders)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Edge Function sin variables de entorno' }, 500, corsHeaders)
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Sesión inválida' }, 401, corsHeaders)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('role, access_mode')
      .eq('id', userData.user.id)
      .maybeSingle()

    const isAdmin =
      profile?.role === 'admin' || profile?.access_mode === 'internal_admin'
    if (!isAdmin) return json({ error: 'Solo el módulo maestro' }, 403, corsHeaders)

    const body = (await req.json()) as Body
    const action = body.action

    if (action === 'create') {
      const email = (body.email || '').trim().toLowerCase()
      const password = body.password || ''
      const fullName = (body.fullName || '').trim()
      if (!email || !password || password.length < MIN_PASSWORD_LENGTH) {
        return json(
          { error: `Email y contraseña (mín. ${MIN_PASSWORD_LENGTH}) son obligatorios` },
          400,
          corsHeaders,
        )
      }

      const grant = Boolean(body.grantAccess)
      const accessDays = body.accessDays === undefined ? 45 : body.accessDays
      if (
        grant &&
        accessDays !== null &&
        accessDays !== 30 &&
        accessDays !== 45 &&
        accessDays !== 90
      ) {
        return json({ error: 'accessDays inválido' }, 400, corsHeaders)
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (createErr || !created.user) {
        return json({ error: createErr?.message || 'No se pudo crear' }, 400, corsHeaders)
      }

      const accessExpiresAt = (() => {
        if (!grant) return null
        if (accessDays === null) return null
        if (accessDays !== 30 && accessDays !== 45 && accessDays !== 90) {
          return new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString()
        }
        return new Date(Date.now() + 1000 * 60 * 60 * 24 * accessDays).toISOString()
      })()

      const { error: upsertError } = await admin.from('profiles').upsert({
        id: created.user.id,
        email,
        full_name: fullName,
        role: 'user',
        access_mode: grant ? 'manual_preview' : 'billing_managed',
        is_active: grant,
        access_expires_at: accessExpiresAt,
      })

      if (upsertError) {
        const { error: deleteError } = await admin.auth.admin.deleteUser(created.user.id)
        if (deleteError) {
          console.error('Rollback deleteUser failed after profile upsert error:', deleteError.message)
        }
        return json(
          {
            error: upsertError.message || 'No se pudo guardar el perfil',
            ...(deleteError
              ? { rollback: `No se pudo revertir el usuario creado: ${deleteError.message}` }
              : {}),
          },
          400,
          corsHeaders,
        )
      }

      return json({ ok: true, userId: created.user.id }, 200, corsHeaders)
    }

    if (action === 'set_password') {
      const userId = body.userId
      const password = body.password || ''
      if (!userId || password.length < MIN_PASSWORD_LENGTH) {
        return json(
          { error: `userId y contraseña (mín. ${MIN_PASSWORD_LENGTH}) requeridos` },
          400,
          corsHeaders,
        )
      }
      if (userId === userData.user.id) {
        return json({ error: 'Usa el flujo normal para cambiar tu propia clave' }, 400, corsHeaders)
      }
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password })
      if (pwErr) return json({ error: pwErr.message }, 400, corsHeaders)
      return json({ ok: true }, 200, corsHeaders)
    }

    if (action === 'delete') {
      const userId = body.userId
      if (!userId) return json({ error: 'userId requerido' }, 400, corsHeaders)
      if (userId === userData.user.id) {
        return json({ error: 'No puedes borrar tu propia cuenta admin' }, 400, corsHeaders)
      }
      const { data: target } = await admin
        .from('profiles')
        .select('role, access_mode')
        .eq('id', userId)
        .maybeSingle()
      if (target?.role === 'admin' || target?.access_mode === 'internal_admin') {
        return json({ error: 'No se pueden borrar cuentas admin' }, 400, corsHeaders)
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(userId)
      if (delErr) return json({ error: delErr.message }, 400, corsHeaders)
      return json({ ok: true }, 200, corsHeaders)
    }

    return json({ error: 'Acción no soportada' }, 400, corsHeaders)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error interno'
    return json({ error: message }, 500, corsHeaders)
  }
})
