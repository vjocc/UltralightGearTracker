<script setup lang="ts">
/**
 * Sign-in page. Password-first flow (PO ticket 6a7d59783da50263dcc6ba98):
 *   - email + password is the PRIMARY path
 *   - magic link CTA removed (Supabase OTP/magic-link delivery is
 *     misconfigured — follow-up card; the form no longer offers an
 *     incomplete path)
 *   - ?next=... query param is honoured on successful auth
 *   - /auth/callback forwards errors here for display
 */
const route = useRoute();
const router = useRouter();
const user = useSupabaseUser();
const supabase = useSupabaseClient();

const nextPath = computed(() => {
  const raw = route.query.next;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate === 'string' && candidate.startsWith('/')) return candidate;
  return '/gear';
});

// If the user is already signed in, bounce to the post-login target.
watchEffect(() => {
  if (user.value) {
    router.replace(nextPath.value);
  }
});

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

const canSubmit = computed(
  () =>
    email.value.trim().length > 0 &&
    password.value.length > 0 &&
    !submitting.value,
);

const signInWithPassword = async () => {
  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Add meg az emailedet és a jelszavad.';
    return;
  }
  errorMessage.value = null;
  submitting.value = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    });
    if (error) {
      errorMessage.value = mapAuthError(error.message);
    } else {
      await router.replace(nextPath.value);
    }
  } catch (e) {
    const err = e as Error;
    errorMessage.value = err?.message ?? 'Sikertelen belépés.';
  } finally {
    submitting.value = false;
  }
};

/**
 * Translate Supabase's raw English error messages to Hungarian.
 * Kept aligned with signup.vue so both forms share copy.
 */
const mapAuthError = (raw: string): string => {
  const lower = raw.toLowerCase();
  if (lower.includes('email') && lower.includes('invalid')) {
    return 'Érvénytelen email cím.';
  }
  if (lower.includes('rate limit') || lower.includes('email rate')) {
    return 'Túl sok próbálkozás — várj egy percet és próbáld újra.';
  }
  if (
    lower.includes('invalid login') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid email or password')
  ) {
    return 'Hibás email vagy jelszó.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Az emailed még nincs megerősítve — nézd meg a postaládádat.';
  }
  return 'Sikertelen belépés — próbáld meg később.';
};

// Pick up an error forwarded by /auth/callback (Supabase confirmation
// or magic-link failure: ?error=...&error_description=...) and surface
// it on the banner. Magic-link failures land here too — copy is
// generic enough to cover both legacy and current paths.
const queryError = computed(() => {
  const raw = route.query.error_description ?? route.query.error;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v ? v : null;
});

watchEffect(() => {
  const qe = queryError.value;
  if (qe && errorMessage.value !== qe) {
    errorMessage.value = mapAuthError(qe);
  }
});
</script>

<template>
  <section class="mx-auto max-w-sm">
    <h2 class="mb-1 text-xl font-semibold text-gray-900">
      Belépés
    </h2>
    <p class="mb-4 text-sm text-gray-500">
      Add meg az emailedet és a jelszavad a belépéshez.
    </p>

    <ErrorBanner
      :message="errorMessage"
      dismissible
      @dismiss="errorMessage = null"
    />

    <form class="space-y-4" @submit.prevent="signInWithPassword">
      <div>
        <label for="signin-email" class="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="signin-email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="input"
          placeholder="te@pelda.hu"
        />
      </div>

      <div>
        <label for="signin-password" class="block text-sm font-medium text-gray-700">
          Jelszó
        </label>
        <div class="relative mt-1">
          <input
            id="signin-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
            class="input pr-16"
          />
          <button
            type="button"
            :aria-label="showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'"
            :aria-pressed="showPassword"
            class="btn-secondary absolute inset-y-0 right-0 px-3 text-xs"
            @click="showPassword = !showPassword"
          >
            {{ showPassword ? 'Elrejt' : 'Mutat' }}
          </button>
        </div>
      </div>

      <button
        type="submit"
        :disabled="!canSubmit"
        class="btn-primary w-full"
      >
        {{ submitting ? 'Belépés…' : 'Belépés' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-600">
      Még nincs fiókod?
      <NuxtLink to="/signup" class="font-medium text-indigo-600 hover:text-indigo-700">
        Regisztrálj
      </NuxtLink>
    </p>
  </section>
</template>
