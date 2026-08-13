/**
 * Client+server shared zod schemas for trip share + trip_comments.
 *
 * Single source of truth for the trip-share payload (mirrors the
 * gearSchemas / wishlistSchemas / tripSchemas / commentSchemas pattern).
 *
 * Body of trip_comments re-uses commentCreateSchema / commentUpdateSchema
 * from shared/commentSchemas.ts (1..2000 chars + trim).
 */
import { z } from 'zod';

export const inviteCreateSchema = z.object({
  invitee_email: z
    .string()
    .trim()
    .min(1, 'Email required')
    .email('Invalid email'),
});

export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
