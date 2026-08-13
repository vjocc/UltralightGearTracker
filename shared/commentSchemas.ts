/**
 * Client+server shared zod schemas for gear_comments.
 *
 * Single source of truth for the comment body. Mirrors the DB CHECK
 * constraint `char_length(body) between 1 and 2000`.
 */
import { z } from 'zod';

export const commentCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Body required')
    .max(2000, 'Max 2000 characters'),
});

export const commentUpdateSchema = commentCreateSchema;

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentUpdateInput = z.infer<typeof commentUpdateSchema>;

/**
 * Email batch lookup payload for /api/auth/lookup-emails.
 * Caps the batch at 200 ids to bound the RPC call size.
 */
export const lookupEmailsSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid uuid'))
    .min(1, 'At least one id required')
    .max(200, 'Max 200 ids per request'),
});

export type LookupEmailsInput = z.infer<typeof lookupEmailsSchema>;