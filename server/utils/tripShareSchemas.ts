/**
 * Server-side wrapper. Re-exports the shared schema so existing
 * server/api/* imports (which import from this file) keep working.
 */
export {
  inviteCreateSchema,
  type InviteCreateInput,
} from '~/shared/tripShareSchemas';
