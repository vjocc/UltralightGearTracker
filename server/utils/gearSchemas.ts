/**
 * Server-side wrapper. Re-exports the shared schema so the existing
 * server/api/gear/* imports (which all import from this file) keep
 * working unchanged.
 */
export {
  gearCreateSchema,
  gearUpdateSchema,
  type GearCreateInput,
  type GearUpdateInput,
} from '~/shared/gearSchemas';
