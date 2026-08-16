<script setup lang="ts">
/**
 * Sign-up page. Password-first flow (PO ticket 6a7d59783da50263dcc6ba98):
 *   1. user enters email + password + confirm password
 *   2. supabase.auth.signUp() creates the row + sends a confirmation email
 *      (emailRedirectTo goes to /auth/callback)
 *   3. success path shows "Confirm your email" copy (HU)
 *
 * Magic link CTA removed entirely — it is not available in this build
 * because Supabase OTP/magic-link delivery is misconfigured in the
 * dashboard (deferred to a follow-up card). The form no longer offers
 * a path that cannot complete.
 */
const route = useRoute();
const router = useRouter();
const user = useSupabaseUser();
const supabase = useSupabaseClient();
// P0.3 — activation funnel: signup_completed capture (Sprint 5
// P0.3, B opció: saját events tábla). A first_* guard a
// composable-ban van (useState flag); a szerver-oldali endpoint
// (/api/events/track) idempotens.
const { trackEvent } = useFunnelEvents();

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
const confirmPassword = ref('');
const showPassword = ref(false);
const submitting = ref(false);
const signedUp = ref(false);
const errorMessage = ref<string | null>(null);

// Client-side password validation — server still re-validates.
const passwordTooShort = computed(() => password.value.length > 0 && password.value.length < 8);
const passwordsMismatch = computed(
  () => confirmPassword.value.length > 0 && password.value !== confirmPassword.value,
);

const canSubmit = computed(
  () =>
    email.value.trim().length > 0 &&
    password.value.length >= 8 &&
    password.value === confirmPassword.value &&
    !submitting.value,
);

const signUp = async () => {
  if (!email.value.trim() || !password.value) {
    errorMessage.value = 'Add meg az emailedet és a jelszót.';
    return;
  }
  if (password.value.length < 8) {
    errorMessage.value = 'A jelszó legalább 8 karakter hosszú legyen.';
    return;
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'A két jelszó nem egyezik.';
    return;
  }
  errorMessage.value = null;
  submitting.value = true;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      errorMessage.value = mapAuthError(error.message);
    } else if (data.session) {
      // autoConfirm is ON → user is signed in immediately
      await router.replace(nextPath.value);
    } else {
      // autoConfirm OFF → confirmation email sent
      signedUp.value = true;
      // Sprint 5 P0.3 — activation funnel: signup_completed (B opció: saját events tábla).
      // A first_* guard a useFunnelEvents belsejében (useState flag + server idempotens check).
      const { trackEvent } = useFunnelEvents();
      trackEvent('signup_completed', { source: 'email' });
    }
  } catch (e) {
    const err = e as Error;
    errorMessage.value = err?.message ?? 'A regisztráció nem sikerült.';
  } finally {
    submitting.value = false;
  }
};

/**
 * Translate Supabase's raw English error messages to Hungarian.
 * Kept aligned with signin.vue so both forms share copy.
 */
const mapAuthError = (raw: string): string => {
  const lower = raw.toLowerCase();
  if (lower.includes('email') && lower.includes('invalid')) {
    return 'Érvénytelen email cím.';
  }
  if (lower.includes('rate limit') || lower.includes('email rate')) {
    return 'Túl sok próbálkozás — várj egy percet és próbáld újra.';
  }
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'Erre az email címre már létezik fiók — lépj be a /signin oldalon.';
  }
  if (lower.includes('password') && (lower.includes('short') || lower.includes('weak'))) {
    return 'A jelszó túl rövid vagy túl gyenge — válassz erősebbet.';
  }
  return 'A regisztráció nem sikerült — próbáld meg később.';
};
</script>

<template>
  <section class="mx-auto max-w-sm">
    <h2 class="mb-1 text-xl font-semibold text-gray-900">
      Regisztráció
    </h2>
    <p class="mb-4 text-sm text-gray-500">
      Hozd létre a fiókodat email + jelszó párossal. A jelszó legyen
      legalább 8 karakter. Az első belépés előtt meg kell erősítened az
      emailedet.
    </p>

    <ErrorBanner
      :message="errorMessage"
      dismissible
      @dismiss="errorMessage = null"
    />

    <p
      v-if="signedUp"
      class="mb-4 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
    >
      Erősítsd meg az emailedet — küldtünk egy megerősítő linket.
      Kattints rá a postaládádban a fiók aktiválásához.
    </p>

    <form
      v-if="!signedUp"
      class="space-y-4"
      @submit.prevent="signUp"
    >
      <div>
        <label for="signup-email" class="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="signup-email"
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="input"
          placeholder="te@pelda.hu"
        />
      </div>

      <div>
        <label for="signup-password" class="block text-sm font-medium text-gray-700">
          Jelszó <span class="text-xs font-normal text-gray-500">(min. 8 karakter)</span>
        </label>
        <div class="relative mt-1">
          <input
            id="signup-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            minlength="8"
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
        <p
          v-if="passwordTooShort"
          class="mt-1 text-xs text-amber-700"
        >
          A jelszó legalább 8 karakter hosszú legyen.
        </p>
      </div>

      <div>
        <label for="signup-password-confirm" class="block text-sm font-medium text-gray-700">
          Jelszó újra
        </label>
        <input
          id="signup-password-confirm"
          v-model="confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          minlength="8"
          required
          class="input"
        />
        <p
          v-if="passwordsMismatch"
          class="mt-1 text-xs text-amber-700"
        >
          A két jelszó nem egyezik.
        </p>
      </div>

      <button
        type="submit"
        :disabled="!canSubmit"
        class="btn-primary w-full"
      >
        {{ submitting ? 'Regisztráció…' : 'Regisztráció' }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-gray-600">
      Már van fiókod?
      <NuxtLink to="/signin" class="font-medium text-indigo-600 hover:text-indigo-700">
        Belépés
      </NuxtLink>
    </p>
  </section>
</template>
