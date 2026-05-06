# Supabase Frontend Compat Runbook

## Objetivo
Eliminar errores comunes de la UI:
- `403` en `infractions` / `expedient_images`
- `404` en `public.incidents`
- `column infractions.status does not exist`

## Paso único
1. Abre Supabase SQL Editor del proyecto.
2. Ejecuta el archivo:
   - `supabase/fix-frontend-compat-all.sql`

## Verificación rápida
1. Recarga la app en `http://localhost:3001`.
2. En consola del navegador ya no deben aparecer:
   - `Could not find the table 'public.incidents'`
   - `column infractions.status does not exist`
   - `permission denied for schema public` en lecturas de tablas objetivo

## Nota importante
Si tu frontend usa `EXP-...` como `expedient_id`, no intentes filtrar directamente por UUID en tablas con `expedient_id UUID`. El proyecto ya incluye filtrado preventivo para evitar ese error de tipo.
