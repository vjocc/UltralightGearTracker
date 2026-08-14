<script setup lang="ts">
/**
 * Landing benefits section.
 *
 * 3-col grid (mobile: stack → grid-cols-1 sm:grid-cols-3).
 * Benefit card-ok clay-100 háttérrel.
 */
interface BenefitItem {
  emoji: string;
  title: string;
  body: string;
}

const benefits: BenefitItem[] = [
  {
    emoji: '⚖️',
    title: 'Komfort és súly egyensúlyban',
    body: 'Nem a legkönnyebb felszerelést hajszoljuk — a hozzád passzolót. Minden darab mellé ott a mérleg: hány gramm, hány kényelmes éjszaka.',
  },
  {
    emoji: '🗺️',
    title: 'Tervezés GPX-szel, a barátokkal',
    body: 'Töltsd fel a kört GPX-ben, és oszd meg a túra-tervet a bandával. Közös cucc-lista, közös döntés.',
  },
  {
    emoji: '📔',
    title: 'Túra-élménybeszámoló',
    body: 'A túra végén egy helyre gyűlnek a képek, a km-ek, a barátok visszajelzései.',
  },
];
</script>

<template>
  <section class="bg-sand-50">
    <div class="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article
          v-for="b in benefits"
          :key="b.title"
          class="rounded-lg bg-clay-100 p-6 shadow-sm"
        >
          <div class="text-2xl" aria-hidden="true">{{ b.emoji }}</div>
          <h3 class="mt-3 text-lg font-semibold text-bark-900">
            {{ b.title }}
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-bark-700">
            {{ b.body }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>