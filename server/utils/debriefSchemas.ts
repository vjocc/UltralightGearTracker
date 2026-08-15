/**
 * Server-side wrapper. Re-exports the shared schema so the existing
 * server/api/trips/[id]/debrief.* imports keep working without code changes.
 */
export {
  debriefUpsertSchema,
  type DebriefUpsertInput,
} from '~/shared/debriefSchemas';