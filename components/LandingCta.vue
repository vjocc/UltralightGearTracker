<script setup lang="ts">
/**
 * Landing CTA section — megerősítő mondat + primary CTA.
 *
 * Auth-aware: signed-out → /signup, signed-in → /trips.
 */
const user = useSupabaseUser();

const ctaHref = computed(() => (user.value ? '/trips' : '/signup'));
</script>

<template>
  <section class="bg-bark-50">
    <div class="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div class="mx-auto max-w-2xl text-center">
        <p class="text-xl font-medium leading-relaxed text-bark-900 sm:text-2xl">
          Nem a legkevesebb gramm számít, hanem hogy jól érezd magad a
          hegyen — pakolj a saját ritmusodra.
        </p>

        <div class="mt-8">
          <NuxtLink :to="ctaHref" class="btn-primary px-6 py-3 text-base">
            Összerakom a túracsomagomat
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>