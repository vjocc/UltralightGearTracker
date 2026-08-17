<script setup lang="ts">
/**
 * Profile page — Profil / Beállítások oldal.
 *
 * Sprint 5 P2.x bugfix: a user bármikor megadhatja/módosíthatja a
 * display_name-jét. A 'Névtelen túrázó' placeholder-t a user a
 * regisztrációkor kapja (signup trigger), és a Profil oldalon
 * cserélheti le a valós nevére.
 *
 * A /api/profile PATCH endpoint zod validációt végez
 * (displayNameSchema: 1-50 char trim), és a profile tábla
 * CHECK constraint-je a migrációs szinten véd.
 */
useHead({
  title: 'Profil',
});

const router = useRouter();
const user = useSupabaseUser();
const profileComposable = useProfile();
const { state, load, update, isPlaceholderProfile } = profileComposable;

const displayName = ref('');
const avatarUrl = ref<string | null>(null);
const bio = ref<string | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const saveSuccess = ref(false);

// Load profile on mount
onMounted(async () => {
  if (!user.value) return;
  try {
    const profile = await load();
    displayName.value = profile.display_name;
    avatarUrl.value = profile.avatar_url;
    bio.value = profile.bio;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('profile load failed', e);
  }
});

// Validation
const trimmedDisplayName = computed(() => displayName.value.trim());
const displayNameValid = computed(
  () => trimmedDisplayName.value.length >= 1 && trimmedDisplayName.value.length <= 50,
);
const canSave = computed(() => displayNameValid.value && !saving.value);

const handleSave = async () => {
  if (!canSave.value) return;
  saveError.value = null;
  saveSuccess.value = false;
  saving.value = true;
  try {
    await update({
      display_name: trimmedDisplayName.value,
      avatar_url: avatarUrl.value?.trim() || null,
      bio: bio.value?.trim() || null,
    });
    saveSuccess.value = true;
  } catch (e) {
    const err = e as { statusMessage?: string; message?: string };
    saveError.value = err?.statusMessage ?? err?.message ?? 'Mentés sikertelen';
  } finally {
    saving.value = false;
  }
};

const handleSignOut = async () => {
  await signOutUser();
  await router.replace('/signin');
};

// A useSignOut() composable (composables/useSupabaseUser.ts)-ban definiált.
// A `useSignOut()` közvetlenül visszaadja a signOut függvényt, NEM object-et
// (ld. composables/useSupabaseUser.ts useSignOut definition).
import { useSignOut } from '~/composables/useSupabaseUser';
const signOutUser = useSignOut();
</script>

<template>
  <section v-if="user" class="mx-auto max-w-lg">
    <header class="mb-6 flex items-baseline justify-between">
      <h2 class="text-xl font-semibold text-gray-900">Profil</h2>
      <button
        type="button"
        class="text-xs text-gray-500 hover:text-gray-700"
        @click="handleSignOut"
      >
        Kijelentkezés
      </button>
    </header>

    <p
      v-if="isPlaceholderProfile"
      class="mb-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
    >
      <strong>Üdvözöl a túrában!</strong> Adj meg egy keresztnevet, hogy a
      trip-résztvevők és a „Ki mit visz" nézet a valós neveddel
      hivatkozzon rád, ne a „Névtelen túrázó" placeholder-rel.
    </p>

    <ErrorBanner
      v-if="saveError"
      :message="saveError"
      dismissible
      @dismiss="saveError = null"
    />

    <p
      v-if="saveSuccess"
      class="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
      data-testid="profile-save-success"
    >
      Profil elmentve.
    </p>

    <form class="space-y-4" @submit.prevent="handleSave">
      <div>
        <label for="profile-displayname" class="block text-sm font-medium text-gray-700">
          Keresztnév <span class="text-xs font-normal text-red-500">*</span>
        </label>
        <input
          id="profile-displayname"
          v-model="displayName"
          type="text"
          autocomplete="given-name"
          maxlength="50"
          required
          class="input"
          placeholder="pl. Anna"
          :aria-invalid="!displayNameValid && displayName.length > 0"
        />
        <p
          v-if="!displayNameValid && displayName.length > 0"
          class="mt-1 text-xs text-amber-700"
        >
          A keresztnév 1-50 karakter lehet (jelenleg: {{ trimmedDisplayName.length }}).
        </p>
        <p
          v-else
          class="mt-1 text-xs text-gray-500"
        >
          Megjelenik a trip-résztvevők listáján és a „Ki mit visz" nézetben.
        </p>
      </div>

      <div>
        <label for="profile-avatar" class="block text-sm font-medium text-gray-700">
          Avatar URL <span class="text-xs font-normal text-gray-500">(opcionális)</span>
        </label>
        <input
          id="profile-avatar"
          v-model="avatarUrl"
          type="url"
          autocomplete="url"
          class="input"
          placeholder="https://..."
        />
        <p class="mt-1 text-xs text-gray-500">
          Publikus URL, a profilképed mutatja.
        </p>
      </div>

      <div>
        <label for="profile-bio" class="block text-sm font-medium text-gray-700">
          Bio <span class="text-xs font-normal text-gray-500">(opcionális, max 500 karakter)</span>
        </label>
        <textarea
          id="profile-bio"
          v-model="bio"
          maxlength="500"
          rows="3"
          class="input"
          placeholder="Pár szó magadról..."
        />
      </div>

      <button
        type="submit"
        :disabled="!canSave"
        class="btn-primary w-full"
        data-testid="profile-save"
      >
        {{ saving ? 'Mentés…' : 'Mentés' }}
      </button>
    </form>

    <p class="mt-6 text-xs text-gray-500">
      Email: {{ user.email }} (nem módosítható)
    </p>
  </section>
</template>
