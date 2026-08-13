<script setup lang="ts">
/**
 * TripCommentThread — flat comment thread for a single trip.
 *
 * Mirrors components/GearCommentThread.vue, but backed by
 * useTrips().listTripComments / addTripComment / updateTripComment /
 * removeTripComment.
 *
 * Permissions:
 *   - `currentUserId` is the signed-in user's uuid (for "Te" badge + author edit/delete).
 *   - `tripOwnerId` lets the trip owner moderate (delete) any comment on
 *     the trip, even ones they did not author. The RLS DELETE policy
 *     mirrors this (author OR trip_owner).
 *
 * The component renders whatever is in
 * state.commentsByTripId[tripId] and just dispatches mutations into
 * useTrips().
 */
import type { TripCommentRowWithPending, UUID } from '~/types/db';

const props = defineProps<{
  tripId: UUID;
  currentUserId: UUID;
  tripOwnerId: UUID;
}>();

const {
  state,
  listTripComments,
  addTripComment,
  updateTripComment,
  removeTripComment,
  resolveEmailsForTrip,
  tripCommentAuthorEmail,
} = useTrips();

const comments = computed(
  () => state.value.commentsByTripId[props.tripId] ?? [],
);

// Local form state.
const draft = ref('');
const submitting = ref(false);
const editingId = ref<UUID | null>(null);
const editingBody = ref('');

const trimmedDraftLength = computed(() => draft.value.trim().length);
const canSubmit = computed(
  () => trimmedDraftLength.value > 0 && trimmedDraftLength.value <= 2000,
);

onMounted(async () => {
  await listTripComments(props.tripId);
});

const submit = async () => {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    await addTripComment(props.tripId, draft.value.trim());
    draft.value = '';
    await resolveEmailsForTrip(props.tripId);
  } catch {
    // surfaced via state.error
  } finally {
    submitting.value = false;
  }
};

const startEdit = (c: TripCommentRowWithPending) => {
  editingId.value = c.id;
  editingBody.value = c.body;
};

const cancelEdit = () => {
  editingId.value = null;
  editingBody.value = '';
};

const saveEdit = async (c: TripCommentRowWithPending) => {
  const body = editingBody.value.trim();
  if (!body) return;
  try {
    await updateTripComment(props.tripId, c.id, body);
    cancelEdit();
  } catch {
    // surfaced via state.error
  }
};

const confirmDelete = async (c: TripCommentRowWithPending) => {
  if (!confirm('Törlöd ezt a hozzászólást? Ezt nem lehet visszavonni.')) return;
  try {
    await removeTripComment(props.tripId, c.id);
  } catch {
    // surfaced via state.error
  }
};

const canEdit = (c: TripCommentRowWithPending) =>
  c.user_id === props.currentUserId;

const canDelete = (c: TripCommentRowWithPending) =>
  c.user_id === props.currentUserId ||
  props.tripOwnerId === props.currentUserId;

const authorLabel = (c: TripCommentRowWithPending): string => {
  if (c.user_id === props.currentUserId) return 'Te';
  const email = tripCommentAuthorEmail(c.user_id);
  return email ?? c.user_id.slice(0, 8);
};

const avatarLabel = (c: TripCommentRowWithPending): string => {
  if (c.user_id === props.currentUserId) return 'Te';
  const email = tripCommentAuthorEmail(c.user_id);
  if (email) return email.charAt(0).toUpperCase();
  return c.user_id.charAt(0).toUpperCase();
};

const relativeTime = (iso: string): string => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.floor((Date.now() - t) / 1000);
  if (diff < 60) return 'épp most';
  if (diff < 3600) return `${Math.floor(diff / 60)} perce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} órája`;
  return `${Math.floor(diff / 86400)} napja`;
};

const edited = (c: TripCommentRowWithPending): boolean =>
  c.created_at !== c.updated_at;
</script>

<template>
  <section class="rounded border border-clay-200 bg-sand-50 p-4">
    <header class="mb-3 flex items-baseline justify-between">
      <h3 class="text-sm font-semibold text-bark-900">Túra-hozzászólások</h3>
      <span class="text-xs text-loam-500">
        {{ comments.length }} db
      </span>
    </header>

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="() => (state.error = null)"
    />

    <form class="mb-4" @submit.prevent="submit">
      <label class="sr-only" :for="`trip-comment-body-${tripId}`">
        Új hozzászólás
      </label>
      <textarea
        :id="`trip-comment-body-${tripId}`"
        v-model="draft"
        :maxlength="2000"
        rows="3"
        class="block w-full rounded border border-clay-200 px-3 py-2 text-sm focus:border-moss-700 focus:outline-none focus:ring-1 focus:ring-moss-600"
        placeholder="Írj egy hozzászólást a túrához…"
      />
      <div class="mt-1 flex items-center justify-between text-xs text-loam-500">
        <span>{{ trimmedDraftLength }} / 2000</span>
        <button
          type="submit"
          class="btn-primary bg-moss-700 px-3 py-1.5 text-sand-50 hover:bg-moss-600"
          :disabled="!canSubmit || submitting"
        >
          {{ submitting ? 'Küldés…' : 'Küldés' }}
        </button>
      </div>
    </form>

    <p
      v-if="state.loading && comments.length === 0"
      class="text-sm text-loam-500"
    >
      Betöltés…
    </p>

    <p v-else-if="comments.length === 0" class="text-sm text-gray-500">
      Még nincs hozzászólás — légy te az első!
    </p>

    <ul v-else class="space-y-3">
      <li
        v-for="c in comments"
        :key="c.id"
        class="flex gap-3"
        :class="{ 'opacity-60': c.pending }"
      >
        <div
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700"
          aria-hidden="true"
        >
          {{ avatarLabel(c) }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2 text-xs text-gray-500">
            <span class="font-medium text-gray-900">{{ authorLabel(c) }}</span>
            <span>{{ relativeTime(c.created_at) }}</span>
            <span v-if="edited(c)">(szerkesztve)</span>
          </div>

          <div v-if="editingId === c.id">
            <textarea
              v-model="editingBody"
              :maxlength="2000"
              rows="3"
              class="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div class="mt-1 flex justify-end gap-2">
              <button
                type="button"
                class="btn-secondary px-2 py-1 text-xs"
                @click="cancelEdit"
              >
                Mégse
              </button>
              <button
                type="button"
                class="btn-primary"
                @click="saveEdit(c)"
              >
                Mentés
              </button>
            </div>
          </div>

          <p
            v-else
            class="mt-1 whitespace-pre-wrap break-words text-sm text-gray-800"
          >
            {{ c.body }}
          </p>

          <div
            v-if="editingId !== c.id"
            class="mt-1 flex gap-2"
          >
            <button
              v-if="canEdit(c)"
              type="button"
              class="btn-secondary px-2 py-1 text-xs"
              @click="startEdit(c)"
            >
              Szerkesztés
            </button>
            <button
              v-if="canDelete(c)"
              type="button"
              class="btn-danger px-2 py-1 text-xs"
              @click="confirmDelete(c)"
            >
              Törlés
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
