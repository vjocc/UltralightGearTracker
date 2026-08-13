/**
 * Server-side re-export of the shared category schema so endpoint
 * imports (`import { categoryCreateSchema } from '~/server/utils/categorySchemas'`)
 * keep the same path other CRUD endpoints use. Single source of truth
 * remains in ~/shared/categorySchemas.ts.
 */
export { categoryCreateSchema } from '~/shared/categorySchemas';
export type { CategoryCreateInput } from '~/shared/categorySchemas';
