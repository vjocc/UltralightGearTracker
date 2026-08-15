/**
 * Server-side wrapper. Re-exports the shared schema so existing
 * server/api/* imports (which import from this file) keep working —
 * mirrors the gearSchemas / tripSchemas / tripShareSchemas pattern.
 */
export {
  publicListUpsertSchema,
  type PublicListUpsertInput,
} from '~/shared/publicListSchemas';