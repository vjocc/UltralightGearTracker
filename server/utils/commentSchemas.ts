/**
 * Server-side wrapper. Re-exports the shared schema so existing
 * server/api/* imports (which import from this file) keep working.
 */
export {
  commentCreateSchema,
  commentUpdateSchema,
  lookupEmailsSchema,
  type CommentCreateInput,
  type CommentUpdateInput,
  type LookupEmailsInput,
} from '~/shared/commentSchemas';