<script setup lang="ts">
/**
 * Landing zig-zag block — P4.2 (MemoFox §11.5).
 *
 * 50/50 image+text kombó, két sor: image left + text right (sor 1),
 * text left + image right (sor 2). A 4-step process LandingCta FÖLÉ
 * kerül, a hero+H1 után, a benefits előtt — a MemoFox brief
 * "2 image+text blocks, offset overlap, shadow-md" spec alapján.
 *
 * Section background: blushMid (MemoFox §2.2 — taupe section bg).
 * Container: max-w-7xl, py-24 md:py-32.
 * A placeholder image-ek SVG box-ok (P4.5 fog custom fotókat,
 * a P3.3 custom fotó sprint kimaradt — szóval a hero image-ek
 * mellé egyforma ember/természet képet használunk most).
 */

interface ZigZagItem {
  title: string;
  body: string;
  image: string;
  alt: string;
}

const items: ZigZagItem[] = [
  {
    title: 'Tervezz súlyra, ne gramra',
    body:
      'A túracsomagod összeállítása nem a "mindenből a legkönnyebb" hajsza — ' +
      'hanem a hozzád passzoló felszerelés megtalálása. Az Ultralight Gear ' +
      'Tracker minden darab mellé odateszi a mérleget, hogy tudd, mit ' +
      'cipelsz valójában.',
    image: '/hero/background.png',
    alt: 'Hátizsákos túrázó a sziklás hegyoldalban',
  },
  {
    title: 'A terved és a cuccod egy helyen',
    body:
      'Töltsd fel a túra GPX-ét, és a terv a csomagod mellé kerül. ' +
      'A km, a szint, az időbecslés és a felszereléslista végig együtt ' +
      'utazik — nem kell külön appot nyitni a tervhez és a cuccokhoz.',
    image: '/hero/front.png',
    alt: 'Túrázó csoport a hegygerincen',
  },
];
</script>

<template>
  <section class="bg-blushMid-50" aria-label="Tervezés és csomag">
    <div class="mx-auto max-w-7xl px-4 py-24 sm:px-6 md:py-32 lg:px-8">
      <div class="space-y-16 sm:space-y-20 lg:space-y-24">
        <div
          v-for="(item, idx) in items"
          :key="item.title"
          class="grid grid-cols-1 items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-16"
        >
          <!-- Image side -->
          <div
            class="order-1 overflow-hidden rounded-card shadow-md"
            :class="idx % 2 === 1 ? 'lg:order-2' : ''"
          >
            <img
              :src="item.image"
              :alt="item.alt"
              class="aspect-[4/3] h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            >
          </div>

          <!-- Text side -->
          <div
            class="order-2"
            :class="idx % 2 === 1 ? 'lg:order-1' : ''"
          >
            <h3 class="font-display text-2xl font-extrabold leading-tight text-espresso-900 sm:text-3xl lg:text-[36px]">
              {{ item.title }}
            </h3>
            <p class="mt-4 text-base font-normal leading-relaxed text-espresso-900/75 sm:mt-6 sm:text-lg">
              {{ item.body }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
