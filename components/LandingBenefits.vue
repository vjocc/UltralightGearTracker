<script setup lang="ts">
/**
 * Landing benefits section — P4.2 redesign.
 *
 * 3-col grid (mobile: stack, sm: 3-col). MemoFox §7.2 light feature card.
 * Section background: blushLight (MemoFox §2.2 — cream section bg).
 * Container: max-w-7xl, py-24 md:py-32.
 * Typography: H2 display ExtraBold (blush section header), H3 Bold cards.
 *
 * A 3 előny:
 *   1. Komfort és súly egyensúlyban
 *   2. Tervezés GPX-szel, a barátokkal
 *   3. Túra-élménybeszámoló
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
  <section class="bg-blushLight-50" aria-label="Előnyök">
    <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32 lg:px-8">
      <!-- Section header -->
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-3xl font-extrabold text-espresso-900 sm:text-4xl lg:text-[40px]">
          Három dolog, amitől a túrád könnyebb lesz
        </h2>
        <p class="mt-4 text-base font-normal leading-relaxed text-espresso-900/70 sm:text-lg">
          Nem a legkevesebb gramm számít — hanem hogy jól érezd magad a hegyen.
        </p>
      </div>

      <!-- 3-col grid of light feature cards -->
      <div class="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-3 sm:gap-8">
        <article
          v-for="b in benefits"
          :key="b.title"
          class="card-light"
        >
          <div class="text-3xl" aria-hidden="true">{{ b.emoji }}</div>
          <h3 class="mt-4 font-display text-xl font-extrabold text-espresso-900 sm:text-2xl">
            {{ b.title }}
          </h3>
          <p class="mt-3 text-sm font-normal leading-relaxed text-espresso-900/80 sm:text-base">
            {{ b.body }}
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
