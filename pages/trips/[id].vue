<script setup lang="ts">
/**
 * Trip detail page. Reads the trip (with nested trip_gear) and renders
 * the TripGearPicker against the user's own gear_items.
 *
 * State machine:
 *   - loading: thin "Loading…" line
 *   - error (404): redirect back to /trips
 *   - empty gear: picker renders the "No gear selected yet" copy via
 *     the picker's own empty state (zero draft entries stay unchecked)
 *   - populated: picker renders checkboxes + qty steppers
 *
 * Save batches add/update/remove diffs from the picker and applies them
 * via useTrips() so state.current stays in sync.
 *
 * GPX upload block (P1):
 *   - When `trip.gpx_metadata === null`, render a "Tervem feltöltése
 *     .gpx" file input button + an optional `target_date` picker.
 *   - On upload success, the composable mirrors gpx_metadata +
 *     planned_* into state.current and the summary card re-renders.
 *   - When metadata exists, render the summary card ("Táv: … · Szint:
 *     … · Becsült idő: …") plus a small 200×100 SVG track preview
 *     fetched from /api/trips/:id/map on demand.
 */
import type { TripRow } from '~/types/db';

definePageMeta({
  title: 'Trip',
});

const route = useRoute();
const tripId = computed(() => String(route.params.id ?? ''));

const {
  state,
  list,
  get,
  update,
  remove,
  addGear,
  updateGearQty,
  removeGear,
  uploadGpx,
  // P2 Social
  inviteByEmail,
  listInvites,
  removeInvite,
  // P3 Recap + photos
  getRecap,
  upsertRecap,
  updateRecap,
  deleteRecap,
  uploadPhoto,
  reorderPhoto,
  updatePhotoCaption,
  deletePhoto,
  resetError,
} = useTrips();
const { state: gearState, list: listGear } = useGear();
const { state: catState, list: listCategories } = useCategories();

const user = useSessionUser();
const { fetchOnce: fetchTripWeight, refresh: refreshTripWeight } =
  useTripWeight(tripId.value);

// Gated by middleware; defensive guard for SSR pre-hydration.
if (import.meta.client && !user.value) {
  await navigateTo(`/signin?next=/trips/${tripId.value}`);
}

// Modal state for inline trip metadata edit (re-uses TripFormModal).
const modalOpen = ref(false);
const submitting = ref(false);

const openEdit = () => {
  modalOpen.value = true;
};
const closeModal = () => {
  modalOpen.value = false;
};

const handleMetaSubmit = async (payload: {
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
}) => {
  submitting.value = true;
  try {
    await update(tripId.value, payload);
    closeModal();
  } catch {
    // surfaced via state.error
  } finally {
    submitting.value = false;
  }
};

const handleDelete = async (trip: TripRow) => {
  if (!confirm(`Delete "${trip.name}"? This cannot be undone.`)) return;
  try {
    await remove(trip.id);
    await navigateTo('/trips');
  } catch {
    // surfaced via state.error
  }
};

const pickerSubmitting = ref(false);

const handlePickerSave = async (payload: {
  add: Array<{ gear_item_id: string; quantity: number }>;
  update: Array<{ gear_item_id: string; quantity: number }>;
  remove: string[];
}) => {
  pickerSubmitting.value = true;
  try {
    // Apply in order: add first so subsequent update/remove find the
    // row id, then updates, then deletes.
    for (const a of payload.add) {
      await addGear(tripId.value, a.gear_item_id, a.quantity);
    }
    for (const u of payload.update) {
      await updateGearQty(tripId.value, u.gear_item_id, u.quantity);
    }
    for (const gearId of payload.remove) {
      await removeGear(tripId.value, gearId);
    }
  } catch {
    // surfaced via state.error
  } finally {
    pickerSubmitting.value = false;
    // Refresh the server-aggregated summary so the sticky panel shows
    // the new totals immediately (acceptance #6 — picker save must
    // update the summary without a manual reload).
    await refreshTripWeight();
  }
};

const dateLabel = computed(() => {
  const t = state.value.current;
  if (!t) return '';
  if (!t.start_date && !t.end_date) return 'No dates set';
  if (t.start_date && t.end_date && t.start_date === t.end_date) return t.start_date;
  if (t.start_date && t.end_date) return `${t.start_date} → ${t.end_date}`;
  return t.start_date ?? t.end_date ?? '';
});

const gearCount = computed(() => state.value.current?.trip_gear.length ?? 0);

// --- GPX upload + summary card + SVG preview -----------------------------
const gpxFileInput = ref<HTMLInputElement | null>(null);
const gpxUploading = ref(false);
const gpxTargetDate = ref<string>('');
// Client-side empty-file guard. Mirrors what the API will say, but
// keeps the user from waiting on a network round-trip for a known
// bad case. The canonical message stays Hungarian.
const gpxLocalError = ref<string | null>(null);

