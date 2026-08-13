/**
 * Server-side wrapper. Re-exports the shared schema so the existing
 * server/api/trips/* imports keep working without code changes.
 */
export {
  tripCreateSchema,
  tripUpdateSchema,
  tripGearAddSchema,
  tripGearUpdateSchema,
  type TripCreateInput,
  type TripUpdateInput,
  type TripGearAddInput,
  type TripGearUpdateInput,
} from '~/shared/tripSchemas';