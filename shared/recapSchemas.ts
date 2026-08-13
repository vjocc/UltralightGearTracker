/**
 * Client+server shared zod schemas for the P3 trip recap + photos feature.
 *
 * Mirrors the tripSchemas / tripShareSchemas pattern: single source of
 * truth in shared/, re-exported via server/utils/recapSchemas.ts so the
 * existing server/api/* import paths stay unchanged.
 *
 * Body length cap mirrors the trip_comments / gear_comments policy
 * (2000 chars felt too short for a post-trip report, so the Architect
 * picked 20000 — same order of magnitude as a long blog post).
 */
import { z } from 'zod';

export const recapUpsertSchema = z.object({
  body: z.string().min(0).max(20000).optional().nullable(),
  rating_out_of_10: z.number().int().min(0).max(10).optional().nullable(),
  public: z.boolean().optional(),
});

export const recapPatchSchema = recapUpsertSchema;

export const photoPatchSchema = z.object({
  caption: z.string().min(0).max(500).optional().nullable(),
  display_order: z.number().int().min(0).optional(),
});

export type RecapUpsertInput = z.infer<typeof recapUpsertSchema>;
export type RecapPatchInput = z.infer<typeof recapPatchSchema>;
export type PhotoPatchInput = z.infer<typeof photoPatchSchema>;