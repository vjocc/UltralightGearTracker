/**
 * Sprint 5 P2 — "Ki mit visz" (csoportos csomaglista-egyeztetés).
 *
 * Response schemas for GET /api/trips/:id/gear-assignments.
 *
 * Owner-only (§11.2 user-döntés szerinti A default; a §11.2 B opció
 * esetén a trip_visible_to() jogosulti kört használja). Az aggregáció
 * szerveroldali (JavaScript), a participants lista user_id szerint
 * csoportosítva, ABC-sorrendben az email alapján. A user_id = null bucket
 * ("Nincs hozzárendelve") a lista végén jelenik meg (§11.3 user-döntés
 * szerinti A default: userenkénti csoportosítás).
 *
 * A shared/ + types/db split a többi sémánál (tripSchemas / gearSchemas /
 * tripShareSchemas) is így működik — egyetlen source of truth, a
 * server/utils/ re-export.
 */
import { z } from 'zod';

export const assignedGearItemSchema = z.object({
  trip_gear_id: z.string().uuid(),
  gear_item_id: z.string().uuid(),
  name: z.string(),
  /** Optional category name (NULL if the gear item has no category_id). */
  category: z.string().nullable(),
  weight_g: z.number().int().nonnegative(),
  qty: z.number().int().min(1),
  /** weight_g × qty, előre kiszámítva a kliens egyszerű rendereléséhez. */
  total_weight_g: z.number().nonnegative(),
});

export const gearAssignmentParticipantSchema = z.object({
  /**
   * user_id | null. A NULL bucket a "Nincs hozzárendelve" itemeket
   * reprezentálja — a §11.1 user-döntés szerinti "opcionális" default
   * (A) miatt NULL lehet.
   */
  user_id: z.string().uuid().nullable(),
  /**
   * Feloldott email-cím (a trip_participant_lookup_emails SECURITY
   * DEFINER function adja vissza). NULL a user_id = null bucketben,
   * vagy ha a user_id = null a participant-rész.
   */
  email: z.string().nullable(),
  /**
   * Display name (a trip_participant_lookup_profiles SECURITY DEFINER
   * function adja vissza — P2.x keresztnév bugfix). NULL a user_id =
   * null bucketben. A kliens oldali composable a "Névtelen túrázó"
   * fallback-et alkalmazza, ha a string === "Névtelen túrázó" (a
   * backfill migration placeholder), vagy ha NULL.
   */
  display_name: z.string().nullable(),
  /**
   * Avatar URL (privacy-safe projection). NULL ha a user nem töltött
   * fel avatar-t, vagy a user_id = null bucket.
   */
  avatar_url: z.string().nullable(),
  /** Item-level aggregált súly (gramm), a participant items tömbjéből. */
  total_weight_g: z.number().nonnegative(),
  items: z.array(assignedGearItemSchema),
});

export const gearAssignmentsResponseSchema = z.object({
  /**
   * Server-side aggregáció: user_id szerint csoportosítva. A kliens a
   * §11.3 user-döntés szerinti sorrendben (A: userenkénti csoportosítás
   * — a service oldali `participants` tömb pont ezt a struktúrát
   * szolgáltatja; B: itemenkénti lista — a kliens flatten-eli az
   * items tömböt).
   */
  participants: z.array(gearAssignmentParticipantSchema),
});

export type AssignedGearItem = z.infer<typeof assignedGearItemSchema>;
export type GearAssignmentParticipant = z.infer<
  typeof gearAssignmentParticipantSchema
>;
export type GearAssignmentsResponse = z.infer<
  typeof gearAssignmentsResponseSchema
>;