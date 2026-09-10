// Edge Function: crear / resetear / borrar cuentas (solo admin).
// Deploy:
//   npx supabase login
//   npx supabase link --project-ref ywpgsnjjtjwkbiutiwjj
//   npx supabase functions deploy admin-manage-user
//
// Invocar desde la app con el JWT del admin (supabase.functions.invoke).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Body = {
  action: 'create' | 'set_password' | 'delete'
  email?: string
  password?: string
  fullName?: string
  userId?: string
  grantAccess?: boolean
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Falta Authorization' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Edge Function sin variables de entorno' }, 500)
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userErr } = await caller.auth.getUser()
    if (userErr || !userData.user) return json({ error: 'Sesión inválida' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile } = await admin
      .from('profiles')
      .select('role, access_mode')
      .eq('id', userData.user.id)
      .maybeSingle()

    const isAdmin =
      profile?.role === 'admin' || profile?.access_mode === 'internal_admin'
    if (!isAdmin) return json({ error: 'Solo el módulo maestro' }, 403)

    const body = (await req.json()) as Body
    const action = body.action

    if (action === 'create') {
      const email = (body.email || '').trim().toLowerCase()
      const password = body.password || ''
      const fullName = (body.fullName || '').trim()
      if (!email || !password || password.length < 6) {
        return json({ error: 'Email y contraseña (mín. 6) son obligatorios' }, 400)
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      })
      if (createErr || !created.user) {
        return json({ error: createErr?.message || 'No se pudo crear' }, 400)
      }

      const grant = Boolean(body.grantAccess)
      await admin.from('profiles').upsert({
        id: created.user.id,
        email,
        full_name: fullName,
        role: 'user',
        access_mode: grant ? 'manual_preview' : 'billing_managed',
        is_active: grant,
        access_expires_at: grant
          ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString()
          : null,
      })

      return json({ ok: true, userId: created.user.id })
    }

    if (action === 'set_password') {
      const userId = body.userId
      const password = body.password || ''
      if (!userId || password.length < 6) {
        return json({ error: 'userId y contraseña (mín. 6) requeridos' }, 400)
      }
      if (userId === userData.user.id) {
        return json({ error: 'Usa el flujo normal para cambiar tu propia clave' }, 400)
      }
      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password })
      if (pwErr) return json({ error: pwErr.message }, 400)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const userId = body.userId
      if (!userId) return json({ error: 'userId requerido' }, 400)
      if (userId === userData.user.id) {
        return json({ error: 'No puedes borrar tu propia cuenta admin' }, 400)
      }
      const { data: target } = await admin
        .from('profiles')
        .select('role, access_mode')
        .eq('id', userId)
        .maybeSingle()
      if (target?.role === 'admin' || target?.access_mode === 'internal_admin') {
        return json({ error: 'No se pueden borrar cuentas admin' }, 400)
      }
      const { error: delErr } = await admin.auth.admin.deleteUser(userId)
      if (delErr) return json({ error: delErr.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Acción no soportada' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error interno'
    return json({ error: message }, 500)
  }
})
