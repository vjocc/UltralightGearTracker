<script setup lang="ts">
/**
 * Landing footer — P4.5 redesign.
 *
 * MemoFox §9: 3-layer mountain illustration (espresso / umber / blushMid)
 * a lap alján, full-width. A micro-copy + copyright felette.
 * A privacy-default szöveg a §9 "warm, private" voice-ból jön.
 */
</script>

<template>
  <footer class="bg-blushMid-50" aria-label="Lábléc">
    <!-- Micro-copy + copyright -->
    <div class="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
      <div class="border-t border-espresso-900/10 pt-8">
        <p class="text-xs font-normal leading-relaxed text-espresso-900/70 sm:text-sm">
          Az alapértelmezett: csak te és a meghívott barátok látják a
          csomagod és a túráid — semmi nyilvános feed, semmi reklám.
        </p>
        <p class="mt-3 text-xs font-normal leading-relaxed text-espresso-900/60 sm:text-sm">
          © 2026 Ultralight Gear Tracker — A te hegyed, a te csomagod.
        </p>
      </div>
    </div>

    <!--
      3-layer mountain illustration (MemoFox §9).
      Minden réteg: 100% width, viewBox-alapú koordinátarendszer,
      preserveAspectRatio="none" → a path a container szélességére
      nyúlik, magassága CSS-ből jön. A rétegek egymáson ülnek
      (abszolút pozíció, left:0, right:0, bottom:0), hogy a
      „távoli halvány → közép → közeli sötét" Z-order érvényesüljön.
    -->
    <div
      class="relative mt-12 w-full"
      style="height: 140px;"
      aria-hidden="true"
    >
      <!-- Háttér (leggyengébb szín, legkisebb Y-offset) -->
      <svg
        class="absolute inset-x-0 bottom-0 h-[100px] w-full text-blushMid-400"
        viewBox="0 0 1440 100"
        preserveAspectRatio="none"
        fill="currentColor"
        fill-rule="nonzero"
      >
        <path d="M0 60 C 120 35, 240 80, 360 55 C 480 30, 600 70, 720 50 C 840 30, 960 75, 1080 55 C 1200 35, 1320 70, 1440 50 L 1440 100 L 0 100 Z" />
      </svg>

      <!-- Középső réteg (umber) -->
      <svg
        class="absolute inset-x-0 bottom-0 h-[120px] w-full text-umber-700"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        fill="currentColor"
        fill-rule="nonzero"
      >
        <path d="M0 75 C 120 50, 240 95, 360 70 C 480 45, 600 90, 720 65 C 840 40, 960 95, 1080 70 C 1200 45, 1320 90, 1440 65 L 1440 120 L 0 120 Z" />
      </svg>

      <!-- Előtér (espresso, legsötétebb) -->
      <svg
        class="absolute inset-x-0 bottom-0 h-[140px] w-full text-espresso-900"
        viewBox="0 0 1440 140"
        preserveAspectRatio="none"
        fill="currentColor"
        fill-rule="nonzero"
      >
        <path d="M0 95 C 120 70, 240 115, 360 90 C 480 65, 600 110, 720 85 C 840 60, 960 115, 1080 90 C 1200 65, 1320 110, 1440 85 L 1440 140 L 0 140 Z" />
      </svg>
    </div>
  </footer>
</template>
