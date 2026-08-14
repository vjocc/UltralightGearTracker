<script setup lang="ts">
/**
 * Landing page — P4.2 redesign (MemoFox §11).
 *
 * Vertikális scroll struktúra, 5 section + zig-zag, váltakozó háttér:
 *   1. Hero (LandingHero) — composite képes, parallax
 *   2. LandingZigZag      — blushMid, 50/50 image+text, 2 sor
 *   3. LandingBenefits    — blushLight, 3-col card-light
 *   4. LandingCta         — fogGrey, 4-step process card-dark + auth-aware CTA
 *   5. LandingFooter      — blushMid-visszhang, privacy micro-copy
 *
 * A landing mindig publikus (middleware/auth.global.ts kezeli).
 * A CTAs auth-aware (useSupabaseUser reaktív a komponensekben).
 */
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <LandingHero />
    <LandingZigZag />
    <LandingBenefits />
    <LandingCta />
    <LandingFooter />
  </div>
</template>
