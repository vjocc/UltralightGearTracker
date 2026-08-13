/**
 * Server-side wrapper. Re-exports the shared schema so the existing
 * server/api/wishlist/* imports keep working without code changes.
 */
export {
  wishlistCreateSchema,
  wishlistUpdateSchema,
  type WishlistCreateInput,
  type WishlistUpdateInput,
} from '~/shared/wishlistSchemas';
