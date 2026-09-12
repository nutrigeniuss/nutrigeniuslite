# NutriGenius Lite (calculadora)

Producto **Lite Calc** (carpeta `nutrigenius-lite-calc`).  
Nombre comercial: **NutriGenius Lite**. Remote GitHub: `https://github.com/nutrigeniuss/nutrigeniuslite`

## Qué es

- Landing + login (email/contraseña) + recuperación de contraseña
- Calculadora clínica: medidas, resultados, requerimiento, bioquímica, dieta por sesión
- Dietas por menú e intercambios (guardadas en el navegador / sesión)
- Mis alimentos + catálogo maestro (admin)
- Módulo maestro `/admin` para crear cuentas y activar acceso tras pago Yape

**No** hay multi-paciente en la nube: la ficha es de sesión (local). Las dietas no van a Supabase.

## Arranque

```powershell
cd C:\NUTRIGENIUS\LITE\nutrigenius-lite-calc
copy .env.example .env.local
# Edita .env.local con tu proyecto Supabase
npm install
npm run dev
```

1. Crea un proyecto Supabase dedicado.
2. Ejecuta en SQL Editor, en orden:
   - `supabase/schema.sql`
   - `supabase/foods.sql`
   - `supabase/exchange_foods.sql`
3. Regístrate en `/login`.
4. En SQL, promueve tu usuario a admin (comentario al final de `schema.sql`).
5. Despliega la edge function `admin-manage-user` (ver comentarios en el archivo).
6. Configura `ALLOWED_ORIGINS` con tu dominio de Vercel + localhost.
7. En Supabase Auth → URL Configuration, añade:
   - Site URL = tu `VITE_PUBLIC_SITE_URL` de producción
   - Redirect URLs = `https://tu-dominio/reset-password` y localhost
8. En `/admin` activa cuentas tras el pago Yape.

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desarrollo |
| `npm run build` | Build producción |
| `npm test` | Tests de release (admin + alimentos) |
| `npm run lint` | Oxlint |

## Pago

Edita `src/config/litePayment.ts` con Yape/CCI reales.

## Relación con el otro producto

| Carpeta / repo | Rol |
|----------------|-----|
| SaaS NutriGenius | App clínica completa — **no pushear Lite ahí** |
| `nutrigenius-lite-calc` | Calculadora Lite para mercado |
