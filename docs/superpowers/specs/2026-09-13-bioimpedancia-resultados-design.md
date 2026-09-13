# Bioimpedancia en Resultados + informe PDF

Fecha: 2026-09-13  
Estado: aprobado por el usuario (“SÍ”, alcance B)

## Objetivo
Mostrar en **Resultados** y en el **PDF** los valores de bioimpedancia capturados del equipo (espejo, sin recalcular ni semáforos).

## Alcance
- Nueva sección “Bioimpedancia” en `ResultsTab` (tras Peso/Perímetros).
- Misma sección en el informe imprimible.
- Ocultar la sección si no hay ningún valor en `measurement.bioimpedance`.
- Campos: los de `SECTIONS.bio` en `consultConfig` (grasa total/superior/inferior, visceral, MLG, muscular, ósea, agua, edad metabólica).

## Fuera de alcance
- Clasificaciones / rangos por marca de equipo.
- Sustituir el % grasa del resumen superior (sigue por pliegues/fórmula).
