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
import type { TripRow, UUID } from '~/types/db';

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
  // Sprint 5 P2 — "Ki mit visz" user-hozzárendelés
  updateGearAssignment,
  fetchGearAssignments,
  uploadGpx,
  // P2 Social
  inviteByEmail,
  listInvites,
  acceptInvite,
  declineInvite,
  removeInvite,
  listTripComments,
  listParticipants,
  // P3 Recap + photos
  getRecap,
  upsertRecap,
  updateRecap,
  deleteRecap,
  uploadPhoto,
  reorderPhoto,
  updatePhotoCaption,
  deletePhoto,
  // P5 Debrief
  loadDebrief,
  saveDebrief,
  // Sprint 5 P0.3 — markTripCompleted a "Túra lezárása" gombhoz (spec §4.2).
  // A useTrips composable metódus a first_completed_trip activation eventet
  // is capture-eli (1ced32e commit); itt csak a page-szintű state frissül
  // a composable update által.
  markTripCompleted,
  resetError,
} = useTrips();
const { state: gearState, list: listGear } = useGear();
const { state: catState, list: listCategories } = useCategories();

const user = useSessionUser();
const { fetchOnce: fetchTripWeight, refresh: refreshTripWeight } =
  useTripWeight(tripId.value);
// P7 / v2 #22 — dedikált composable, NEM useTrips/useStats bővítése
// (v2 §0 #5: Trip ≠ My Gear; a loadout 4 forrásból aggregál).
const {
  state: loadoutRecsState,
  load: loadLoadoutRecs,
  get: getLoadoutRecs,
  emptyStateCopy: loadoutEmptyStateCopy,
  reasonCopy: loadoutReasonCopy,
} = useLoadoutRecommendations();

// Az aktuális trip loadout ajánlás-repsonse (read-only cache a
// useState-ből).
const loadoutRecsResponse = computed(() =>
  getLoadoutRecs(tripId.value),
);
const loadoutRecsMeta = computed(
  () => loadoutRecsResponse.value?.meta ?? null,
);
const loadoutRecsAdd = computed(
  () => loadoutRecsResponse.value?.add_candidates ?? [],
);
const loadoutRecsKeep = computed(
  () => loadoutRecsResponse.value?.keep_candidates ?? [],
);
const loadoutRecsReady = computed(() => {
  const r = loadoutRecsResponse.value;
  if (!r) return null;
  return r.meta?.readiness ?? null;
});
const loadoutRecsSubtitle = computed(() =>
  loadoutEmptyStateCopy(loadoutRecsReady.value),
);

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

/**
 * Sprint 5 P2 — owner-only "Hozzárendelés" dropdown change handler.
 * A TripGearPicker a PATCH-et a useTrips.updateGearAssignment-on
 * keresztül küldi; a response (a frissített trip_gear sor) a
 * state.current.trip_gear tömbbe kerül, a gearAssignmentsByTripId
 * cache invalidálódik.
 */
