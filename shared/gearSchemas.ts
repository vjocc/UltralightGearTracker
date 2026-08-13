/**
 * Client+server shared zod schemas for gear_items.
 *
 * The Architect's design asks the form to clone the server schemas so both
 * ends import the same source. The single source-of-truth lives here
 * (~/shared/gearSchemas.ts) and is re-exported by the server wrapper
 * (server/utils/gearSchemas.ts) to keep existing server imports working.
 *
 * Notes:
 * - The DB column `notes` is NOT in the current gear_items migration
 *   (see supabase/migrations/20260812000000_init_gear.sql). Until a
 *   migration adds it, the form omits notes entirely; capturing it
 *   client-side without persistence would mislead the user.
 * - excluded_from_base defaults to false so the checkbox can stay
 *   unchecked on first render.
 */
import { z } from 'zod';

export const gearCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(80, 'Max 80 characters'),
  category_id: z.string().uuid('Pick a category'),
  weight_g: z
    .number({ message: 'Weight must be a number' })
    .int('Whole grams only')
    .nonnegative('Cannot be negative')
    .max(50_000, 'Max 50 000 g'),
  price: z
    .number()
    .nonnegative('Cannot be negative')
    .max(1_000_000, 'Out of range')
    .nullable()
    .optional(),
  excluded_from_base: z.boolean().optional().default(false),
});

export const gearUpdateSchema = gearCreateSchema.partial();

export type GearCreateInput = z.infer<typeof gearCreateSchema>;
export type GearUpdateInput = z.infer<typeof gearUpdateSchema>;

/**
 * Form-shape used by GearFormModal.vue. The form always works with
 * `price: number | ''` (empty string when blank) because number inputs
 * return '' when cleared. The submit pipeline coerces '' → null and
 * numeric strings → numbers before feeding gearCreateSchema.
 */
export interface GearFormShape {
  name: string;
  category_id: string;
  weight_g: number | '';
  price: number | '' | null;
  excluded_from_base: boolean;
}
