<script setup lang="ts">
/**
 * GearCommentThread — flat comment thread for a single gear item.
 *
 * Renders:
 *   - empty state ("Még nincs comment — légy te az első!"),
 *   - loading state,
 *   - list of comments (avatar monogram, author email or "Te",
 *     relative timestamp, body, edit/delete actions),
 *   - new-comment textarea + Post button.
 *
 * Permissions:
 *   - `currentUserId` is the signed-in user's uuid (for "Te" badge + author edit/delete).
 *   - `gearOwnerId` lets the gear owner moderate (delete) any comment on the
 *     item, even ones they did not author. The RLS DELETE policy mirrors this.
 *
 * Optimistic insert is handled by useGearComments().add() — the component
 * just renders whatever is in `state.byGearId[gearItemId]`.
 */
import type { GearCommentRowWithPending, UUID } from '~/types/db';

const props = defineProps<{
  gearItemId: UUID;
  currentUserId: UUID;
  gearOwnerId: UUID;
}>();

const {
  state,
  list,
  add,
  update,
  remove,
  resolveEmailsForGear,
  commentAuthorEmail,
} = useGearComments();

const comments = computed(() => state.value.byGearId[props.gearItemId] ?? []);

// Local form state.
const draft = ref('');
const submitting = ref(false);
const editingId = ref<UUID | null>(null);
const editingBody = ref('');

const trimmedDraftLength = computed(() => draft.value.trim().length);
const canSubmit = computed(() => trimmedDraftLength.value > 0 && trimmedDraftLength.value <= 2000);

onMounted(async () => {
  await list(props.gearItemId);
});

const submit = async () => {
  if (!canSubmit.value || submitting.value) return;
  submitting.value = true;
  try {
    await add(props.gearItemId, draft.value.trim());
    draft.value = '';
    await resolveEmailsForGear(props.gearItemId);
  } catch {
    // surfaced via state.error
  } finally {
    submitting.value = false;
  }
};

const startEdit = (c: GearCommentRowWithPending) => {
  editingId.value = c.id;
  editingBody.value = c.body;
};

const cancelEdit = () => {
  editingId.value = null;
  editingBody.value = '';
};

const saveEdit = async (c: GearCommentRowWithPending) => {
  const body = editingBody.value.trim();
  if (!body) return;
  try {
    await update(props.gearItemId, c.id, body);
    cancelEdit();
  } catch {
    // surfaced via state.error
  }
};

const confirmDelete = async (c: GearCommentRowWithPending) => {
  if (!confirm('Delete this comment? This cannot be undone.')) return;
  try {
    await remove(props.gearItemId, c.id);
  } catch {
    // surfaced via state.error
  }
};

const canEdit = (c: GearCommentRowWithPending) =>
  c.user_id === props.currentUserId;

const canDelete = (c: GearCommentRowWithPending) =>
  c.user_id === props.currentUserId || props.gearOwnerId === props.currentUserId;

const authorLabel = (c: GearCommentRowWithPending): string => {
  if (c.user_id === props.currentUserId) return 'Te';
  const email = commentAuthorEmail(c.user_id);
  return email ?? c.user_id.slice(0, 8);
};

const avatarLabel = (c: GearCommentRowWithPending): string => {
  if (c.user_id === props.currentUserId) return 'Te';
  const email = commentAuthorEmail(c.user_id);
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

const edited = (c: GearCommentRowWithPending): boolean =>
  c.created_at !== c.updated_at;
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-4">
    <header class="mb-3 flex items-baseline justify-between">
      <h3 class="text-sm font-semibold text-gray-900">Comments</h3>
      <span class="text-xs text-gray-500">
        {{ comments.length }} db
      </span>
    </header>

    <ErrorBanner
      :message="state.error"
      dismissible
      @dismiss="() => state.error = null"
    />

    <form
      class="mb-4"
      @submit.prevent="submit"
    >
      <label class="sr-only" :for="`comment-body-${gearItemId}`">
        Új comment
      </label>
      <textarea
        :id="`comment-body-${gearItemId}`"
        v-model="draft"
        :maxlength="2000"
        rows="3"
        class="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        placeholder="Írj egy commentet…"
      />
      <div class="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>{{ trimmedDraftLength }} / 2000</span>
        <button
          type="submit"
          class="btn-primary"
          :disabled="!canSubmit || submitting"
        >
          {{ submitting ? 'Posting…' : 'Post' }}
        </button>
      </div>
    </form>

    <p
      v-if="state.loading && comments.length === 0"
      class="text-sm text-gray-500"
    >
      Loading…
    </p>

    <p
      v-else-if="comments.length === 0"
      class="text-sm text-gray-500"
    >
      Még nincs comment — légy te az első!
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
                Save
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
              Edit
            </button>
            <button
              v-if="canDelete(c)"
              type="button"
              class="btn-danger px-2 py-1 text-xs"
              @click="confirmDelete(c)"
            >
              Delete
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>