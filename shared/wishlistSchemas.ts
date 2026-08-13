/**
 * Client+server shared zod schemas for wishlist_items.
 * Mirrors the gearSchemas pattern (single source-of-truth in shared/,
 * re-exported via server/utils/). All numeric fields accept finite numbers
 * only; empty strings (from <input type="number"> clear) are coerced
 * upstream by the modal before submission.
 */
import { z } from 'zod';

export const wishlistCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80, 'Max 80 characters'),
  category_id: z.string().uuid('Pick a category'),
  retailer_url: z
    .string()
    .min(1, 'Retailer URL is required')
    .url('Must be a valid URL (https://…)')
    .max(2_000, 'URL too long'),
  current_price: z
    .number()
    .nonnegative('Cannot be negative')
    .max(1_000_000, 'Out of range')
    .nullable()
    .optional(),
  target_price: z
    .number()
    .nonnegative('Cannot be negative')
    .max(1_000_000, 'Out of range')
    .nullable()
    .optional(),
});

export const wishlistUpdateSchema = wishlistCreateSchema.partial();

export type WishlistCreateInput = z.infer<typeof wishlistCreateSchema>;
export type WishlistUpdateInput = z.infer<typeof wishlistUpdateSchema>;

/**
 * Form-shape used by WishlistFormModal.vue. The form treats `current_price`
 * and `target_price` as `number | '' | null` (empty string when blank, null
 * when explicitly cleared) so <input type="number"> plays nicely with
 * controlled state. The submit pipeline coerces '' / null → null before
 * feeding wishlistCreateSchema.
 */
export interface WishlistFormShape {
  name: string;
  category_id: string;
  retailer_url: string;
  current_price: number | '' | null;
  target_price: number | '' | null;
}
