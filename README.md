# NutriGenius Lite (calculadora)

Producto nuevo, **aparte** de `nutrigenius-lite` (SaaS/ficha).  
Nombre comercial: **NutriGenius Lite**. Carpeta: `nutrigenius-lite-calc`.

## Qué es

- Landing en una pantalla (marca + funciones)
- Login Fitia simple (email/contraseña)
- Calculadora: Medidas · Resultados · Calorías
- Módulo maestro `/admin` para activar/desactivar acceso
- **Sin** pacientes, dietas ni recetas

## Arranque

```powershell
cd C:\NUTRIGENIUS\LITE\nutrigenius-lite-calc
copy .env.example .env.local
# Edita .env.local con tu proyecto Supabase
npm install
npm run dev
```

1. Crea un proyecto Supabase (puede ser el Lite que ya tienes o uno nuevo).
2. Ejecuta `supabase/schema.sql` en el SQL Editor.
3. Regístrate en `/login`.
4. En SQL, promueve tu usuario a admin (comentario al final del schema).
5. En `/admin` activa cuentas tras el pago Yape.

## Pago

Edita `src/config/litePayment.ts` con Yape/CCI reales.

## Relación con el otro repo

| Carpeta | Rol |
|---------|-----|
| `nutrigenius-lite` | App clínica completa (pacientes, etc.) — **no borrar** |
| `nutrigenius-lite-calc` | Calculadora rápida para salir al mercado |
