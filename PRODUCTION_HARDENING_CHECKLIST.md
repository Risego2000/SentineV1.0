# Production Hardening Checklist

## 1) Backend token enforcement for loopback

Set:

```env
SENTINEL_REQUIRE_TOKEN_LOOPBACK=true
SENTINEL_API_TOKEN=<strong-secret>
```

This enforces API token validation even for loopback/no-origin traffic.

## 2) Supabase RLS hardening

Run in Supabase SQL Editor:

1. `supabase/harden-rls-production.sql`
2. `supabase/harden-storage-evidence-production.sql`

## 3) Verification

1. Backend starts normally.
2. Requests to protected `/api/*` without token return `401`.
3. `anon` cannot read sensitive tables (`infractions`, `expedients`, `expedient_images`, `evidence`).
4. Evidence bucket is private.