const formatHours = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m} perc`;
  if (m === 0) return `${h} óra`;
  return `${h}ó ${m}p`;
};

const formatKm = (km: number): string => km.toFixed(1);

const triggerGpxPicker = () => {
  // Don't open the picker mid-upload — avoid race on the same <input>.
  if (gpxUploading.value) return;
  // Clear inline client-side error before a fresh attempt.
  gpxLocalError.value = null;
  gpxFileInput.value?.click();
};

const onGpxFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  // Reset the input value so picking the same file twice still fires.
  target.value = '';
  if (!file) return;

  // Cheap pre-flight: empty file or missing extension is the most
  // common mistake and the API will reject it anyway. Surface it
  // inline (warm earth-clay, not destructive red) so the user
  // can correct without leaving the page.
  if (file.size === 0) {
    gpxLocalError.value = 'Üres vagy érvénytelen GPX fájl';
    return;
  }
  if (!/\.gpx$/i.test(file.name)) {
    gpxLocalError.value = 'Üres vagy érvénytelen GPX fájl';
    return;
  }

  gpxLocalError.value = null;
  await submitGpxUpload(file);
};

const submitGpxUpload = async (file: File) => {
  gpxUploading.value = true;
  try {
    await uploadGpx(tripId.value, file, {
      target_date: gpxTargetDate.value || null,
    });
    gpxTargetDate.value = '';
    // Pull the SVG preview after a successful upload.
    await fetchMapPreview();
  } catch {
    // surfaced via state.error
  } finally {
    gpxUploading.value = false;
  }
};

interface MapPreview {
  width: number;
  height: number;
  d: string;
  has_track: boolean;
}
const mapPreview = ref<MapPreview | null>(null);
const mapLoading = ref(false);

const fetchMapPreview = async () => {
  if (!state.value.current?.gpx_metadata) return;
  mapLoading.value = true;
  try {
    mapPreview.value = await $fetch<MapPreview>(
      `/api/trips/${tripId.value}/map`
    );
  } catch {
    mapPreview.value = null;
  } finally {
    mapLoading.value = false;
  }
};

watch(
  () => state.value.current?.gpx_metadata,
  (m) => {
    if (m) {
      void fetchMapPreview();
    } else {
      mapPreview.value = null;
    }
  }
);

const hasMetadata = computed(() => !!state.value.current?.gpx_metadata);

// Summary card stat-sorok — strukturált forma (kulcs + érték), hogy
// a tabular-nums utility a számokra tudjon ülni, és a sor ne egy
// stringként fusson össze. A separator ("·") a markupban marad,
// mert SSR/print kontextusban is jól olvasható.
interface SummaryStat {
  label: string;
  value: string;
  unit?: string;
}
const summaryStats = computed<SummaryStat[]>(() => {
  const m = state.value.current?.gpx_metadata;
  if (!m) return [];
  return [
    { label: 'Táv', value: formatKm(m.total_distance_km), unit: 'km' },
    {
      label: 'Szint',
      value: `+${m.elevation_gain_m}`,
      unit: 'm',
    },
    {
      label: 'Becsült idő',
      value: m.duration_min ? formatHours(m.duration_min) : 'ismeretlen',
    },
  ];
});

// Egyetlen soros fallback (pl. tooltip / print / screen reader).
const summaryLine = computed(() => {
  const t = state.value.current;
  const m = t?.gpx_metadata;
  if (!m) return '';
  const dist = formatKm(m.total_distance_km);
  const gain = m.elevation_gain_m;
  const time = m.duration_min
    ? `Becsült idő: ${formatHours(m.duration_min)}`
    : 'Idő: ismeretlen';
  return `Táv: ${dist} km · Szint: +${gain} m · ${time}`;
});

// --- Invite section (P2 Social) -------------------------------------------
const inviteEmail = ref('');
const inviteSubmitting = ref(false);
const inviteLocalError = ref<string | null>(null);

const isTripOwner = computed(
  () => !!user.value && !!state.value.current && state.value.current.user_id === user.value.id,
);

const invites = computed(() => state.value.invitesByTripId[tripId.value] ?? []);

const basicEmailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const canInvite = computed(() => {
  if (!isTripOwner.value) return false;
  const e = inviteEmail.value.trim();
  return basicEmailRe.test(e);
});

const invite = async () => {
  if (!canInvite.value || inviteSubmitting.value) return;
  inviteSubmitting.value = true;
  inviteLocalError.value = null;
  try {
    await inviteByEmail(tripId.value, inviteEmail.value.trim());
    inviteEmail.value = '';
  } catch {
    // surfaced via state.error
  } finally {
    inviteSubmitting.value = false;
  }
};

const handleRemoveInvite = async (inviteId: string) => {
  if (!confirm('Remove this invite?')) return;
  try {
    await removeInvite(tripId.value, inviteId);
  } catch {
    // surfaced via state.error
  }
};

const inviteStatusLabel = (s: string): string => {
  if (s === 'pending') return 'pending';
  if (s === 'accepted') return 'elfogadva';
  if (s === 'declined') return 'elutasítva';
  return s;
};

// --- Trip recap + photos (P3) ---------------------------------------------
// Reactive binding for the owner edit form. The local refs are the source
// of truth for the textarea / slider / toggle — the server round-trip
// happens on save (upsertRecap or updateRecap). Photos have their own
// draft map (`captionDrafts`) keyed by photo id so editing one caption
// doesn't clobber another.
const recapBody = ref('');
const recapRating = ref<number | null>(null);
const recapPublic = ref(false);
const recapSaving = ref(false);

const photoFileInput = ref<HTMLInputElement | null>(null);
const photoUploading = ref(false);
const photoLocalError = ref<string | null>(null);
const captionDrafts = ref<Record<string, string>>({});
const captionSaving = ref<Record<string, boolean>>({});

const recap = computed(() => state.value.recapByTripId[tripId.value]?.recap ?? null);
const photos = computed(
  () => state.value.recapByTripId[tripId.value]?.photos ?? [],
);

// Hydrate the editor refs from the server response. We watch `recap` so
// changes from PATCH / DELETE re-populate the form correctly.
watch(
  recap,
  (r) => {
    recapBody.value = r?.body ?? '';
    recapRating.value = r?.rating_out_of_10 ?? null;
    recapPublic.value = r?.public ?? false;
  },
  { immediate: true },
);

// Photos-first UX: opening the recap section auto-creates an empty recap
// row the first time the user picks a file. The server endpoint does this
// for us — we just need to await getRecap() afterwards so the cache reflects
// the new row.
const hasRecap = computed(() => !!recap.value);
const isPublicRecap = computed(() => !!recap.value?.public);

const saveRecap = async () => {
  recapSaving.value = true;
  try {
    if (hasRecap.value) {
      await updateRecap(tripId.value, {
        body: recapBody.value,
        rating_out_of_10: recapRating.value,
        public: recapPublic.value,
      });
    } else {
      await upsertRecap(tripId.value, {
        body: recapBody.value,
        rating_out_of_10: recapRating.value,
        public: recapPublic.value,
      });
    }
  } catch {
    // surfaced via state.error
  } finally {
    recapSaving.value = false;
  }
};

const handleDeleteRecap = async () => {
  if (!confirm('Törlöd a beszámolót? A fotók is törlődnek.')) return;
  try {
    await deleteRecap(tripId.value);
  } catch {
    // surfaced via state.error
  }
};

const triggerPhotoPicker = () => {
  if (photoUploading.value) return;
  photoLocalError.value = null;
  photoFileInput.value?.click();
};

const onPhotoFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;
  // Cheap pre-flight — surface empty / wrong-type locally so the user
  // doesn't wait on the round-trip.
  if (file.size === 0) {
    photoLocalError.value = 'Üres vagy érvénytelen képfájl';
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    photoLocalError.value = 'A kép mérete meghaladja az 5 MB-os limitet';
    return;
  }
  const okMime = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (!okMime) {
    photoLocalError.value = 'Csak JPEG, PNG vagy WebP tölthető fel';
    return;
  }
  photoUploading.value = true;
  photoLocalError.value = null;
  try {
    await uploadPhoto(tripId.value, file);
  } catch {
    // surfaced via state.error
  } finally {
    photoUploading.value = false;
  }
};

const saveCaption = async (photoId: string) => {
  const draft = captionDrafts.value[photoId];
  if (draft === undefined) return;
  captionSaving.value = { ...captionSaving.value, [photoId]: true };
  try {
    await updatePhotoCaption(tripId.value, photoId, draft);
    // Clear draft so the next render reads from the canonical row.
    const next = { ...captionDrafts.value };
    delete next[photoId];
    captionDrafts.value = next;
  } catch {
    // surfaced via state.error
  } finally {
    captionSaving.value = { ...captionSaving.value, [photoId]: false };
  }
};

const handleDeletePhoto = async (photoId: string) => {
  if (!confirm('Törlöd ezt a fotót?')) return;
  try {
    await deletePhoto(photoId);
  } catch {
    // surfaced via state.error
  }
};

// Drag-and-drop reorder. We use HTML5 drag events (no vuedraggable /
// sortable dependency added — keeps the install footprint small per
// Architect §E.2). On drop, we reassign display_order for every photo
// in the new order, then PATCH only the photos whose index actually
// changed (the originalIndex !== newIndex filter — the Architect §E.2
// warning about losing intermediate reorders).
const dragPhotoId = ref<string | null>(null);

const onDragStart = (photoId: string) => {
  dragPhotoId.value = photoId;
};

const onDragEnd = () => {
  // Clear the drag-active visual state even if the drop missed a
  // valid target (otherwise the ring-2 stays stuck on the card).
  dragPhotoId.value = null;
};

const onDragOver = (event: DragEvent) => {
  // Prevent default so the drop event fires.
  event.preventDefault();
};

const onDrop = async (targetIndex: number) => {
  const srcId = dragPhotoId.value;
  dragPhotoId.value = null;
  if (!srcId) return;
  const list = photos.value;
  const srcIndex = list.findIndex((p) => p.id === srcId);
  if (srcIndex < 0 || srcIndex === targetIndex) return;
  // Reorder locally (optimistic) — mirror the move.
  const reordered = [...list];
  const [moved] = reordered.splice(srcIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  // Compute the new display_order assignments. We use 0..N-1 so the
  // relative order is canonical, regardless of gaps.
  const updates: Array<{ id: string; newOrder: number }> = [];
  reordered.forEach((p, idx) => {
    const original = list[idx];
    if (!original || original.id !== p.id) {
      updates.push({ id: p.id, newOrder: idx });
    }
  });
  // Mirror into the cache immediately so the UI updates without a
  // round-trip wait.
  const cur = state.value.recapByTripId[tripId.value];
  if (cur) {
    state.value.recapByTripId = {
      ...state.value.recapByTripId,
      [tripId.value]: {
        ...cur,
        photos: reordered.map((p, idx) => ({ ...p, display_order: idx })),
      },
    };
  }
  // Fire PATCHes for the moved entries only.
  await Promise.all(
    updates.map((u) => reorderPhoto(tripId.value, u.id, u.newOrder)),
  ).catch(() => undefined);
};

const isOwnerViewer = computed(
  () => !!user.value && state.value.current?.user_id === user.value.id,
);

// P3.3 — gate the recap section by reachability, not ownership. The
// trip SELECT policy (P2) restricts /trips/:id to owner + accepted
// invitee + accepted friend, so reaching this page with a populated
// `state.current` already implies `trip_visible_to()` is true. The
// recap + photo SELECT policies (P3) gate the rows themselves with
// the same helper, so once we're here the GET endpoint either returns
// the recap (public OR trip_visible_to = true) or `null` (stranger).
// This computed replaces the previous owner-only gate so accepted
// invitees + friends see the read-only preview block (the existing
// `v-else-if="recap"` branch below).
const canViewRecap = computed(
  () => !!state.value.current && !!user.value,
);

// Acceptable caption length is 500 — surface the live counter only when
// near the cap so the form doesn't add visual noise for short captions.
const captionLength = (s: string | null | undefined): number => s?.length ?? 0;

onMounted(async () => {
  await Promise.all([
    list(),
    listGear(),
    listCategories(),
    get(tripId.value).catch(async () => {
      // 404 (cross-user or bad id) → back to list.
      await navigateTo('/trips');
    }),
    // Kick off the aggregated summary alongside the detail fetch. Safe
    // to fire-and-forget: useTripWeight stores its own error state and
    // the panel renders the empty/error branch on its own.
    fetchTripWeight(),
    // P2 Social — load the trip's invites (owner sees pending).
    listInvites(tripId.value, 'pending').catch(() => undefined),
    // P3 Recap — load recap + photos so the preview shows immediately.
    // The endpoint returns `{recap: null, photos: []}` if no row exists
    // yet, which we tolerate silently.
    getRecap(tripId.value).catch(() => undefined),
  ]);
});
</script>

<template>
  <section>
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <NuxtLink
          to="/trips"
          class="text-xs font-medium text-moss-700 hover:text-moss-800 hover:underline"
        >
          ← Trips
        </NuxtLink>
        <h2 v-if="state.current" class="mt-1 text-xl font-semibold text-gray-900">
          {{ state.current.name }}
        </h2>
        <p v-else class="mt-1 text-sm text-gray-500">Loading…</p>
        <p v-if="state.current" class="text-sm text-gray-500">
          {{ dateLabel }} · {{ gearCount }} gear
        </p>
      </div>
      <div v-if="state.current" class="flex gap-2">
        <button
          type="button"
          class="btn-secondary px-3 py-1.5 text-sm"
          @click="openEdit"
        >
          Edit
        </button>
        <button
          type="button"
          class="btn-danger px-3 py-1.5 text-sm"
          @click="handleDelete(state.current)"
        >
          Delete
        </button>
      </div>
    </div>

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="resetError"
    />

    <div v-if="state.current" class="space-y-4">
      <TripWeightSummary :trip-id="tripId" />

      <!-- GPX upload + summary card -->
      <section
        v-if="hasMetadata"
        class="rounded-lg border border-clay-200 bg-sand-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="A túra terve"
      >
        <header class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold tracking-tight text-bark-900">
            A túra terve
          </h3>
          <span class="text-xs text-loam-500 tabular-nums">
            {{ state.current.gpx_metadata?.point_count ?? '?' }} pont
          </span>
        </header>

        <!--
          Summary stat-sor. A `dl/dt/dd` szemantikus, a `tabular-nums`
          a számokon ül, hogy a tizedesvesszők és mérőszámok
          (12.4 km · +840 m · 5ó 20p) ne "ugráljanak" a sorban.
          A separator vizuálisan `·`, mert SSR/print kontextusban is
          jól olvasható.
        -->
        <dl
          class="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm text-bark-900"
          :aria-label="summaryLine"
        >
          <div
            v-for="stat in summaryStats"
            :key="stat.label"
            class="flex items-baseline gap-1.5"
          >
            <dt class="text-xs font-medium uppercase tracking-wide text-loam-500">
              {{ stat.label }}:
            </dt>
            <dd class="tabular-nums font-semibold">
              {{ stat.value }}<span
                v-if="stat.unit"
                class="ml-0.5 text-xs font-normal text-loam-500"
              >{{ stat.unit }}</span>
            </dd>
          </div>
        </dl>

        <p
          v-if="state.current.gpx_metadata?.max_elevation_m != null"
          class="mt-2 text-xs text-loam-500"
        >
          Max magasság:
          <span class="tabular-nums text-bark-700">{{
            state.current.gpx_metadata.max_elevation_m
          }}</span>
          m
        </p>
        <p
          v-if="state.current.gpx_metadata?.source"
          class="mt-1 break-all text-xs text-loam-500"
        >
          Forrás: {{ state.current.gpx_metadata.source }}
        </p>

        <!-- SVG mini preview (optional, Architect §C).
             A 200×100 overlay designja: sand-50 keret helyett
             fehér papír-hatás (a track kontrasztja miatt), clay-300
             keret, moha stroke. -->
        <div class="mt-3">
          <svg
            v-if="mapPreview && mapPreview.has_track && mapPreview.d"
            :viewBox="`0 0 ${mapPreview.width} ${mapPreview.height}`"
            class="block h-[100px] w-[200px] rounded border border-clay-300 bg-white shadow-inner"
            role="img"
            aria-label="Túra nyomvonal előnézet"
          >
            <path
              :d="mapPreview.d"
              fill="none"
              stroke="#4d7c0f"
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
          <p
            v-else-if="mapLoading"
            class="text-xs text-loam-500"
          >
            Track előnézet betöltése…
          </p>
        </div>

        <!-- Allow re-upload: keep a small "Új .gpx" button. -->
        <div class="mt-4 flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-clay-300 bg-white px-3 py-1.5 text-xs font-medium text-bark-700 transition-colors hover:bg-sand-100 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="gpxUploading"
            @click="triggerGpxPicker"
          >
            <AppSpinner
              v-if="gpxUploading"
              class="mr-2"
              size="sm"
              color="bark"
              label="Feltöltés folyamatban"
            />
            {{ gpxUploading ? 'Feltöltés…' : 'Új .gpx feltöltése' }}
          </button>
          <input
            ref="gpxFileInput"
            type="file"
            accept=".gpx,application/gpx+xml"
            class="hidden"
            aria-label="GPX fájl kiválasztása"
            @change="onGpxFileChange"
          />
        </div>

        <!-- Lokális kliens-oldali hiba (üres / rossz kiterjesztés).
             Piros helyett meleg agyag-barna (clay), mert ez user-input
             figyelmeztetés, nem rendszerhiba. A `role="alert"` csak
             akkor aktív, ha tényleg van üzenet. -->
        <p
          v-if="gpxLocalError"
          role="alert"
          class="mt-3 flex items-start gap-2 rounded border border-clay-300 bg-bark-50 px-3 py-2 text-xs text-bark-700"
        >
          <span aria-hidden="true" class="mt-px text-clay-500">▲</span>
          <span>{{ gpxLocalError }}</span>
        </p>
      </section>

      <section
        v-else
        class="rounded-lg border border-dashed border-clay-300 bg-sand-50 p-4"
        aria-label="GPX terv feltöltése"
      >
        <h3 class="text-sm font-semibold tracking-tight text-bark-900">
          Töltsd fel a túra tervét
        </h3>
        <p class="mt-1 text-xs text-loam-500">
          A GPX fájlból kiszámoljuk a távot és a szintemelkedést, és
          megmutatjuk a nyomvonal előnézetét.
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <label
            class="flex items-center gap-2 text-xs font-medium text-bark-700"
          >
            Céldátum (opcionális)
            <input
              v-model="gpxTargetDate"
              type="date"
              class="rounded border border-clay-200 bg-white px-2 py-1 text-xs text-bark-900 tabular-nums focus:border-moss-600 focus:outline-none focus:ring-1 focus:ring-moss-600"
            />
          </label>

          <!--
            Primary CTA: mohás zöld (moss-700), nem indigo.
            A fokusz-gyűrű is moss-600, hogy a kártyán belüli
            fókusz-állapot konzisztens legyen.
          -->
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
            :disabled="gpxUploading"
            :aria-busy="gpxUploading ? 'true' : 'false'"
            @click="triggerGpxPicker"
          >
            <AppSpinner
              v-if="gpxUploading"
              class="mr-2"
              color="bark"
              label="Feltöltés folyamatban"
            />
            {{ gpxUploading ? 'Feltöltés…' : 'Tervem feltöltése .gpx' }}
          </button>
          <input
            ref="gpxFileInput"
            type="file"
            accept=".gpx,application/gpx+xml"
            class="hidden"
            aria-label="GPX fájl kiválasztása"
            @change="onGpxFileChange"
          />
        </div>

        <!-- Lokális kliens-oldali hiba (üres / rossz kiterjesztés).
             Ugyanaz a meleg agyag-barna design language, mint a
             summary card-ban — konzisztens visszajelzés. -->
        <p
          v-if="gpxLocalError"
          role="alert"
          class="mt-3 flex items-start gap-2 rounded border border-clay-300 bg-bark-50 px-3 py-2 text-xs text-bark-700"
        >
          <span aria-hidden="true" class="mt-px text-clay-500">▲</span>
          <span>{{ gpxLocalError }}</span>
        </p>
      </section>

      <p
        v-if="state.current.description"
        class="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700"
      >
        {{ state.current.description }}
      </p>

      <!--
        P3 Túra-élménybeszámoló + fotók (Architect §E).
        Owner: szerkeszthető űrlap (body + rating slider + public toggle)
        + fotó grid (upload + drag-and-drop reorder + caption + törlés).
        Non-owner: read-only preview, amennyiben a recap public = true
        VAGY a trip_visible_to (P2) alapján látható.
        P3.3 gate: was `isOwnerViewer`; now `canViewRecap` (reachability)
        so accepted invitees + friends also render the read-only branch
        below (`v-else-if="recap"`).
      -->
      <section
        v-if="canViewRecap"
        class="rounded-lg border border-clay-200 bg-sand-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Túra-élménybeszámoló"
      >
        <header class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold tracking-tight text-bark-900">
            Túra-élménybeszámoló
          </h3>
          <span
            v-if="recap?.public"
            class="rounded border border-moss-300 bg-moss-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-900"
          >
            Publikus
          </span>
        </header>
        <p class="mt-1 text-xs italic text-loam-500">
          Komfort is számít, nem csak a könnyű súly.
        </p>

        <label class="mt-3 block">
          <span class="sr-only">Beszámoló szövege</span>
          <textarea
            v-model="recapBody"
            rows="6"
            class="input w-full"
            maxlength="20000"
            placeholder="Hogy sikerült a túra? Mi volt a csúcspont, mi a tanulság?"
          />
        </label>

        <div class="mt-3 flex flex-wrap items-center gap-4">
          <label class="flex flex-1 min-w-[180px] items-center gap-3 text-xs text-bark-700">
            <span class="whitespace-nowrap font-medium">Élmény (0-10):</span>
            <input
              v-model.number="recapRating"
              type="range"
              min="0"
              max="10"
              step="1"
              class="flex-1 accent-moss-600"
              aria-label="Túra élmény értékelés 0-10"
            />
            <span class="w-12 text-right tabular-nums font-semibold text-bark-900">
              {{ recapRating ?? '–' }} / 10
            </span>
          </label>
          <label class="flex items-center gap-2 text-xs text-bark-700">
            <input
              v-model="recapPublic"
              type="checkbox"
              class="h-4 w-4 rounded border-clay-300 text-moss-700 focus:ring-moss-600"
            />
            <span>Publikus (barátok is olvashatják)</span>
          </label>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
            :disabled="recapSaving"
            @click="saveRecap"
          >
            <AppSpinner
              v-if="recapSaving"
              class="mr-2"
              size="sm"
              color="bark"
              label="Mentés folyamatban"
            />
            {{ hasRecap ? 'Mentés' : 'Létrehozás' }}
          </button>
          <button
            v-if="hasRecap"
            type="button"
            class="btn-danger px-3 py-1.5 text-sm"
            @click="handleDeleteRecap"
          >
            Törlés
          </button>
        </div>

        <!-- Fotók grid -->
        <div class="mt-5">
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center rounded-md bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
              :disabled="photoUploading"
              @click="triggerPhotoPicker"
            >
              <AppSpinner
                v-if="photoUploading"
                class="mr-2"
                size="sm"
                color="bark"
                label="Feltöltés folyamatban"
              />
              {{ photoUploading ? 'Feltöltés…' : 'Fotó hozzáadása' }}
            </button>
            <input
              ref="photoFileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              aria-label="Túra fotó kiválasztása"
              @change="onPhotoFileChange"
            />
            <span class="text-xs text-loam-500">
              Max 5 MB, JPEG / PNG / WebP
            </span>
          </div>

          <p
            v-if="photoLocalError"
            role="alert"
            class="mt-2 flex items-start gap-2 rounded border border-clay-300 bg-bark-50 px-3 py-2 text-xs text-bark-700"
          >
            <span aria-hidden="true" class="mt-px text-clay-500">▲</span>
            <span>{{ photoLocalError }}</span>
          </p>

          <p
            v-if="photos.length === 0"
            class="mt-3 text-xs italic text-loam-500"
          >
            Még nincs fotó. A beszámoló elkészülhet fotók nélkül is —
            töltsd fel a legszebb pillanatokat, hogy emlékezetes maradjon.
          </p>

          <ul
            v-else
            class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <li
              v-for="(photo, idx) in photos"
              :key="photo.id"
              class="overflow-hidden rounded border border-clay-200 bg-white transition-all duration-200 hover:ring-1 hover:ring-moss-500 hover:scale-[1.01] hover:cursor-grab"
              :class="dragPhotoId === photo.id ? 'ring-2 ring-moss-700 scale-[1.02] cursor-grabbing' : ''"
              :draggable="true"
              @dragstart="onDragStart(photo.id)"
              @dragover="onDragOver($event)"
              @drop="onDrop(idx)"
              @dragend="onDragEnd"
            >
              <!--
                Ha nincs public_url (pl. a server nem dekorálta), esünk
                vissza egy monogram placeholder-re (két betű a photo id
                utolsó két hex karakteréből).
              -->
              <div class="relative h-48 w-full bg-clay-100">
                <img
                  v-if="photo.public_url"
                  :src="photo.public_url"
                  :alt="photo.caption ?? 'Túra fotó'"
                  class="h-full w-full object-cover"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-2xl font-bold text-clay-700"
                >
                  {{ (photo.id || '').slice(-2).toUpperCase() || 'M' }}
                </div>
                <span
                  class="absolute left-2 top-2 rounded bg-bark-900/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sand-50"
                  aria-hidden="true"
                >
                  #{{ idx + 1 }}
                </span>
              </div>
              <div class="space-y-1 p-2">
                <input
                  :value="captionDrafts[photo.id] ?? photo.caption ?? ''"
                  type="text"
                  class="input w-full text-xs"
                  maxlength="500"
                  placeholder="Monogram képaláírás…"
                  @input="captionDrafts = { ...captionDrafts, [photo.id]: ($event.target as HTMLInputElement).value }"
                />
                <div class="flex items-center justify-between text-[10px] text-loam-500">
                  <span v-if="captionLength(captionDrafts[photo.id] ?? photo.caption) > 400">
                    {{ captionLength(captionDrafts[photo.id] ?? photo.caption) }} / 500
                  </span>
                  <span v-else>&nbsp;</span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <button
                    v-if="captionDrafts[photo.id] !== undefined && captionDrafts[photo.id] !== (photo.caption ?? '')"
                    type="button"
                    class="text-xs font-medium text-moss-700 underline disabled:opacity-60"
                    :disabled="captionSaving[photo.id]"
                    @click="saveCaption(photo.id)"
                  >
                    {{ captionSaving[photo.id] ? 'Mentés…' : 'Mentés' }}
                  </button>
                  <span v-else aria-hidden="true">&nbsp;</span>
                  <button
                    type="button"
                    class="text-xs font-medium text-clay-700 underline"
                    @click="handleDeletePhoto(photo.id)"
                  >
                    Törlés
                  </button>
                </div>
              </div>
            </li>
          </ul>
          <p class="mt-2 text-[11px] text-loam-500">
            Húzd el a kártyákat az átrendezéshez.
          </p>
        </div>
      </section>

      <!--
        Non-owner read-only preview. Csak akkor jelenik meg, ha van recap
        ÉS (recap.public = true VAGY trip_visible_to alapján látható —
        ez utóbbit a server-side RLS garantálja, a GET hívás 200-zal
        jön vissza csak ilyenkor).
      -->
      <section
        v-else-if="recap"
        class="rounded-lg border border-clay-200 bg-sand-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Túra beszámoló"
      >
        <header class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold tracking-tight text-bark-900">
            Beszámoló
          </h3>
          <span
            v-if="recap.rating_out_of_10 !== null && recap.rating_out_of_10 !== undefined"
            class="rounded border border-clay-300 bg-clay-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-clay-900 tabular-nums"
          >
            Élmény: {{ recap.rating_out_of_10 }} / 10
          </span>
        </header>
        <p class="mt-2 whitespace-pre-wrap text-sm text-bark-900">
          {{ recap.body ?? '…' }}
        </p>

        <ul
          v-if="photos.length > 0"
          class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
        >
          <li
            v-for="photo in photos"
            :key="photo.id"
            class="overflow-hidden rounded border border-clay-200 bg-white"
          >
            <div class="h-48 w-full bg-clay-100">
              <img
                v-if="photo.public_url"
                :src="photo.public_url"
                :alt="photo.caption ?? 'Túra fotó'"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-2xl font-bold text-clay-700"
              >
                {{ (photo.id || '').slice(-2).toUpperCase() || 'M' }}
              </div>
            </div>
            <p
              v-if="photo.caption"
              class="px-2 py-1 text-xs text-bark-700"
            >
              {{ photo.caption }}
            </p>
            <p
              v-else
              class="px-2 py-1 text-xs italic text-loam-500"
            >
              Monogram fotó
            </p>
          </li>
        </ul>
      </section>

      <div>
        <h3 class="mb-2 text-sm font-semibold text-gray-900">
          Gear in this trip
        </h3>
        <p v-if="gearState.items.length === 0" class="text-sm text-gray-500">
          Your kit is empty — add gear first, then come back to pick items for this trip.
        </p>
        <TripGearPicker
          v-else
          :trip="state.current"
          :gear="gearState.items"
          :categories="catState.items"
          :submitting="pickerSubmitting"
          @save="handlePickerSave"
        />
      </div>

      <!-- P2 Social — invite + comment thread. -->
      <section
        v-if="isTripOwner"
        class="rounded-lg border border-clay-200 bg-sand-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Barátok meghívása"
      >
        <header class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold tracking-tight text-bark-900">
            Barátok meghívása
          </h3>
          <span class="text-xs text-loam-500">
            {{ invites.length }} aktív
          </span>
        </header>
        <p class="mt-1 text-xs text-loam-500">
          Ha a cím regisztrált, automatikusan kap értesítést.
        </p>

        <form
          class="mt-3 flex flex-wrap items-center gap-2"
          @submit.prevent="invite"
        >
          <label class="sr-only" :for="`invite-email-${tripId}`">
            Barát email
          </label>
          <input
            :id="`invite-email-${tripId}`"
            v-model="inviteEmail"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="barát@példa.hu"
            class="min-w-0 flex-1 rounded border border-clay-200 bg-white px-3 py-1.5 text-sm text-bark-900 focus:border-moss-600 focus:outline-none focus:ring-1 focus:ring-moss-600"
          />
          <button
            type="submit"
            class="inline-flex items-center rounded-md bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
            :disabled="!canInvite || inviteSubmitting"
          >
            <AppSpinner
              v-if="inviteSubmitting"
              class="mr-2"
              size="sm"
              color="bark"
              label="Meghívó küldése folyamatban"
            />
            {{ inviteSubmitting ? 'Hívás…' : 'Invite' }}
          </button>
        </form>

        <ul
          v-if="invites.length > 0"
          class="mt-3 divide-y divide-clay-200 rounded border border-clay-200 bg-white"
        >
          <li
            v-for="inv in invites"
            :key="inv.id"
            class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-bark-700"
          >
            <span class="truncate font-medium">{{ inv.invitee_email }}</span>
            <span
              v-if="inv.status === 'pending'"
              class="shrink-0 rounded border border-clay-300 bg-clay-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-clay-900"
            >
              {{ inviteStatusLabel(inv.status) }}
            </span>
            <span
              v-else-if="inv.status === 'accepted'"
              class="shrink-0 rounded border border-moss-300 bg-moss-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-900"
            >
              {{ inviteStatusLabel(inv.status) }}
            </span>
            <span
              v-else-if="inv.status === 'declined'"
              class="shrink-0 rounded border border-sand-300 bg-sand-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bark-900"
            >
              {{ inviteStatusLabel(inv.status) }}
            </span>
            <span
              v-else
              class="shrink-0 text-loam-500"
            >
              {{ inviteStatusLabel(inv.status) }}
            </span>
            <button
              v-if="inv.status === 'pending'"
              type="button"
              class="btn-secondary shrink-0 px-2 py-1 text-xs"
              @click="handleRemoveInvite(inv.id)"
            >
              Mégse
            </button>
          </li>
        </ul>
      </section>

      <TripCommentThread
        v-if="user && state.current"
        :trip-id="tripId"
        :current-user-id="user.id"
        :trip-owner-id="state.current.user_id"
      />
    </div>

    <TripFormModal
      :open="modalOpen"
      :item="state.current"
      :submitting="submitting"
      @close="closeModal"
      @submit="handleMetaSubmit"
    />
  </section>
</template>