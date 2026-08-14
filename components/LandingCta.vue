<script setup lang="ts">
/**
 * Landing CTA + 4-step process section — P4.2 redesign.
 *
 * Section background: fogGrey (MemoFox §2.2 — neutral grey).
 * The 4-step process uses card-dark (MemoFox §7.1) — 4-col grid,
 * mobile: stack, sm: 2-col, lg: 4-col.
 * Auth-aware close CTA: signed-out → /signup, signed-in → /trips.
 *
 * The 4-step process (MemoFox pivot, P4.2 brief):
 *   1. Gyűjtsd össze a cuccod
 *   2. Tervezd meg a túrát GPX-szel
 *   3. Oszd meg a bandával
 *   4. Éld meg + Beszámoló
 */
interface StepItem {
  num: string;
  title: string;
  body: string;
}

const steps: StepItem[] = [
  {
    num: '01',
    title: 'Gyűjtsd össze a cuccod',
    body: 'Add hozzá a fogkefétől a sátorig mindent, amit viszel. A rendszer súlyt és kategóriát rendel.',
  },
  {
    num: '02',
    title: 'Tervezd meg a túrát GPX-szel',
    body: 'Töltsd fel a kört, és a terv a csomagod mellé kerül. Km, szint, időbecslés — minden egy helyen.',
  },
  {
    num: '03',
    title: 'Oszd meg a bandával',
    body: 'Hívd meg a túratársakat — közösen nézegetik, kommentelik, ajánlanak. Privát, csak meghívottaknak.',
  },
  {
    num: '04',
    title: 'Éld meg + Beszámoló',
    body: 'A túra végén egy helyre gyűlnek a km-ek, a felszerelés-visszajelzés és a barátok élményei.',
  },
];

const user = useSupabaseUser();
const ctaHref = computed(() => (user.value ? '/trips' : '/signup'));
</script>

<template>
  <section class="bg-fogGrey-50" aria-label="Hogyan működik">
    <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32 lg:px-8">
      <!-- Section header -->
      <div class="mx-auto max-w-2xl text-center">
        <h2 class="font-display text-3xl font-extrabold text-espresso-900 sm:text-4xl lg:text-[40px]">
          Négy lépésben a túráig
        </h2>
        <p class="mt-4 text-base font-normal leading-relaxed text-espresso-900/70 sm:text-lg">
          A cuccod és a terved végigkíséri a túrát — az elejétől a beszámolóig.
        </p>
      </div>

      <!-- 4-col grid of dark process cards -->
      <div class="mt-12 grid grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
        <article
          v-for="s in steps"
          :key="s.num"
          class="card-dark"
        >
          <div class="font-display text-2xl font-extrabold text-ember-500">
            {{ s.num }}
          </div>
          <h3 class="mt-3 font-display text-xl font-extrabold text-white sm:text-2xl">
            {{ s.title }}
          </h3>
          <p class="mt-3 text-sm font-normal leading-relaxed text-white/80 sm:text-base">
            {{ s.body }}
          </p>
        </article>
      </div>

      <!-- Close CTA — auth-aware -->
      <div class="mt-12 text-center sm:mt-16">
        <NuxtLink :to="ctaHref" class="btn-primary">
          Összerakom a túracsomagomat
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
