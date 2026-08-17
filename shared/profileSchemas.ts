/**
 * Profile schema — keresztnév + avatar + bio + privacy-first projection.
 * Sprint 5 P2.x bugfix: kötelező felhasználói keresztnév.
 */
import { z } from 'zod';

/**
 * Display name validation: trim whitespace, 1-50 char after trim.
 * A 'Névtelen túrázó' placeholder is valid (44 char, kevesebb mint 50).
 */
export const displayNameSchema = z
  .string()
  .min(1, 'Adj meg egy keresztnevet')
  .max(50, 'Maximum 50 karakter')
  .transform((s) => s.trim())
  .refine((s) => s.length >= 1, 'Adj meg egy keresztnevet (1-50 karakter)');

/**
 * A profile update payload: csak a user által módosítható mezők.
 * Az id-t a session biztosítja, NEM a body-ból.
 */
export const profileUpdateSchema = z.object({
  display_name: displayNameSchema,
  avatar_url: z.string().url().nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/**
 * Privacy-safe projection (más user számára): NEM tartalmazza az email-t,
 * a created_at/updated_at timestamp-eket, vagy más belső mezőt. Csak a
 * display_name + avatar_url + bio (opcionális).
 */
export const profilePublicSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable().optional(),
});

export type ProfilePublic = z.infer<typeof profilePublicSchema>;

/**
 * A saját profil (self): minden mező, csak a user maga olvassa.
 */
export const profileSelfSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  bio: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
});

export type ProfileSelf = z.infer<typeof profileSelfSchema>;

/**
 * Privacy-first helper: ha a display_name placeholder-e 'Névtelen túrázó',
 * a kliens oldali composable a fallback szöveget mutatja. Ez a helper
 * a kliens-oldali renderelést segíti, NEM a DB-szintű tárolást.
 */
export const PLACEHOLDER_DISPLAY_NAME = 'Névtelen túrázó';

export const isPlaceholderDisplayName = (displayName: string | null): boolean => {
  return !displayName || displayName.trim() === PLACEHOLDER_DISPLAY_NAME;
};
