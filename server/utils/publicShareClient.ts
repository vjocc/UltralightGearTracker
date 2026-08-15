import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/types/db';

/**
 * Returns a Supabase client authenticated with the SERVICE ROLE key.
 *
 * Why a dedicated helper:
 *   /api/lists/[id].get.ts MUST serve anonymous traffic (no JWT in the
 *   request), so the regular serverSupabaseClient(event) — which forwards
 *   the caller's JWT and is therefore RLS-gated to auth.uid() — cannot
 *   be used. The service-role client bypasses RLS, which is exactly what
 *   we need to:
 *     1) run `select public_list_lookup(token)` to resolve the owner, AND
 *     2) read `gear_items` for that owner.
 *   The two-key gate (token + is_public=true + not-expired) lives in the
 *   SECURITY DEFINER helper — NOT in this client — so a misconfigured
 *   RLS policy cannot leak a private token.
 *
 * Hard constraint: this helper is ONLY imported by /api/lists/[id].get.ts
 * and /api/lists/index.post.ts (the latter still uses the regular user
 * client for the auth check; this helper is for the public read path
 * only).
 *
 * SECURITY: SUPABASE_SERVICE_ROLE_KEY is server-only. The
 * `runtimeConfig.supabaseServiceKey` binding exposes it only inside
 * /server — never to the browser bundle.
 */
let cached: SupabaseClient<Database> | null = null;

export function getServiceRoleClient(): SupabaseClient<Database> {
  if (cached) return cached;

  const cfg = useRuntimeConfig();
  // @nuxtjs/supabase publishes the URL/key under runtimeConfig.public.supabase
  // and the SERVICE ROLE under runtimeConfig.supabase.secretKey (resolved
  // from NUXT_SUPABASE_SECRET_KEY / SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY).
  const url =
    (cfg.public as { supabase?: { url?: string } }).supabase?.url ?? '';
  const serviceKey =
    (cfg as { supabase?: { secretKey?: string } }).supabase?.secretKey ?? '';

  if (!url || !serviceKey) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Public share service is not configured (SUPABASE_SERVICE_ROLE_KEY missing)',
    });
  }

  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}