const handlePickerAssign = async (payload: {
  gear_item_id: string;
  assigned_to_user_id: string | null;
}) => {
  try {
    await updateGearAssignment(
      tripId.value,
      payload.gear_item_id,
      payload.assigned_to_user_id,
    );
  } catch {
    // surfaced via state.error
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

// P3.2 — invite status label shared between the Meghívók panel and the
// Meghívó banner. Stays Hungarian for owner-side list rows, English
// for the existing invite <ul> badge.
const inviteStatusLabel = (s: string): string => {
  if (s === 'pending') return 'pending';
  if (s === 'accepted') return 'elfogadva';
  if (s === 'declined') return 'elutasítva';
  return s;
};

// P3.2 — pending invite addressed to the signed-in viewer. Used by
// the Meghívó banner. Non-null when the current user has a `pending`
// row on this trip where `invitee_user_id === user.id`.
const myPendingInvite = computed(() => {
  const me = user.value?.id;
  if (!me) return null;
  const list = invites.value;
  return list.find((i) => i.invitee_user_id === me && i.status === 'pending') ?? null;
});

// P3.2 — inviter email for the Meghívó banner. Falls back to the
// invitee_email (owner's signup email) if the lookup cache doesn't
// have it yet.
const inviterEmailForMyInvite = computed(() => {
  const inv = myPendingInvite.value;
  if (!inv) return null;
  return state.value.emailById[inv.inviter_id] ?? null;
});

// P3.2 — per-status invite buckets for the owner-only Meghívók panel.
// The pending list also doubles as the source for the Barátok
// meghívása szekció "Mégse" button.
const pendingInvites = computed(
  () => invites.value.filter((i) => i.status === 'pending'),
);
const acceptedInvites = computed(
  () => invites.value.filter((i) => i.status === 'accepted'),
);
const declinedInvites = computed(
  () => invites.value.filter((i) => i.status === 'declined'),
);

// P3.2 — Résztvevők szekció. Sourced from the cached
// participantsByTripId (owner + accepted invitees with resolved
// emails). Read-only when the viewer is not the trip owner (no
// invite / remove controls).
const participants = computed(
  () => state.value.participantsByTripId[tripId.value] ?? [],
);

// Sprint 5 P2 — "Ki mit visz" aggregált nézet cache. A fetch-et
// az `await loadGearAssignments()` lazy triggereli; a template
// `v-if` gate (`isTripOwner`) védi a nem-owner hívókat.
const gearAssignments = computed(
  () => state.value.gearAssignmentsByTripId[tripId.value] ?? null,
);

/**
 * P2 — "Ki mit visz" aggregált nézet lazy betöltése. A page
 * mountkor hívjuk (a listParticipants-szel párhuzamosan). A
 * owner-only gate-et a template `v-if` biztosítja — a
 * fetchGearAssignments 403/404 esetén nem szennyezi a state.error-t.
 */
const loadGearAssignments = async () => {
  await fetchGearAssignments(tripId.value).catch(() => null);
};

// P3.2 — Accept/Decline handlers for the Meghívó banner. The server
// endpoint returns 409 when the invite is not in pending state, so we
// re-fetch the accepted list to refresh the Résztvevők list.
const acceptingInvite = ref(false);
const decliningInvite = ref(false);

const handleAcceptMyInvite = async () => {
  const inv = myPendingInvite.value;
  if (!inv || acceptingInvite.value || decliningInvite.value) return;
  acceptingInvite.value = true;
  try {
    await acceptInvite(tripId.value, inv.id);
    // Refresh the participant list so the accepted invitee appears
    // immediately in the Résztvevők szekció.
    await listParticipants(tripId.value).catch(() => undefined);
  } catch {
    // surfaced via state.error
  } finally {
    acceptingInvite.value = false;
  }
};

const handleDeclineMyInvite = async () => {
  const inv = myPendingInvite.value;
  if (!inv || acceptingInvite.value || decliningInvite.value) return;
  decliningInvite.value = true;
  try {
    await declineInvite(tripId.value, inv.id);
  } catch {
    // surfaced via state.error
  } finally {
    decliningInvite.value = false;
  }
};

// P3.2 — when the owner removes an accepted invite, refresh the
// participants list so the row drops immediately.
const handleRemoveInviteAndRefresh = async (inviteId: UUID) => {
  await handleRemoveInvite(inviteId);
  await listParticipants(tripId.value).catch(() => undefined);
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

// --- Trip debrief (P5 / v2 #23 "Mit bántam meg?") -------------------------
// A 3 text[] mezőhöz 1-1 lokális reaktív tömb, plusz egy "saving" flag.
// A szerver-oldali validáció a `debriefUpsertSchema` (max 50 item / mező,
// max 120 char / item). Az owner-only POST endpoint fogadja az üres
// tömböket is (default `[]` a séma oldalon).
const debriefExcess = ref<string[]>([]);
const debriefMissing = ref<string[]>([]);
const debriefUncomfortable = ref<string[]>([]);
const debriefSaving = ref(false);
const debriefInitialized = ref(false);

// Sprint 5 P0.1 — inline save feedback (Sprint 4.2 #3 komfort-minta).
// `debriefSavedRecently` 2mp-ig true a sikeres save után, a "✓ Mentve"
// feliratot a save gomb mellett jeleníti meg. `debriefLocalError` a section
// fölötti lokális piros szöveg, ha a save dob (a page-szintű ErrorBanner
// helyett — a user ne veszítse el a kontextust, ha más section-ön dolgozik).
const debriefSavedRecently = ref(false);
const debriefLocalError = ref<string | null>(null);
let debriefSaveTimer: ReturnType<typeof setTimeout> | null = null;

const debrief = computed(
  () => state.value.debriefByTripId[tripId.value] ?? null,
);

// Első mount: hydráld a lokális ref-eket a szerverről jött sorból, ha van.
// A `debriefInitialized` flag megakadályozza, hogy a watch újra és újra
// felülírja a user lokális piszkozatát (pl. save közben jött refetch).
watch(
  debrief,
  (d) => {
    if (debriefInitialized.value) return;
    if (!d) return;
    debriefExcess.value = [...(d.excess_items ?? [])];
    debriefMissing.value = [...(d.missing_items ?? [])];
    debriefUncomfortable.value = [...(d.uncomfortable_items ?? [])];
    debriefInitialized.value = true;
  },
  { immediate: true },
);

const addDebriefRow = (
  which: 'excess' | 'missing' | 'uncomfortable',
) => {
  if (which === 'excess') debriefExcess.value = [...debriefExcess.value, ''];
  if (which === 'missing') debriefMissing.value = [...debriefMissing.value, ''];
  if (which === 'uncomfortable')
    debriefUncomfortable.value = [...debriefUncomfortable.value, ''];
};

const removeDebriefRow = (
  which: 'excess' | 'missing' | 'uncomfortable',
  idx: number,
) => {
  if (which === 'excess')
    debriefExcess.value = debriefExcess.value.filter((_, i) => i !== idx);
  if (which === 'missing')
    debriefMissing.value = debriefMissing.value.filter((_, i) => i !== idx);
  if (which === 'uncomfortable')
    debriefUncomfortable.value = debriefUncomfortable.value.filter(
      (_, i) => i !== idx,
    );
};

// Strip empty / whitespace-only lines before sending — the schema accepts
// them but they pollute the DB. Defensive coerce keeps the array dense.
const compactDebrief = (arr: string[]): string[] =>
  arr.map((s) => s.trim()).filter((s) => s.length > 0);

const saveDebriefHandler = async () => {
  debriefSaving.value = true;
  debriefSavedRecently.value = false;
  debriefLocalError.value = null;
  if (debriefSaveTimer) {
    clearTimeout(debriefSaveTimer);
    debriefSaveTimer = null;
  }
  try {
    await saveDebrief(tripId.value, {
      excess_items: compactDebrief(debriefExcess.value),
      missing_items: compactDebrief(debriefMissing.value),
      uncomfortable_items: compactDebrief(debriefUncomfortable.value),
    });
    debriefInitialized.value = true;
    debriefSavedRecently.value = true;
    // Auto-clear a checkmark 2mp múlva (Sprint 4.2 #3 komfort-minta,
    // 1.5s helyett 2s — a debrief ritkább trigger, a usernek több ideje
    // van észrevenni).
    debriefSaveTimer = setTimeout(() => {
      debriefSavedRecently.value = false;
      debriefSaveTimer = null;
    }, 2000);
  } catch (e) {
    // Lokális piros szöveg a section-höz (a page-szintű ErrorBanner
    // helyett, hogy a user ne veszítse el a kontextust, ha közben
    // más section-ön dolgozik). A state.error-ba is bekerül a useTrips
    // saveDebrief-en keresztül, de a section-lokális feedback az elsőd-
    // leges a P0.1 UX-fix szempontjából.
    const msg =
      (e as { data?: { statusMessage?: string }; message?: string })
        ?.data?.statusMessage ||
      (e as { message?: string })?.message ||
      'A debrief mentése sikertelen. Próbáld újra.';
    debriefLocalError.value = msg;
  } finally {
    debriefSaving.value = false;
  }
};

// Sprint 5 P0.3 — "Túra lezárása" gomb handler (spec §4.2 / §7 #8).
// Owner-only, completed_at === null esetén. A useTrips composable
// metódus:
//   1. PATCH-eli a trips.completed_at mezőt,
//   2. capture-li a 'first_completed_trip' activation eventet (first_* guard),
//   3. frissíti state.current-et — a page-szintű reaktivitás
//      (canViewRecap && completed_at gate) automatikusan lecseréli a
//      "Túra lezárása" gombot a debrief section-re.
const markTripCompletedBusy = ref(false);
const markCurrentTripCompleted = async () => {
  const current = state.value.current;
  if (!current || markTripCompletedBusy.value) return;
  markTripCompletedBusy.value = true;
  try {
    await markTripCompleted(current.id);
  } catch {
    // useTrips a state.error-ba helyezi a hibát — a page-szintű
    // ErrorBanner jeleníti meg. Nincs lokális feedback a debrief
    // section-höz hasonlóan: ez egy ritka, egy-gombos akció.
  } finally {
    markTripCompletedBusy.value = false;
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
// The outer gate `canViewRecap` (reachability) renders the recap
// section; the inner `isOwnerViewer` gate restricts the full edit
// UI (textarea, slider, toggle, save/delete, photo upload, drag-
// reorder, caption edit, photo delete) to the trip owner. Non-owner
// viewers (accepted invitee / accepted friend) see a read-only
// preview (body szöveg + rating badge + photo grid, no edit
// controls) inside the same section.
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
    // P3.2 — fan out all invite statuses + participants so the new
    // Résztvevők + Meghívó banner + Meghívók panel sections render
    // without a second round-trip on first interaction. Errors are
    // swallowed (each sub-section has its own empty state); only the
    // trip detail fetch failure navigates back.
    listInvites(tripId.value, 'pending').catch(() => undefined),
    listInvites(tripId.value, 'accepted').catch(() => undefined),
    listInvites(tripId.value, 'declined').catch(() => undefined),
    listParticipants(tripId.value).catch(() => undefined),
    // Sprint 5 P2 — "Ki mit visz" aggregált nézet, owner-only. A
    // 403/404 hibák a fetchGearAssignments belsejében lenyelődnek.
    loadGearAssignments().catch(() => undefined),
    // P3.2 — moved from TripCommentThread.onMounted so the comment
    // thread doesn't double-fetch when both the page and component
    // mount.
    listTripComments(tripId.value).catch(() => undefined),
    // P3 Recap — load recap + photos so the preview shows immediately.
    // The endpoint returns `{recap: null, photos: []}` if no row exists
    // yet, which we tolerate silently.
    getRecap(tripId.value).catch(() => undefined),
    // P5 Debrief — same pattern; `loadDebrief` returns null when no row
    // exists yet, which we tolerate silently.
    loadDebrief(tripId.value).catch(() => undefined),
    // P7 / v2 #22 — Trip-aware loadout. Read-only, NEM ír a
    // gear_items táblába; a 4 empty state a `meta.readiness`-ből
    // jön. Promise.all-ban fut, a hiba nem állítja meg a többit.
    loadLoadoutRecs(tripId.value).catch(() => undefined),
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
        class="rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="A túra terve"
      >
        <header class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            A túra terve
          </h3>
          <span class="text-xs text-umber-500 tabular-nums">
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
          class="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2 text-sm text-espresso-900"
          :aria-label="summaryLine"
        >
          <div
            v-for="stat in summaryStats"
            :key="stat.label"
            class="flex items-baseline gap-1.5"
          >
            <dt class="text-xs font-medium uppercase tracking-wide text-umber-500">
              {{ stat.label }}:
            </dt>
            <dd class="tabular-nums font-semibold">
              {{ stat.value }}<span
                v-if="stat.unit"
                class="ml-0.5 text-xs font-normal text-umber-500"
              >{{ stat.unit }}</span>
            </dd>
          </div>
        </dl>

        <p
          v-if="state.current.gpx_metadata?.max_elevation_m != null"
          class="mt-2 text-xs text-umber-500"
        >
          Max magasság:
          <span class="tabular-nums text-espresso-700">{{
            state.current.gpx_metadata.max_elevation_m
          }}</span>
          m
        </p>
        <p
          v-if="state.current.gpx_metadata?.source"
          class="mt-1 break-all text-xs text-umber-500"
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
            class="block h-[100px] w-[200px] rounded border border-blushMid-300 bg-white shadow-inner"
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
            class="text-xs text-umber-500"
          >
            Track előnézet betöltése…
          </p>
        </div>

        <!-- Allow re-upload: keep a small "Új .gpx" button. -->
        <div class="mt-4 flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center rounded-card border border-blushMid-300 bg-white px-3 py-1.5 text-xs font-medium text-espresso-700 transition-colors hover:bg-blushLight-100 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
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
          class="mt-3 flex items-start gap-2 rounded border border-blushMid-300 bg-blushLight-50 px-3 py-2 text-xs text-espresso-700"
        >
          <span aria-hidden="true" class="mt-px text-blushMid-500">▲</span>
          <span>{{ gpxLocalError }}</span>
        </p>
      </section>

      <section
        v-else
        class="rounded-card border border-dashed border-blushMid-300 bg-blushLight-50 p-4"
        aria-label="GPX terv feltöltése"
      >
        <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
          Töltsd fel a túra tervét
        </h3>
        <p class="mt-1 text-xs text-umber-500">
          A GPX fájlból kiszámoljuk a távot és a szintemelkedést, és
          megmutatjuk a nyomvonal előnézetét.
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <label
            class="flex items-center gap-2 text-xs font-medium text-espresso-700"
          >
            Céldátum (opcionális)
            <input
              v-model="gpxTargetDate"
              type="date"
              class="rounded border border-blushMid-200 bg-white px-2 py-1 text-xs text-espresso-900 tabular-nums focus:border-moss-600 focus:outline-none focus:ring-1 focus:ring-moss-600"
            />
          </label>

          <!--
            Primary CTA: mohás zöld (moss-700), nem indigo.
            A fokusz-gyűrű is moss-600, hogy a kártyán belüli
            fókusz-állapot konzisztens legyen.
          -->
          <button
            type="button"
            class="inline-flex items-center rounded-card bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
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
          class="mt-3 flex items-start gap-2 rounded border border-blushMid-300 bg-blushLight-50 px-3 py-2 text-xs text-espresso-700"
        >
          <span aria-hidden="true" class="mt-px text-blushMid-500">▲</span>
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
        P3.3 round-2: külső gate `canViewRecap` (reachability — owner +
        accepted invitee + accepted friend) MARAD. A belső
        owner-only vezérlők (textarea, rating slider, public toggle,
        Mentés/Törlés, Fotó hozzáadása, drag-reorder, caption edit,
        photo delete) `isOwnerViewer` alá kerülnek vissza, hogy ne
        jelenjenek meg accepted invitee / friend of owner számára.
        Non-owner a `canViewRecap` gate-en belül read-only preview-t
        kap (body szöveg + rating badge + photo grid, upload /
        reorder / delete gombok nélkül).
      -->

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
          :participants="participants"
          :is-owner-viewer="isTripOwner"
          :submitting="pickerSubmitting"
          @save="handlePickerSave"
          @assign="handlePickerAssign"
        />
      </div>

      <!-- Sprint 5 P2 — Ki mit visz (csoportos csomaglista-egyeztetés).
           Owner-only (§11.2 A default). A `gearAssignments` computed
           a useTrips.gearAssignmentsByTripId cache-ből olvas; a §11.3
           A user-döntés szerinti userenkénti csoportosítás: minden
           participant egy blokk (email + összsúly + item lista). A
           user_id = null bucket ("Nincs hozzárendelve") a lista
           végén jelenik meg. -->
      <section
        v-if="isTripOwner"
        class="rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Ki mit visz"
      >
        <header class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            Ki mit visz
          </h3>
          <span class="text-xs text-umber-500">
            {{
              gearAssignments
                ? gearAssignments.participants.length + ' résztvevő'
                : 'Betöltés…'
            }}
          </span>
        </header>
        <p class="mt-1 text-xs text-umber-500">
          A felszerelés elemeket user-szinten csoportosítva mutatjuk,
          hogy lásd, ki mit visz a túrára. A hozzárendelést a
          fenti listán szerkesztheted.
        </p>

        <p
          v-if="gearAssignments && gearAssignments.participants.length === 0"
          class="mt-3 text-xs text-umber-500"
        >
          Még nincs hozzárendelt item. Jelölj ki elemeket a fenti
          listában, és válaszd ki, ki viszi őket.
        </p>
        <ul
          v-else-if="gearAssignments"
          class="mt-3 space-y-3"
        >
          <li
            v-for="(p, idx) in gearAssignments.participants"
            :key="(p.user_id ?? 'unassigned') + '-' + idx"
            class="rounded border border-blushMid-200 bg-white p-3"
          >
            <header class="flex items-baseline justify-between">
              <span class="text-sm font-semibold text-espresso-900">
                <template v-if="p.user_id">
                  {{
                    p.email ??
                    (p.user_id.slice(0, 8) + '…')
                  }}
                </template>
                <template v-else>
                  Nincs hozzárendelve
                </template>
              </span>
              <span class="text-xs tabular-nums text-umber-500">
                {{ p.total_weight_g }} g · {{ p.items.length }} db
              </span>
            </header>
            <ul
              v-if="p.items.length > 0"
              class="mt-2 space-y-1 text-xs text-espresso-700"
            >
              <li
                v-for="item in p.items"
                :key="item.trip_gear_id"
                class="flex items-baseline justify-between gap-2"
              >
                <span class="truncate">
                  {{ item.name }}
                  <template v-if="item.category">
                    · {{ item.category }}
                  </template>
                </span>
                <span class="shrink-0 tabular-nums text-umber-500">
                  {{ item.weight_g }} g × {{ item.qty }}
                  ({{ item.total_weight_g }} g)
                </span>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <!-- P3.2 — Trip-share invite social surface -->
      <!-- Sorrend (Architect B.2): Résztvevők (minden bejelentkezett user) →
           Meghívó banner (invitee-only) → Barátok meghívása (owner-only,
           korábbi P2 szekció, token polish) → Meghívók panel (owner-only,
           pending/accepted/declined buckets). -->

      <!-- Résztvevők szekció — minden bejelentkezett user látja, a
           trip owner + accepted invitee sorokkal. Read-only ha a
           néző nem owner (nincs invite/remove gomb). -->
      <section
        v-if="user && state.current"
        class="rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Résztvevők"
      >
        <header class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            Résztvevők
          </h3>
          <span class="text-xs text-umber-500">
            {{ participants.length }} fő
          </span>
        </header>
        <p
          v-if="participants.length === 0"
          class="mt-2 text-xs text-umber-500"
        >
          Még nincs elfogadott résztvevő ezen a túrán.
        </p>
        <ul
          v-else
          class="mt-3 divide-y divide-blushMid-200 rounded border border-blushMid-200 bg-white"
        >
          <li
            v-for="p in participants"
            :key="p.id"
            class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-espresso-700"
          >
            <span class="truncate font-medium">
              {{ p.email ?? (p.user_id ? p.user_id.slice(0, 8) + '…' : 'ismeretlen') }}
            </span>
            <span
              v-if="p.role === 'owner'"
              class="shrink-0 rounded border border-moss-300 bg-moss-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-900"
            >
              tulajdonos
            </span>
            <span
              v-else
              class="shrink-0 rounded border border-blushLight-300 bg-blushLight-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-espresso-900"
            >
              elfogadva
            </span>
          </li>
        </ul>
      </section>

      <!-- Meghívó banner — csak akkor jelenik meg, ha a bejelentkezett
           usernek van pending invite-ja erre a túrára. Accept/Decline
           gombok a meglévő acceptInvite / declineInvite composable
           metódusokra. -->
      <section
        v-if="myPendingInvite"
        class="rounded-card border border-moss-300 bg-moss-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Meghívó"
      >
        <header>
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            Meghívó érkezett
          </h3>
          <p class="mt-1 text-xs text-umber-500">
            <template v-if="inviterEmailForMyInvite">
              {{ inviterEmailForMyInvite }} meghívott erre a túrára.
            </template>
            <template v-else>
              A túra tulajdonosa meghívott erre a túrára.
            </template>
          </p>
        </header>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn-primary px-3 py-1.5 text-sm"
            :disabled="acceptingInvite || decliningInvite"
            @click="handleAcceptMyInvite"
          >
            <AppSpinner
              v-if="acceptingInvite"
              class="mr-2"
              size="sm"
              color="bark"
              label="Elfogadás folyamatban"
            />
            {{ acceptingInvite ? 'Elfogadás…' : 'Elfogadom' }}
          </button>
          <button
            type="button"
            class="btn-secondary px-3 py-1.5 text-sm"
            :disabled="acceptingInvite || decliningInvite"
            @click="handleDeclineMyInvite"
          >
            <AppSpinner
              v-if="decliningInvite"
              class="mr-2"
              size="sm"
              color="bark"
              label="Elutasítás folyamatban"
            />
            {{ decliningInvite ? 'Elutasítás…' : 'Elutasítom' }}
          </button>
        </div>
      </section>

      <!-- Barátok meghívása — owner-only, meglévő P2 szekció, token
           polish: .input + .btn-primary + .btn-secondary utility
           stringek helyett. A pending invite-ok listája átkerült a
           Meghívók panel alá. -->
      <section
        v-if="isTripOwner"
        class="rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Barátok meghívása"
      >
        <header class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            Barátok meghívása
          </h3>
          <span class="text-xs text-umber-500">
            {{ invites.length }} aktív
          </span>
        </header>
        <p class="mt-1 text-xs text-umber-500">
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
            class="input min-w-0 flex-1 !mt-0"
          />
          <button
            type="submit"
            class="btn-primary"
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
      </section>

      <!-- Meghívók panel — owner-only, három <details> bucket-tel a
           pending / accepted / declined invite-oknak. Pending soron
           Függőben badge + Remove gomb; accepted/declined sorokon a
           megfelelő badge + Remove gomb. -->
      <section
        v-if="isTripOwner"
        class="rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        aria-label="Meghívók"
      >
        <header class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            Meghívók
          </h3>
          <span class="text-xs text-umber-500">
            {{ invites.length }} összesen
          </span>
        </header>

        <details
          class="mt-3 rounded border border-blushMid-200 bg-white"
          :open="pendingInvites.length > 0"
        >
          <summary
            class="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold text-espresso-900"
          >
            <span>Függőben</span>
            <span class="rounded border border-blushMid-300 bg-blushMid-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blushMid-900">
              {{ pendingInvites.length }}
            </span>
          </summary>
          <ul
            v-if="pendingInvites.length > 0"
            class="divide-y divide-blushMid-200 border-t border-blushMid-200"
          >
            <li
              v-for="inv in pendingInvites"
              :key="inv.id"
              class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-espresso-700"
            >
              <span class="truncate font-medium">{{ inv.invitee_email }}</span>
              <span
                class="shrink-0 rounded border border-blushMid-300 bg-blushMid-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blushMid-900"
              >
                {{ inviteStatusLabel(inv.status) }}
              </span>
              <button
                type="button"
                class="btn-secondary shrink-0 px-2 py-1 text-xs"
                @click="handleRemoveInvite(inv.id)"
              >
                Mégse
              </button>
            </li>
          </ul>
          <p
            v-else
            class="border-t border-blushMid-200 px-3 py-2 text-xs italic text-umber-500"
          >
            Nincs függő meghívó.
          </p>
        </details>

        <details
          class="mt-2 rounded border border-blushMid-200 bg-white"
        >
          <summary
            class="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold text-espresso-900"
          >
            <span>Elfogadva</span>
            <span class="rounded border border-moss-300 bg-moss-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-900">
              {{ acceptedInvites.length }}
            </span>
          </summary>
          <ul
            v-if="acceptedInvites.length > 0"
            class="divide-y divide-blushMid-200 border-t border-blushMid-200"
          >
            <li
              v-for="inv in acceptedInvites"
              :key="inv.id"
              class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-espresso-700"
            >
              <span class="truncate font-medium">{{ inv.invitee_email }}</span>
              <span
                class="shrink-0 rounded border border-moss-300 bg-moss-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-900"
              >
                {{ inviteStatusLabel(inv.status) }}
              </span>
              <button
                type="button"
                class="btn-secondary shrink-0 px-2 py-1 text-xs"
                @click="handleRemoveInviteAndRefresh(inv.id)"
              >
                Eltávolítás
              </button>
            </li>
          </ul>
          <p
            v-else
            class="border-t border-blushMid-200 px-3 py-2 text-xs italic text-umber-500"
          >
            Még senki nem fogadta el.
          </p>
        </details>

        <details
          class="mt-2 rounded border border-blushMid-200 bg-white"
        >
          <summary
            class="flex cursor-pointer items-center justify-between px-3 py-2 text-xs font-semibold text-espresso-900"
          >
            <span>Elutasítva</span>
            <span class="rounded border border-blushLight-300 bg-blushLight-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-espresso-900">
              {{ declinedInvites.length }}
            </span>
          </summary>
          <ul
            v-if="declinedInvites.length > 0"
            class="divide-y divide-blushMid-200 border-t border-blushMid-200"
          >
            <li
              v-for="inv in declinedInvites"
              :key="inv.id"
              class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-espresso-700"
            >
              <span class="truncate font-medium">{{ inv.invitee_email }}</span>
              <span
                class="shrink-0 rounded border border-blushLight-300 bg-blushLight-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-espresso-900"
              >
                {{ inviteStatusLabel(inv.status) }}
              </span>
              <button
                type="button"
                class="btn-secondary shrink-0 px-2 py-1 text-xs"
                @click="handleRemoveInvite(inv.id)"
              >
                Eltávolítás
              </button>
            </li>
          </ul>
          <p
            v-else
            class="border-t border-blushMid-200 px-3 py-2 text-xs italic text-umber-500"
          >
            Senki nem utasította el.
          </p>
        </details>
      </section>

      <TripCommentThread
        v-if="user && state.current"
        :trip-id="tripId"
        :current-user-id="user.id"
        :trip-owner-id="state.current.user_id"
      />
      <section
        v-if="canViewRecap"
        class="recap-section rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        data-testid="recap-section"
        aria-label="Túra-élménybeszámoló"
      >
        <header class="flex items-baseline justify-between gap-2">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            {{ isOwnerViewer ? 'Túra-élménybeszámoló' : 'Beszámoló' }}
          </h3>
          <span
            v-if="isOwnerViewer && recap?.public"
            class="rounded border border-moss-300 bg-moss-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-moss-900"
          >
            Publikus
          </span>
          <span
            v-else-if="!isOwnerViewer && recap && recap.rating_out_of_10 !== null && recap.rating_out_of_10 !== undefined"
            class="rounded border border-blushMid-300 bg-blushMid-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blushMid-900 tabular-nums"
          >
            Élmény: {{ recap.rating_out_of_10 }} / 10
          </span>
        </header>
        <p
          v-if="isOwnerViewer"
          class="mt-1 text-xs italic text-umber-500"
        >
          Komfort is számít, nem csak a könnyű súly.
        </p>

        <!--
          Owner-only szerkeszthető űrlap (body + rating slider + public
          toggle + Mentés/Törlés + teljes fotó grid upload / drag-reorder /
          caption edit / photo delete kontrollokkal).
        -->
        <template v-if="isOwnerViewer">
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
            <label class="flex flex-1 min-w-[180px] items-center gap-3 text-xs text-espresso-700">
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
              <span class="w-12 text-right tabular-nums font-semibold text-espresso-900">
                {{ recapRating ?? '–' }} / 10
              </span>
            </label>
            <label class="flex items-center gap-2 text-xs text-espresso-700">
              <input
                v-model="recapPublic"
                type="checkbox"
                class="h-4 w-4 rounded border-blushMid-300 text-moss-700 focus:ring-moss-600"
              />
              <span>Publikus (barátok is olvashatják)</span>
            </label>
          </div>

          <div class="mt-4 flex items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center rounded-card bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
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

          <!-- Fotók grid — owner: szerkeszthető (upload + reorder + caption + delete) -->
          <div class="mt-5">
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="inline-flex items-center rounded-card bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
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
              <span class="text-xs text-umber-500">
                Max 5 MB, JPEG / PNG / WebP
              </span>
            </div>

            <p
              v-if="photoLocalError"
              role="alert"
              class="mt-2 flex items-start gap-2 rounded border border-blushMid-300 bg-blushLight-50 px-3 py-2 text-xs text-espresso-700"
            >
              <span aria-hidden="true" class="mt-px text-blushMid-500">▲</span>
              <span>{{ photoLocalError }}</span>
            </p>

            <p
              v-if="photos.length === 0"
              class="mt-3 text-xs italic text-umber-500"
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
                class="overflow-hidden rounded border border-blushMid-200 bg-white transition-all duration-200 hover:ring-1 hover:ring-moss-500 hover:scale-[1.01] hover:cursor-grab"
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
                <div class="relative h-48 w-full bg-blushMid-100">
                  <img
                    v-if="photo.public_url"
                    :src="photo.public_url"
                    :alt="photo.caption ?? 'Túra fotó'"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="flex h-full w-full items-center justify-center text-2xl font-bold text-blushMid-700"
                  >
                    {{ (photo.id || '').slice(-2).toUpperCase() || 'M' }}
                  </div>
                  <span
                    class="absolute left-2 top-2 rounded bg-blushLight-900/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blushLight-50"
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
                  <div class="flex items-center justify-between text-[10px] text-umber-500">
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
                      class="text-xs font-medium text-blushMid-700 underline"
                      @click="handleDeletePhoto(photo.id)"
                    >
                      Törlés
                    </button>
                  </div>
                </div>
              </li>
            </ul>
            <p class="mt-2 text-[11px] text-umber-500">
              Húzd el a kártyákat az átrendezéshez.
            </p>
          </div>
        </template>

        <!--
          Non-owner read-only preview a canViewRecap gate-en belül:
          csak body szöveg + rating badge + photo grid (captionnel, de
          upload / reorder / caption-edit / photo-delete gombok NÉLKÜL).
        -->
        <template v-else>
          <p
            v-if="recap?.body"
            class="mt-3 whitespace-pre-wrap text-sm text-espresso-900"
          >
            {{ recap.body }}
          </p>
          <p
            v-else
            class="mt-3 text-xs italic text-umber-500"
          >
            A beszámoló még nem készült el.
          </p>

          <ul
            v-if="photos.length > 0"
            class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <li
              v-for="photo in photos"
              :key="photo.id"
              class="overflow-hidden rounded border border-blushMid-200 bg-white"
            >
              <div class="h-48 w-full bg-blushMid-100">
                <img
                  v-if="photo.public_url"
                  :src="photo.public_url"
                  :alt="photo.caption ?? 'Túra fotó'"
                  class="h-full w-full object-cover"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-2xl font-bold text-blushMid-700"
                >
                  {{ (photo.id || '').slice(-2).toUpperCase() || 'M' }}
                </div>
              </div>
              <p
                v-if="photo.caption"
                class="px-2 py-1 text-xs text-espresso-700"
              >
                {{ photo.caption }}
              </p>
              <p
                v-else
                class="px-2 py-1 text-xs italic text-umber-500"
              >
                Monogram fotó
              </p>
            </li>
          </ul>
        </template>
      </section>

      <!--
        Sprint 5 P0.3 — "Túra lezárása" gomb (spec §4.2 / §7 #8).
        A loop logikája: Trip → Loadout → Hike → Debrief. A Hike fázist
        a user a gombra kattintva zárja le; a completed_at kitöltése
        UTÁN jelenik meg a debrief section (lásd lentebb a gate-et).
        Gate: isOwnerViewer + !state.value.current.completed_at.
        A composable metódus (useTrips.markTripCompleted) a PATCH-en felül
        capture-li a 'first_completed_trip' activation eventet is.
      -->
      <div
        v-if="isOwnerViewer && !state.current?.completed_at"
        class="mt-4 flex items-center justify-end"
      >
        <button
          type="button"
          class="btn-secondary px-3 py-2 text-sm"
          data-testid="mark-trip-completed"
          :disabled="markTripCompletedBusy"
          @click="markCurrentTripCompleted"
        >
          <AppSpinner
            v-if="markTripCompletedBusy"
            class="mr-2 h-4 w-4"
            aria-hidden="true"
          />
          <!-- HeroIcons outline/check-circle — 16×16, 2px stroke, jelenlegi szín -->
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="mr-2 inline-block h-4 w-4"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          {{ markTripCompletedBusy ? 'Lezárás…' : 'Túra lezárása' }}
        </button>
      </div>

      <!--
        #23 Debrief — Sprint 5 P0.1: a loop záró rituáléja, a 3 kérdés
        (felesleges / hiányzó / kényelmetlen) item-szintű szerkesztéssel.
        P0.1 változások az eredeti Phase 5-ös section-höz képest:
          (a) a section vizuálisan kiemelt (4px-es bal oldali brand-500
              sáv + sötétebb keret, a "kontraszt-blokk" a lapon) — a
              MemoFox design rendszer §2.3 sötét espresso-kártyák
              mintájára.
          (b) a gate `canViewRecap` (a recap section-t követően, a
              loadout-recs ELŐTT) — a szerkesztő UI (`isOwnerViewer`)
              továbbra is owner-only marad.
          (c) "Zárd le a túrát — 3 kérdés, 1 perc" alcím + kis ikon
              (MemoFox `icon-accent text-ember-500`), hogy a vizuális
              hierarchiában ez legyen a fókusz.
          (d) 1-soros `<input type="text" maxlength="120">` mezők (a
              textarea → input csere a Phase 5 §4.5 döntést a P0.1
              felülírja, mert a Phase 7 #22 loadout-recs item-szinten
              aggregálja az `excess_items`-t).
          (e) inline save feedback (Sprint 4.2 #3 komfort-minta):
              `data-testid="debrief-saved"` "✓ Mentve" 2mp-ig, és
              `data-testid="debrief-error"` lokális piros szöveg hiba
              esetén.
        A rekordok külön ref-ekben (`debriefExcess/Missing/Uncomfortable`),
        így a v-model közvetlenül a ref-re köt, és a watch a szerver-
        oldali betöltéskor hidratálja a lokális piszkozatot.
      -->
      <section
        v-if="canViewRecap && state.current?.completed_at"
        class="debrief-section relative mt-4 overflow-hidden rounded-card border border-espresso-900/30 bg-blushMid-50 p-4 pl-5 shadow-[0_1px_0_rgba(90,69,40,0.04),0_2px_0_rgba(90,69,40,0.06)]"
        data-testid="debrief-section"
        aria-label="Debrief"
      >
        <!--
          P0.1 (a) — 4px-es bal oldali brand-500 sáv, abszolút pozicionálva
          a section teljes magasságában (a "kiemelt card" vizuális mintája).
        -->
        <span
          aria-hidden="true"
          class="absolute inset-y-0 left-0 w-1 bg-brand-500"
        ></span>

        <!--
          P0.1 (c) — loop-lezáró "Zárd le a túrát" sor + kis ikon. A
          vizuális hierarchiában ez legyen a fókusz, hogy a user
          megtalálja a debriefet a History felé vezető loop utolsó
          lépéseként.
        -->
        <div class="mb-2 flex items-center gap-2">
          <span
            aria-hidden="true"
            class="icon-accent h-5 w-5 flex-shrink-0 text-ember-500"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </span>
          <p class="text-xs font-semibold text-espresso-900">
            Zárd le a túrát — 3 kérdés, 1 perc
          </p>
        </div>

        <header class="mb-3">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            Debrief
          </h3>
          <p class="mt-1 text-xs italic text-umber-500">
            Milyen tapasztalataid voltak a túráról? (Opcionális)
          </p>
        </header>

        <!--
          P0.1 (e) — lokális hibaüzenet a section-höz (a page-szintű
          ErrorBanner helyett, hogy a user ne veszítse el a kontextust,
          ha közben más section-ön dolgozik).
        -->
        <p
          v-if="debriefLocalError"
          data-testid="debrief-error"
          role="alert"
          class="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {{ debriefLocalError }}
        </p>

        <div v-if="isOwnerViewer" class="debrief-fields">
          <div class="debrief-field mb-4">
            <label class="mb-2 block text-xs font-bold text-espresso-900">
              Mi volt felesleges?
            </label>
            <div
              v-for="(_, idx) in debriefExcess"
              :key="`excess-${idx}`"
              class="debrief-row mb-2 flex items-center gap-2"
            >
              <input
                v-model="debriefExcess[idx]"
                type="text"
                maxlength="120"
                class="input flex-1"
                placeholder="pl. extra kulacs, sosem használt bicska"
                :aria-label="`Felesleges elem ${idx + 1}`"
              />
              <button
                type="button"
                class="btn-secondary px-2 py-1 text-xs"
                :aria-label="`Felesleges elem ${idx + 1} törlése`"
                @click="removeDebriefRow('excess', idx)"
              >
                Törlés
              </button>
            </div>
            <button
              type="button"
              class="btn-secondary px-2 py-1 text-xs"
              aria-label="Új felesleges elem hozzáadása"
              @click="addDebriefRow('excess')"
            >
              + Adj hozzá újabb sort
            </button>
          </div>

          <div class="debrief-field mb-4">
            <label class="mb-2 block text-xs font-bold text-espresso-900">
              Mi hiányzott?
            </label>
            <div
              v-for="(_, idx) in debriefMissing"
              :key="`missing-${idx}`"
              class="debrief-row mb-2 flex items-center gap-2"
            >
              <input
                v-model="debriefMissing[idx]"
                type="text"
                maxlength="120"
                class="input flex-1"
                placeholder="pl. jobb fejlámpa, plusz réteg"
                :aria-label="`Hiányzó elem ${idx + 1}`"
              />
              <button
                type="button"
                class="btn-secondary px-2 py-1 text-xs"
                :aria-label="`Hiányzó elem ${idx + 1} törlése`"
                @click="removeDebriefRow('missing', idx)"
              >
                Törlés
              </button>
            </div>
            <button
              type="button"
              class="btn-secondary px-2 py-1 text-xs"
              aria-label="Új hiányzó elem hozzáadása"
              @click="addDebriefRow('missing')"
            >
              + Adj hozzá újabb sort
            </button>
          </div>

          <div class="debrief-field mb-4">
            <label class="mb-2 block text-xs font-bold text-espresso-900">
              Mi volt kényelmetlen?
            </label>
            <div
              v-for="(_, idx) in debriefUncomfortable"
              :key="`uncomfortable-${idx}`"
              class="debrief-row mb-2 flex items-center gap-2"
            >
              <input
                v-model="debriefUncomfortable[idx]"
                type="text"
                maxlength="120"
                class="input flex-1"
                placeholder="pl. matrac túl kemény, hálózsák túl szűk"
                :aria-label="`Kényelmetlen elem ${idx + 1}`"
              />
              <button
                type="button"
                class="btn-secondary px-2 py-1 text-xs"
                :aria-label="`Kényelmetlen elem ${idx + 1} törlése`"
                @click="removeDebriefRow('uncomfortable', idx)"
              >
                Törlés
              </button>
            </div>
            <button
              type="button"
              class="btn-secondary px-2 py-1 text-xs"
              aria-label="Új kényelmetlen elem hozzáadása"
              @click="addDebriefRow('uncomfortable')"
            >
              + Adj hozzá újabb sort
            </button>
          </div>

          <div class="mt-3 flex items-center gap-2">
            <button
              type="button"
              class="inline-flex items-center rounded-card bg-moss-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-moss-800 focus:outline-none focus:ring-2 focus:ring-moss-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-moss-300"
              data-testid="debrief-save"
              :disabled="debriefSaving"
              @click="saveDebriefHandler"
            >
              <AppSpinner
                v-if="debriefSaving"
                class="mr-2"
                size="sm"
                color="bark"
                label="Mentés folyamatban"
              />
              {{ debriefSaving ? 'Mentés...' : 'Debrief mentése' }}
            </button>
            <!--
              P0.1 (e) — "✓ Mentve" inline checkmark a save gomb mellett.
              `role="status"` + `aria-live="polite"` hogy a screen reader
              kimondja a sikeres mentést anélkül, hogy a fókuszt elviné.
              Sprint 4.2 #3 komfort-minta.
            -->
            <span
              v-if="debriefSavedRecently"
              data-testid="debrief-saved"
              role="status"
              aria-live="polite"
              class="inline-flex items-center text-xs font-semibold text-green-600"
            >
              <span aria-hidden="true" class="mr-1">✓</span>
              Mentve
            </span>
          </div>
        </div>
        <!--
          Non-owner olvasó: a recap section read-only preview mintájára
          a debrief section is megjelenik a `canViewRecap` gate-en
          belül, DE a szerkesztő UI (isOwnerViewer) nincs. Jelenleg
          a debrief kizárólag owner-only adat (a `trip_debriefs` RLS
          is owner-only), tehát non-owner számára üres a section —
          a későbbi Sprint 5 P1+ kiterjesztheti a "baráti beszámoló"
          mintára, ha a user jelzi.
        -->
        <p
          v-else
          class="debrief-readonly text-xs italic text-umber-500"
        >
          A debrief csak a túra tulajdonosa számára szerkeszthető.
        </p>
      </section>

      <!--
        #22 Trip-aware loadout — owner-only read-only szekció a
        Debrief UTÁN (a Debrief az adatforrás a Phase 5-ből, a
        loadout az adatfelhasználó). A rule-based ajánlás a user
        VALÓDI gear-listájából + a user VALÓDI comfort-értékeléséből
        + a user VALÓDI excess_items előfordulásaiból jön (NEM ML,
        NEM feltételezett starter pack, v2 §0 #1, #3, #5 szigorúan).

        Top-N=6 (3 add + 3 keep) a 2-col gridben (§8 #2 döntés).
        4-féle empty state a `meta.readiness`-ből (§2.6, §8 #1).
        A scoring formula:
          (comfort_score - 1) / 4 × 0.6 + (1 - excess_rate) × 0.4
        Csak az `excess_items`-t büntetjük (§8 #4); a reason mező
        inline (NEM modal, v2 §0 #3 tiltja a tooltip-eket is).
      -->
      <section
        v-if="isOwnerViewer"
        class="loadout-recs-section mt-4 rounded-card border border-blushMid-200 bg-blushLight-50 p-4 shadow-[0_1px_0_rgba(90,69,40,0.04)]"
        data-testid="loadout-recs-section"
        aria-label="Trip-aware loadout"
      >
        <header class="mb-3">
          <h3 class="text-sm font-semibold tracking-tight text-espresso-900">
            Trip-aware loadout
          </h3>
          <p class="mt-1 text-xs italic text-umber-500">
            {{ loadoutRecsSubtitle }}
          </p>
        </header>

        <!-- Empty / readiness-állapotok (§2.6) -->
        <div
          v-if="loadoutRecsReady !== 'enough_data'"
          class="loadout-recs-empty rounded-card border border-blushMid-200 bg-white/60 p-3 text-xs text-umber-700"
          data-testid="loadout-recs-empty"
        >
          <p class="mb-2 font-medium text-espresso-800">
            {{ loadoutRecsMeta ? '' : 'Az ajánlás még nem elérhető — próbáld újra kicsit később.' }}
          </p>
          <p class="text-umber-700">
            {{ loadoutRecsSubtitle }}
          </p>
        </div>

        <!-- Két oszlop: add + keep -->
        <div
          v-else
          class="loadout-recs-grid grid grid-cols-1 gap-4 md:grid-cols-2"
          data-testid="loadout-recs-grid"
        >
          <div
            class="loadout-recs-add rounded-card border border-blushMid-200 bg-white/60 p-3"
            data-testid="loadout-recs-add"
          >
            <h4 class="text-xs font-bold text-espresso-900">
              Ajánlott hozzáadni
            </h4>
            <ul
              v-if="loadoutRecsAdd.length > 0"
              class="mt-2 space-y-2"
            >
              <li
                v-for="rec in loadoutRecsAdd"
                :key="rec.gear_item_id"
                class="loadout-rec-item flex items-baseline justify-between gap-2 text-xs"
              >
                <span class="font-medium text-espresso-900">
                  {{ rec.name }}
                </span>
                <span class="whitespace-nowrap text-umber-600">
                  ({{ rec.weight_g }} g)
                </span>
                <span class="ml-auto text-[10px] italic text-umber-500">
                  {{ loadoutReasonCopy(rec.reason) }}
                </span>
              </li>
            </ul>
            <p
              v-else
              class="mt-2 text-xs italic text-umber-500"
            >
              Nincs új ajánlás — a meglévő trip-ed már a lehető legjobb.
            </p>
          </div>

          <div
            class="loadout-recs-keep rounded-card border border-blushMid-200 bg-white/60 p-3"
            data-testid="loadout-recs-keep"
          >
            <h4 class="text-xs font-bold text-espresso-900">
              Ezeket érdemes megtartani
            </h4>
            <ul
              v-if="loadoutRecsKeep.length > 0"
              class="mt-2 space-y-2"
            >
              <li
                v-for="rec in loadoutRecsKeep"
                :key="rec.gear_item_id"
                class="loadout-rec-item flex items-baseline justify-between gap-2 text-xs"
              >
                <span class="font-medium text-espresso-900">
                  {{ rec.name }}
                </span>
                <span class="whitespace-nowrap text-umber-600">
                  ({{ rec.weight_g }} g)
                </span>
                <span class="ml-auto text-[10px] italic text-umber-500">
                  {{ loadoutReasonCopy(rec.reason) }}
                </span>
              </li>
            </ul>
            <p
              v-else
              class="mt-2 text-xs italic text-umber-500"
            >
              Nincs megerősített item — a trip-ed összes elemét jelöld meg a
              komfort-értékelésben.
            </p>
          </div>
        </div>

        <p
          v-if="loadoutRecsReady === 'enough_data' && loadoutRecsMeta"
          class="mt-3 text-[10px] text-umber-500"
        >
          {{ loadoutRecsMeta.scored_items_count }} item került pontozásra ·
          {{ loadoutRecsMeta.user_trip_count }} túra ·
          {{ loadoutRecsMeta.user_debrief_count }} debrief ·
          {{ loadoutRecsMeta.user_comfort_items_count }} komfort-értékelt item.
          Scoring: (komfort − 1)/4 × 0.6 + (1 − felesleg-ráta) × 0.4.
        </p>
      </section>
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