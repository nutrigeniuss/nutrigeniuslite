# Plan: Bioimpedancia en Resultados + PDF

Fecha: 2026-09-13  
Spec: `docs/superpowers/specs/2026-09-13-bioimpedancia-resultados-design.md`

## Archivos
1. `src/components/ficha/results/BioimpedanciaSection.jsx` — sección UI
2. `src/components/ficha/ResultsTab.jsx` — montar sección
3. `src/components/ficha/results/resultsShared.jsx` — estilo de sección (icono)
4. `src/lib/anthropometry/printReport/bioimpedancia.ts` — HTML del informe
5. `src/lib/anthropometry/printReport/index.ts` — insertar sección

## Tareas
1. UI SectionCard + ResultRow (solo filas con valor; sección null si vacío)
2. PDF `buildBioimpedanceSection` + ensamblar en adulto / pediátrico / gestante
3. Verificar tsc
