<script setup lang="ts">
/**
 * Landing hero — P4.1 redesign.
 *
 * Kétrétegű kép-kompozit (background + front) parallax scroll-lassulással
 * a MemoFox design system §11 alapján.
 *
 * Kompozíciós döntés:
 *   A háttérfotó sötét sziklás hegye a BAL, világos ég+gleccser a JOBB
 *   oldalon helyezkedik el. A brief "espresso color" szöveget ír elő,
 *   ami sötét felületen elveszíti a kontrasztot — ezért a H1+subtitle a
 *   JOBB oldali világos égterületre kerül (espresso ott olvasható), a
 *   front cutout kép pedig a JOBB ALSÓ negyedben, a szöveg alatt foglal
 *   helyet (object-bottom). A sötét szikla a bal oldalon természetes
 *   keretet ad a kompozíciónak. Ez a brief "design másképp kívánja"
 *   elágazását követi a kép természetes képkivágása miatt.
 *
 * - Background parallax: transform: translateY(scrollY * 0.3) — MemoFox §11
 * - Front kép fix (nincs parallax)
 * - 60fps throttling: requestAnimationFrame + 16ms tick-kapu
 * - Mobilon (<768px) és prefers-reduced-motion esetén a parallax kikapcsol
 * - Auth-aware CTA: signed-out → /signup + /signin; signed-in → /trips
 *
 * A copy (H1 + subtitle) itt placeholder — a végleges marketing szöveget
 * a P4.5 kártya szállítja (MemoFox design system §11.4).
 */

const user = useSupabaseUser();

const primaryHref = computed(() => (user.value ? '/trips' : '/signup'));
const secondaryHref = computed(() => (user.value ? '/trips' : '/signin'));

// --- Parallax --------------------------------------------------------------
const bgOffset = ref(0);
let rafPending = false;
let lastTick = 0;

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const isMobile = () =>
  typeof window !== 'undefined' && window.innerWidth < 768;

const updateParallax = () => {
  rafPending = false;
  if (reducedMotion || isMobile()) {
    bgOffset.value = 0;
    return;
  }
  // MemoFox §11 — 0.3 lassulási faktor.
  // 50% scroll → a background az eredeti 100% helyett ~85% pozícióban van
  // (vizuálisan lassabban mozog, mint a front és a tartalom).
  bgOffset.value = Math.round(window.scrollY * 0.3);
};

const onScroll = () => {
  const now = performance.now();
  if (rafPending) return;
  if (now - lastTick < 16) return;
  lastTick = now;
  rafPending = true;
  requestAnimationFrame(updateParallax);
};

onMounted(() => {
  updateParallax();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
});
</script>

<template>
  <!--
    Section magasság: 500px mobile / 700px tablet / 800px desktop.
    overflow-hidden, hogy a parallax-elt háttér ne lógjon ki a szélére.
    Espresso fallback szín a kép betöltődéséig.
  -->
  <section
    class="relative overflow-hidden bg-espresso h-[500px] sm:h-[700px] md:h-[800px]"
    aria-label="Hero"
  >
    <!-- Háttérkép: teljes szélesség, parallax translate3d (GPU-gyors). -->
    <div
      class="pointer-events-none absolute inset-0 z-0 will-change-transform"
      :style="{ transform: `translate3d(0, ${bgOffset}px, 0)` }"
    >
      <img
        src="/hero/background.png"
        alt=""
        role="presentation"
        class="h-full w-full object-cover select-none"
        loading="eager"
        decoding="async"
        draggable="false"
      >
    </div>

    <!--
      Front kép: fix, NEM parallax. A jobb oldali világos égre vetítve,
      alulra igazítva (object-bottom). object-contain megtartja az eredeti
      képkivágást — a cutout túrázók a kép alsó középső részén helyezkednek el.
      Desktop: ~60% szélesség (jobbra), tablet: ~50%, mobile: ~80% (középen).
    -->
    <div
      class="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-1/2 items-end justify-end md:flex lg:w-3/5"
    >
      <img
        src="/hero/front.png"
        alt=""
        role="presentation"
        class="h-full w-full object-contain object-bottom-right select-none"
        loading="eager"
        decoding="async"
        draggable="false"
      >
    </div>
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 z-10 mx-auto flex w-4/5 items-end justify-center md:hidden"
      style="height: 75%"
    >
      <img
        src="/hero/front.png"
        alt=""
        role="presentation"
        class="max-h-full w-full object-contain object-bottom select-none"
        loading="eager"
        decoding="async"
        draggable="false"
      >
    </div>

    <!--
      Tartalom overlay: max-w-7xl container, jobbra igazítva (a szöveg
      a világos égterületre esik → espresso olvasható).
      A H1 + subtitle a jobb felső kvadránsban, a CTA-k alatta.
      A front kép a tartalom alatt/alatt jobbra helyezkedik el (z-10 vs z-20).
      Mobilon a tartalom középre kerül és a front kép mögé simul.
    -->
    <div
      class="relative z-20 mx-auto flex h-full max-w-7xl items-center justify-end px-4 sm:px-6 lg:px-8"
    >
      <div
        class="w-full max-w-md text-center md:max-w-lg md:text-right md:[&>*]:text-right"
      >
        <h1
          class="font-display text-4xl font-extrabold leading-tight text-espresso sm:text-5xl lg:text-[56px]"
        >
          Csomagolj tudatosan — nem könnyebben, hanem okosabban.
        </h1>
        <p class="mt-4 text-base font-normal leading-relaxed text-espresso/85 sm:mt-6 sm:text-lg">
          Az Ultralight Gear Tracker segít összerakni a túracsomagodat:
          gyűjtsd össze a cuccod, tervezd meg a túrát GPX-szel, és hívd
          meg a bandát. A te ritmusodra, a te hegyedre.
        </p>

        <!-- CTA pair: MemoFox §6.3 — filled + outline, pirula, display ExtraBold -->
        <div
          class="mt-8 flex flex-col items-stretch justify-end gap-3 sm:mt-10 sm:flex-row sm:items-center md:justify-end"
        >
          <NuxtLink :to="primaryHref" class="btn-primary">
            Összerakom a túracsomagomat
          </NuxtLink>
          <NuxtLink :to="secondaryHref" class="btn-secondary">
            Már van fiókom, belépek
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
