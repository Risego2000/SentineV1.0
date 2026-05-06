# Checklist de Hardening para Producción

## 1) Exigir token en backend también para loopback

Configurar:

```env
SENTINEL_REQUIRE_TOKEN_LOOPBACK=true
SENTINEL_API_TOKEN=<secreto-fuerte>
```

Esto fuerza validación de token API incluso para tráfico loopback/sin origen.

## 2) Hardening de RLS en Supabase

Ejecutar en el editor SQL de Supabase:

1. `supabase/harden-rls-production.sql`
2. `supabase/harden-storage-evidence-production.sql`

## 3) Verificación

1. El backend inicia normalmente.
2. Las peticiones a `/api/*` protegidas sin token responden `401`.
3. `anon` no puede leer tablas sensibles (`infractions`, `expedients`, `expedient_images`, `evidence`).
4. El bucket de evidencias es privado.
