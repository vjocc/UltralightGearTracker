import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server';
import type { Database, TripRecapPhotoRow } from '~/types/db';
import { getUserId } from '~/server/utils/auth';

/**
 * POST /api/trips/:id/recap/photos
 *
 * Multipart upload endpoint for trip recap photos.
 *
 * Body shape (multipart/form-data):
 *   * `file`     (required) — image bytes (jpeg/png/webp, max 5 MB)
 *   * `caption`  (optional) — caption text (max 500 chars)
 *
 * Flow:
 *   1. Auth + MIME + size validation (H3's `readMultipartFormData` parses).
 *   2. If no recap row exists for this trip, auto-create an empty one
 *      (body=null, rating=null, public=false) so the photos-first UX
 *      works (the user can drop photos before writing the report).
 *   3. Compute `storage_path = "{user_id}/{trip_id}/{recap_id}/{photo_id}.{ext}"`
 *      and upload via the Storage SDK. The path's leading `{user_id}/`
 *      matches the storage.objects RLS owner check (`auth.uid() = ...`).
 *   4. Insert the trip_recap_photos row with display_order = next slot.
 *   5. Return `{ photo: TripRecapPhotoRow, publicUrl: string }`.
 *
 * The `trip-photos` bucket is public-read so the page can render <img src>
 * without a signed-URL round-trip.
 */
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Bejelentkezés szükséges' });
  }
  const userId = getUserId(user);
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Ismeretlen felhasználó' });
  }

  const tripId = getRouterParam(event, 'id');
  if (!tripId) {
    throw createError({ statusCode: 400, statusMessage: 'Hiányzó túra azonosító' });
  }

  const parts = await readMultipartFormData(event);
  if (!parts || parts.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Hiányzó fájl a kérésből',
    });
  }

  const filePart = parts.find((p) => p.name === 'file');
  if (!filePart || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A "file" mező kötelező',
    });
  }

  const type = (filePart.type ?? '').toLowerCase();
  if (!ALLOWED_MIME.has(type)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Csak JPEG, PNG vagy WebP kép tölthető fel',
    });
  }

  if (filePart.data.byteLength > MAX_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'A kép mérete meghaladja az 5 MB-os limitet',
    });
  }

  const captionPart = parts.find((p) => p.name === 'caption');
  const captionRaw = captionPart?.data?.toString('utf-8') ?? '';
  const caption = captionRaw.trim().slice(0, 500);

  const supabase = await serverSupabaseClient<Database>(event);

  // Resolve / create the parent recap. The INSERT relies on the RLS WITH
  // CHECK (owner of parent trip), so a non-owner caller gets 404 here.
  let recapId: string;
  {
    const { data: existing, error: recapErr } = await supabase
      .from('trip_recaps')
      .select('id')
      .eq('trip_id', tripId)
      .maybeSingle();
    if (recapErr) {
      throw createError({ statusCode: 500, statusMessage: recapErr.message });
    }
    if (existing?.id) {
      recapId = existing.id;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from('trip_recaps')
        .insert({ trip_id: tripId, public: false })
        .select('id')
        .single();
      if (insertErr || !created) {
        throw createError({
          statusCode: 404,
          statusMessage: 'A túra nem található vagy nem a tiéd',
        });
      }
      recapId = created.id;
    }
  }

  // Compute the storage path. `{user_id}/` prefix matches the storage
  // RLS policy check `(storage.foldername(name))[1] = auth.uid()::text`.
  const photoId = crypto.randomUUID();
  const ext = MIME_TO_EXT[type] ?? 'jpg';
  const storagePath = `${userId}/${tripId}/${recapId}/${photoId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('trip-photos')
    .upload(storagePath, filePart.data, {
      contentType: type,
      upsert: false,
    });

  if (uploadError) {
    throw createError({
      statusCode: 500,
      statusMessage: `A kép feltöltése sikertelen: ${uploadError.message}`,
    });
  }

  // Compute the next display_order slot. We use `select max+1` rather than
  // a count(*) so gaps from past deletes don't crash the ordering.
  let displayOrder = 0;
  {
    const { data: maxRow, error: maxErr } = await supabase
      .from('trip_recap_photos')
      .select('display_order')
      .eq('recap_id', recapId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      throw createError({ statusCode: 500, statusMessage: maxErr.message });
    }
    if (maxRow?.display_order != null) {
      displayOrder = maxRow.display_order + 1;
    }
  }

  const { data: photoRow, error: photoErr } = await supabase
    .from('trip_recap_photos')
    .insert({
      trip_id: tripId,
      recap_id: recapId,
      storage_path: storagePath,
      caption: caption || null,
      display_order: displayOrder,
    })
    .select()
    .single();

  if (photoErr || !photoRow) {
    // Roll back the uploaded storage object so we don't leak an orphan.
    await supabase.storage.from('trip-photos').remove([storagePath]).catch(() => undefined);
    throw createError({
      statusCode: 500,
      statusMessage: photoErr?.message ?? 'A fotó rekord mentése sikertelen',
    });
  }

  const { data: pub } = supabase.storage
    .from('trip-photos')
    .getPublicUrl(storagePath);

  return {
    photo: { ...(photoRow as TripRecapPhotoRow), public_url: pub.publicUrl },
    publicUrl: pub.publicUrl,
  };
});