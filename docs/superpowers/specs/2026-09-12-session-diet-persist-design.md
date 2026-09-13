# Dietas multi-día hasta Nueva ficha (Lite)

## Problema
Las dietas se guardaban en localStorage pero no reaparecían en la ficha (`patient_id` vacío vs `session-ficha`, filtro `is_catalog`). Nueva ficha no limpiaba dietas.

## Comportamiento
1. Guardar/listar con `patient_id = session-ficha`.
2. Planes visibles al volver / recargar.
3. **Nueva ficha** borra ficha + dietas locales.
