# Plan: Dietética — Recordatorio 24 h (Lite)

**Goal:** Port SaaS R24h editor into Lite as section **Dietética**, foods from Lite `foods` catalog (same cache as Dieta). No dietary profile / recipes / cloud patients.

## Files

| Path | Role |
|------|------|
| `src/components/ficha/dietetica/recallItemFields.js` | Pure macros/item compute (S) |
| `src/components/ficha/dietetica/RecallFoodSearch.jsx` | Search foods (+ USDA); no recipes |
| `src/components/ficha/dietetica/EditableMealItemRow.jsx` | Edit row |
| `src/components/ficha/dietetica/NutriSummary.jsx` | Totals |
| `src/components/ficha/dietetica/Recall24hEditor.jsx` | Editor UI |
| `src/components/ficha/dietetica/DieteticaPanel.tsx` | Host: load/save `measurement.recall_24h` |
| `src/components/ficha/consult/consultConfig.js` | Add group `dietetica` |
| `src/components/ficha/ConsultDetail.jsx` | Render panel |

## Tasks

1. Copy recall helpers from `BASE-LITE-COMPLETO` → adapt imports to Lite paths.
2. Strip recipes tab from `RecallFoodSearch`; use `prefetchFoodCatalog` / `readFoodCatalogCache`.
3. `DieteticaPanel` saves via `onUpdate({ measurements })` merging `recall_24h` on current consult.
4. Wire tab; build + smoke.

## Out of scope

Dietary profile, multi-consult history UI, recipes, AI context.
