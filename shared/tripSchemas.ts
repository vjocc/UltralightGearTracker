/**
 * Client+server shared zod schemas for trips + trip_gear.
 *
 * Mirrors the gearSchemas / wishlistSchemas pattern: the single source of
 * truth lives in shared/ and is re-exported via server/utils/tripSchemas.ts
 * so the existing server/api/* import paths keep working unchanged.
 *
 * Date semantics:
 *   * start_date / end_date are surfaced as ISO YYYY-MM-DD strings
 *     (Postgres DATE column → to_char-compatible string).
 *   * Either side nullable (open-ended trips).
 *   * When both are present, start_date <= end_date is enforced via
 *     a separate .superRefine() chained onto the create schema and
 *     surfaced under the `end_date` field so the TripFormModal can show
 *     the error next to that input.
 *
 * Zod 4 policy: `.partial()` cannot be called on an object schema that
 * carries a `.refine()` (the refinement is silently dropped on patch). To
 * keep PATCH semantics honest, the base shape is exported independently
 * and the date-range constraint is attached only to the create schema.
 * The update schema is `tripBaseSchema.partial()` — every field optional,
 * and the date-range constraint is intentionally **not** re-applied so a
 * single-field patch (e.g. just `name`) does not require re-sending
 * both dates. The DB-level CHECK is the source of truth on multi-field
 * updates; the form-level validation already prevents bad combos.
 */
import { z } from 'zod';

export const tripBaseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120, 'Max 120 characters'),
  description: z.string().max(2000, 'Max 2000 characters').optional().nullable(),
  start_date: z.string().date('Use YYYY-MM-DD').optional().nullable(),
  end_date: z.string().date('Use YYYY-MM-DD').optional().nullable(),
  // Sprint 5 P1 — Community Routes ("Felfedezés a régióban"):
  // visibility toggles the trip into the public /discover page (§11.1
  // MANUAL region, §11.2 régiónkénti ABC). Default private (user opt-in).
  visibility: z.enum(['private', 'public']).default('private'),
  region: z.string().max(80, 'Max 80 characters').optional().nullable(),
  region_source: z
    .enum(['manual', 'gpx_derived'])
    .optional()
    .nullable(),
});

export const tripCreateSchema = tripBaseSchema.superRefine((d, ctx) => {
  if (d.start_date && d.end_date && d.start_date > d.end_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'start_date must be <= end_date',
      path: ['end_date'],
    });
  }
});

export const tripUpdateSchema = tripBaseSchema.partial();

export const tripGearAddSchema = z.object({
  gear_item_id: z.string().uuid('Pick a gear item'),
  quantity: z
    .number({ message: 'Quantity must be a number' })
    .int('Whole numbers only')
    .min(1, 'At least 1')
    .default(1),
});

// PATCH semantics: at least one of `quantity` / `assigned_to_user_id` must
// be present. Both are optional individually so the existing quantity-only
// callers continue to work; the UI / endpoint enforces "at least one".
export const tripGearUpdateSchema = z
  .object({
    quantity: z
      .number({ message: 'Quantity must be a number' })
      .int('Whole numbers only')
      .min(1, 'At least 1')
      .optional(),
    /**
     * Sprint 5 P2 — "Ki mit visz" csomaglista-egyeztetés.
     * Opcionális (a §11.1 user-döntés szerinti A default). UUID = user-hez
     * rendelés, NULL = hozzárendelés törlése. A szerver oldali zod séma a
     * típust + uuid formátumot ellenőrzi; a jogosultsági kört (a user_id
     * a trip résztvevőinek listáján legyen) a PATCH endpoint saját
     * SELECT-tel ellenőrzi.
     */
    assigned_to_user_id: z
      .string()
      .uuid('Must be a valid user id')
      .nullable()
      .optional(),
  })
  .refine(
    (d) =>
      d.quantity !== undefined || d.assigned_to_user_id !== undefined,
    {
      message: 'Provide quantity or assigned_to_user_id (or both)',
      path: ['quantity'],
    },
  );

export type TripCreateInput = z.infer<typeof tripCreateSchema>;
export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;
export type TripGearAddInput = z.infer<typeof tripGearAddSchema>;
export type TripGearUpdateInput = z.infer<typeof tripGearUpdateSchema>;

/**
 * Form-shape used by TripFormModal.vue. The form treats `description`,
 * `start_date` and `end_date` as `string` (empty string when blank) so
 * the date / textarea inputs stay controlled without `null` ever
 * reaching the underlying HTMLInputElement. The submit pipeline coerces
 * '' → null before feeding tripCreateSchema.
 */
export interface TripFormShape {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  // Sprint 5 P1 — Community Routes. visibility toggle (default 'private'),
  // free-text region (max 80 char). region_source a submit-on tölti a
  // komponens, nem form-state (form-on mindig 'manual' ha van region,
  // egyébként NULL).
  visibility: 'private' | 'public';
  region: string;
}
