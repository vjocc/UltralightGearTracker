/**
 * Client+server shared zod schemas for the P5 trip debrief feature
 * (v2 #23 "Mit bántam meg?").
 *
 * Mirrors the recapSchemas / gearSchemas pattern: single source of truth in
 * shared/, re-exported via server/utils/debriefSchemas.ts so the existing
 * server/api/* import paths stay unchanged.
 *
 * Body length policy (matches the spec's §4.4 + §8 #4 open question):
 *   * 120 char / item — short enough that a single line in the
 *     textarea reads well; long enough for a useful note
 *     ("matrac túl kemény hideg talajon").
 *   * 50 item / mező — caps the text[] payload so a single trip can
 *     not bloat the DB; 3 × 50 = 150 item / trip max.
 */
import { z } from 'zod';

const debriefItemSchema = z.string().min(1).max(120);

export const debriefUpsertSchema = z.object({
  excess_items: z.array(debriefItemSchema).max(50).default([]),
  missing_items: z.array(debriefItemSchema).max(50).default([]),
  uncomfortable_items: z.array(debriefItemSchema).max(50).default([]),
});

export type DebriefUpsertInput = z.infer<typeof debriefUpsertSchema>;