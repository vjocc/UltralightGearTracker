/**
 * Client+server shared zod schemas for the v2 #19 /list/{id} public share.
 *
 * Single source of truth — mirrors the gearSchemas / tripShareSchemas
 * pattern. Body validated at /api/lists (POST) so the DB never sees an
 * unvalidated payload.
 *
 * `is_public` is REQUIRED: callers must explicitly opt-in (v2 §0 4. elv
 * — privacy default: private). `label` and `expires_at` are optional.
 */
import { z } from 'zod';

export const publicListUpsertSchema = z.object({
  // `is_public` is REQUIRED: callers must explicitly opt-in (v2 §0 4. elv
  // — privacy default: private). Both true and false are accepted; the
  // caller toggles share on/off with a single boolean.
  is_public: z.boolean({
    message: 'is_public is required (true to publish, false to unpublish)',
  }),
  label: z
    .string()
    .trim()
    .max(120, 'Label must be at most 120 characters')
    .optional()
    .nullable(),
  expires_at: z
    // Accept an ISO-8601 string or null (clear) / undefined (don't change).
    // The DB constraint check (`expires_at > created_at`) is the ultimate
    // gate; we only enforce parseability here.
    .string()
    .datetime({ message: 'expires_at must be an ISO-8601 datetime' })
    .optional()
    .nullable(),
});

export type PublicListUpsertInput = z.infer<typeof publicListUpsertSchema>;