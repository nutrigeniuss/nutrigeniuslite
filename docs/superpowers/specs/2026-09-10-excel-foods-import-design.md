# Importar base maestra de alimentos por Excel (plantilla SaaS)

Fecha: 2026-09-10  
Estado: aprobado en conversación (UI Excel en Maestro + upsert por nombre + plantilla-oficial-1 como referencia)

## Problema

Lite Calc solo importa la base maestra por **JSON** en `/admin/alimentos`. En el SaaS la carga se hace con la **plantilla Excel oficial**. Lite no tiene esa base cargada todavía; el archivo de referencia con datos reales es `plantilla-alimentos-oficial-1.xlsx` (~2196 filas → ~1129 alimentos únicos).

## Objetivos

1. En Maestro (`/admin/alimentos`), subir un `.xlsx` con el mismo formato de plantilla del SaaS.
2. Parsear en el navegador (sin edge function nueva).
3. Persistencia: **si el nombre ya existe en maestros → reemplazar; si no → agregar**. No borrar alimentos que no vienen en el Excel.
4. Agrupar filas repetidas del mismo alimento como **medidas caseras**.
5. Normalizar nutrientes a **base 100 g**.
6. Mantener el import JSON actual como respaldo.

Fuera de alcance: borrar maestros ausentes del Excel, editor Excel en app, sync automática desde otro proyecto Supabase, UI para nutricionistas (solo Maestro).

## Arquitectura

```
FoodsCatalogPage (/admin/alimentos)
  ├─ Subir .xlsx
  │     └─ parseOfficialFoodsWorkbook(file)  → CatalogFoodRecord[]
  │           └─ upsertMasterFoods(records)  → importFoodsBatch(..., nutritionistId=undefined)
  ├─ Importar JSON (existente: replace / merge)
  └─ Lista / borrar maestros (existente)
```

Unidades:

| Unidad | Responsabilidad | Dependencias |
|--------|-----------------|--------------|
| `parseOfficialFoodsWorkbook` | Excel → alimentos únicos + medidas + nutrientes/100 g | SheetJS (`xlsx`), mapa de columnas → keys |
| `officialFoodsExcelColumns` (o mapa interno) | Alias de headers (`proteinas`→`protein`, etc.) | `foodNutrients` keys |
| `upsertMasterFoods` / `importFoodsBatch` | Insert/update maestros por nombre | `catalogData`, Supabase `foods` |
| `FoodsCatalogPage` | UI Maestro, progreso, mensajes | parser + upsert |

## Flujo de datos

1. Admin elige `.xlsx`.
2. Parser:
   - Hoja `Alimentos` o primera hoja.
   - Headers por **nombre** (case/acentos flexibles), no por índice fijo.
   - Soporta variantes: con/sin `porcion_gramos`; fila 2 de unidades (`g`/`kcal`/`mg`) o ya dato (como en `-1.xlsx`).
   - Agrupa por nombre normalizado.
   - Cada fila con medida + gramos → `household_measures`.
   - Fila ancla nutricional: preferir gramos ≈ 100 o la de más campos numéricos; escalar a 100 g.
   - Macros en columnas fijas + micros en `nutrients` jsonb (vía `extractFoodNutrients` / `buildPersistedFoodFields`).
3. Upsert maestros (`nutritionist_id = null`, `review_status = approved`).
4. Limpiar `foodCatalogCache` y refrescar lista.
5. Mensaje: `N alimentos · X nuevos · Y actualizados · Z filas omitidas`.

## UI

- Sección principal: **Importar Excel (plantilla oficial)** — un botón “Subir .xlsx”.
- Texto: misma plantilla del SaaS; filas repetidas = medidas caseras; upsert por nombre.
- Progreso opcional por lotes (~100).
- JSON debajo como respaldo (replace/merge intactos).

## Errores

- Archivo inválido / sin columna alimento / sin filas útiles → error claro, **sin tocar DB**.
- Fallo a mitad de lotes → mostrar error; lo ya escrito puede quedar; reintentar es idempotente por nombre.

## Pruebas

Unit tests del parser con fixture mínima:

- Arroz + 2 medidas → 1 alimento, 2 `household_measures`, macros/100 g.
- Fila de unidades saltada.
- Sin `porcion_gramos` (como `-1.xlsx`).
- Nombre repetido agrupa.
- Fila sin nombre omitida.

## Referencia de archivo

- Formato + contenido de prueba/manual: `plantilla-alimentos-oficial-1.xlsx` (Downloads del usuario).
- Plantilla corta de ejemplo: `plantilla-alimentos-oficial (19).xlsx` (headers + unidades + 3 filas).

No versionar el Excel completo de ~2 MB en el repo; sí un fixture pequeño en tests.
