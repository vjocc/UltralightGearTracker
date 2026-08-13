/**
 * Server-side wrapper. Re-exports the shared schemas so the existing
 * server/api/trips/[id]/recap/* imports keep working without code changes.
 */
export {
  recapUpsertSchema,
  recapPatchSchema,
  photoPatchSchema,
  type RecapUpsertInput,
  type RecapPatchInput,
  type PhotoPatchInput,
} from '~/shared/recapSchemas';