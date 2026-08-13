<script setup lang="ts">
/**
 * Supabase PKCE / magic link callback handler.
 *
 * Flow on arrival:
 *   1. Supabase auth-js reads `?code=...` from the URL
 *   2. It exchanges the code for a session (sets cookies + reactive user)
 *   3. We redirect to ?next=... (defaults to /gear) on success
 *   4. On ?error=... we surface a message and redirect to /signin
 *
 * The @nuxtjs/supabase module's auto-handler already does step 1+2 if
 * `redirectOptions.callback` is set to this path in nuxt.config.ts. This
 * page just provides the user-facing redirect logic and error UX.
 */
const route = useRoute();
const router = useRouter();
const user = useSupabaseUser();

const nextPath = computed(() => {
  const raw = route.query.next;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate === 'string' && candidate.startsWith('/')) return candidate;
  return '/gear';
});

const errorCode = computed(() => {
  const raw = route.query.error;
  return Array.isArray(raw) ? raw[0] : raw;
});

const errorDescription = computed(() => {
  const raw = route.query.error_description;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' ? v : null;
});

// On mount: if we have a session, go to next; if we have an error, go to /signin.
// If neither, show a brief loading state and let the Supabase plugin's
// auth-state-change listener populate useSupabaseUser() before we redirect.
onMounted(async () => {
  if (errorCode.value) {
    // Defer to /signin; the ErrorBanner there will pick up the message via query.
    await router.replace({
      path: '/signin',
      query: { error: errorCode.value, error_description: errorDescription.value ?? '' },
    });
    return;
  }

  // Wait up to 5s for the Supabase plugin to settle the session.
  const start = Date.now();
  while (!user.value && Date.now() - start < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (user.value) {
    await router.replace(nextPath.value);
  } else {
    // No session, no error — something else went wrong (e.g. expired link).
    await router.replace('/signin');
  }
});
</script>

<template>
  <section class="mx-auto max-w-sm text-center">
    <h2 class="mb-2 text-xl font-semibold text-gray-900">
      Bejelentkezés folyamatban…
    </h2>
    <p class="text-sm text-gray-500">
      Egy pillanat, amíg a Supabase érvényesíti a magic linkedet.
    </p>
  </section>
</template>