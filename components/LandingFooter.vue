<script setup lang="ts">
/**
 * Landing footer — P4.2 redesign.
 *
 * Section background: blushMid (MemoFox §2.2 — taupe section bg),
 * Mint a P4.2 brief "Út a 5-section ritmushoz" utolsó előtti eleme.
 * A tényleges umber footer illustration a P4.5 scope (kimaradt).
 *
 * Privacy micro-copy + MVP disclaimer marad.
 */
</script>

<template>
  <footer class="bg-blushMid-50" aria-label="Lábléc">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="border-t border-espresso-900/10 pt-8">
        <p class="text-xs font-normal leading-relaxed text-espresso-900/70 sm:text-sm">
          Az alapértelmezett: csak te és a meghívott barátok látják a
          csomagod és a túráid — semmi nyilvános feed, semmi reklám.
        </p>
        <p class="mt-3 text-xs font-normal leading-relaxed text-espresso-900/60 sm:text-sm">
          MVP build · a funkciók iteratívan bővülnek. A pontos mérlegelés
          a saját felelősséged — terepen próbáld ki, mielőtt hosszú túrára
          viszed.
        </p>
      </div>
    </div>
  </footer>
</template>
