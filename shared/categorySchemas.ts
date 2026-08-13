/**
 * Client+server shared zod schemas for the categories table.
 *
 * The constraints mirror the DB (supabase/migrations/20260812000000_init_gear.sql):
 *  - name: 1..50 chars (rendered in the category <select>)
 *  - slug: 1..50 chars, lowercase alnum + hyphens, unique per (user_id, slug)
 *  - user_id: derived from auth.uid() at the DB layer; never accepted from
 *    the client (defended by RLS WITH CHECK on INSERT + this zod schema
 *    which intentionally omits it).
 *
 * Re-exported via server/utils/categorySchemas.ts to keep existing server
 * imports working, mirroring the pattern from gearSchemas.ts.
 */
import { z } from 'zod';

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(50, 'Max 50 characters'),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required')
    .max(50, 'Max 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits, and hyphens only'),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
