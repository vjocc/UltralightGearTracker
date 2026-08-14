<script setup lang="ts">
/**
 * Landing page — redesign (P3.1).
 *
 * Vertikális scroll struktúra: Hero → Benefits → CTA → Footer.
 * A landing mindig publikus (middleware/auth.global.ts kezeli).
 * A CTAs auth-aware (useSupabaseUser reaktív a komponensekben).
 *
 * A régi Gear-tábla markup eltávolítva — a signed-in user a
 * signIn redirect-en keresztül a /trips-re megy; ha manuálisan
 * `/`-re látogat, a landing marad, a CTAs a /trips-re mutatnak.
 */
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <LandingHero />
    <LandingBenefits />
    <LandingCta />
    <LandingFooter />
  </div>
</template>