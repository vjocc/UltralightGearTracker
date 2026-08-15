<script setup lang="ts">
/**
 * Sprint 4 — Phase 2 onboarding panel.
 *
 * Inline (NOT modal) panel that sits between the page header and
 * BaseWeightSummary on /gear. Drives the user through 3 phases:
 *   A. Felkínálkozás (0 items) — full panel, fast inline form.
 *   B. Haladás (1..KÜSZÖB-1) — full panel + progress dots + "X / 3 cucc felvíve".
 *   C. Záródás (≥ KÜSZÖB) — slim completion bar with "Még egy cucc" CTA.
 *
 * Uses the existing useGear().create() pipeline — no parallel write path.
 * Source of truth: docs/sprint-4-phase-2-onboarding.md (Phase 2 architect spec).
 *
 * Constraints honoured:
 *  - No new migration / API endpoint / utility class.
 *  - Inline form, not modal (0. elv #2: minimise onboarding friction).
 *  - "Ennyi volt" forces B → C locally without resetting the underlying
 *    items list (the system trusts the user knows the flow at that point).
 *  - Price + excluded_from_base intentionally omitted from the inline form
 *    (they are advanced fields, available in GearFormModal).
 */
import { computed, reactive, ref, useTemplateRef } from 'vue';
import { gearCreateSchema } from '~/shared/gearSchemas';
import { ONBOARDING_KÜSZÖB } from '~/composables/useOnboardingPhase';
// useOnboardingPhase is auto-imported by Nuxt from composables/.

const { state, create } = useGear();
const { state: catState } = useCategories();

// Sprint 5 P0.2 — F3: az A./B./C. fázislogika véglegesítése. A
// Phase 2 commit + Sprint 4.2 #4 fix után a panel belső state-je
// (forcedComplete, effectivePhase) lokálisan éli, a page-szintű
// showOnboarding computed (pages/gear/index.vue) csak az item-számot
// látja. Ez a kettősség okozza a "panel újra megjelenik re-render
// után" bugot. A megoldás: a panel exportálja a forcedComplete flag-et
// (defineExpose), a page-szintű showOnboarding a useTemplateRef-en
// keresztül olvassa. A panel mount/unmount ciklusaival a flag a
// panel életciklusához kötött (ha a panel eltűnik C.-ben, a page
// showOnboarding false lesz; ha a panel újra mountol A./B.-ben —
// pl. item-törlés miatt — a flag tiszta lappal indul). A
// defineExpose hívás a forcedComplete deklaráció UTÁN történik
// (lentebb a scriptben) — a TDZ elkerülése végett.

const itemCount = computed(() => state.value.items.length);
const { phase } = useOnboardingPhase(itemCount);

// Local switch: when the user clicks "Ennyi volt" in B. phase, we force
// the panel into C. phase locally. This is a one-way ratchet: once
// acknowledged, the panel stays in C. until the user logs out / item
// count drops in another session. The page-level showOnboarding is
// driven by the underlying count, not this flag, so the system is
// still consistent if the user later deletes items back below the
// threshold (the panel resets through the normal phase logic).
const forcedComplete = ref(false);

// Effective phase (override when user acknowledges "Ennyi volt").
const effectivePhase = computed(() => {
  if (forcedComplete.value) return 'C' as const;
  return phase.value;
});

const submitting = ref(false);
const form = reactive({
  name: '',
  category_id: '',
  weight_g: '' as number | '',
});

// Inline form only handles the 3 fields that ship in the rest of the
// gear-create flow; price + excluded_from_base are advanced fields.
const buildPayload = () => ({
  name: form.name.trim(),
  category_id: form.category_id,
  weight_g: form.weight_g === '' ? NaN : Number(form.weight_g),
  price: null,
  excluded_from_base: false,
});

const validation = computed(() => gearCreateSchema.safeParse(buildPayload()));
const canSubmit = computed(() => validation.value.success);

// Reset the form back to the post-submit state (the panel stays mounted,
// ready for the next item).
const resetForm = () => {
  form.name = '';
  form.category_id = '';
  form.weight_g = '';
  forcedComplete.value = false; // NEW: phase reset A./B. — Sprint 4.2 #4
};

const nameInputRef = useTemplateRef<HTMLInputElement>('nameInput');

const handlePrimary = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    await create(buildPayload());
    // Stay on the panel — user is in the flow. Reset the form and
    // keep focus on the name input for the next item.
    resetForm();
    await nextTick();
    nameInputRef.value?.focus();
  } catch {
    // useGear().create() already surfaced the error into state.error;
    // the page-level ErrorBanner owns the display.
  } finally {
    submitting.value = false;
  }
};

const handleMégEgyCucc = () => {
  // Reset the form and refocus the name input. Stays in B. phase.
  resetForm();
  nextTick(() => nameInputRef.value?.focus());
};

const handleEnnyiVolt = () => {
  // "Ennyi volt" — user explicitly closes the onboarding flow even
  // though the item count is still below the threshold. Locally
  // collapse the panel into the slim completion bar. We do NOT touch
  // state.items — the user's data is what it is.
  forcedComplete.value = true;
};

const progressCount = computed(() =>
  Math.min(itemCount.value, ONBOARDING_KÜSZÖB)
);

// Sprint 5 P0.2 — F3 (lásd fentebb): a forcedComplete flag-et a panel
// életciklusán belül, a deklaráció UTÁN exportáljuk a page-szintű
// showOnboarding computed számára.
defineExpose({ forcedComplete });
</script>

<template>
  <section
    class="mb-4 rounded-card bg-blushLight-50 p-6 text-espresso-900 shadow-sm"
    aria-labelledby="onboarding-heading"
  >
    <!-- ============ A. / B. phase: full panel ============ -->
    <template v-if="effectivePhase !== 'C'">
      <div class="flex items-start gap-3">
        <!-- HeroIcons outline/backpack — 40×40, 2px stroke, ember-500 -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="icon-accent mt-0.5 h-10 w-10 flex-shrink-0 text-ember-500"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 6.75a3 3 0 1 1 6 0v1.5h.75a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25H8.25A2.25 2.25 0 0 1 6 19.5v-9a2.25 2.25 0 0 1 2.25-2.25H9v-1.5Zm0 1.5h6v-1.5a3 3 0 0 0-6 0v1.5Zm3 4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
          />
        </svg>

        <div class="min-w-0 flex-1">
          <h3
            id="onboarding-heading"
            class="font-display text-2xl font-bold text-espresso-900"
          >
            Mi van a felszerelésedben?
          </h3>
          <p class="mt-1 font-body text-base text-espresso-900/80">
            Ha már túráztál, vedd sorra, mi volt nálad — ha még nem, kezdj a
            legfontosabbal.
          </p>
          <!-- Sprint 5 P0.2 F2 — spec §3.5 b) 3. segéd-sora: -->
          <p class="text-xs italic text-umber-500 mt-1">
            Kezdd a legfontosabbal — a többit később is felviheted.
          </p>

          <!-- Inline form: 3 fields + plus button on a single row -->
          <form
            class="mt-4 flex flex-wrap items-stretch gap-2"
            @submit.prevent="handlePrimary"
          >
            <input
              ref="nameInput"
              v-model="form.name"
              type="text"
              maxlength="80"
              placeholder="Pl. Decathlon Forclaz MT100"
              class="input min-w-0 flex-1"
              :disabled="submitting"
              aria-label="Felszerelés neve"
            />
            <select
              v-model="form.category_id"
              class="input w-40"
              :disabled="submitting"
              aria-label="Kategória"
            >
              <option value="" disabled>Válassz kategóriát</option>
              <option
                v-for="c in catState.items"
                :key="c.id"
                :value="c.id"
              >
                {{ c.name }}
              </option>
            </select>
            <input
              v-model.number="form.weight_g"
              type="number"
              min="0"
              max="50000"
              step="1"
              placeholder="820"
              class="input w-28"
              :disabled="submitting"
              aria-label="Súly grammban"
            />
            <button
              type="submit"
              class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ember-500 text-2xl font-bold leading-none text-white transition-colors duration-200 hover:bg-ember-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canSubmit || submitting"
              :aria-label="submitting ? 'Mentés folyamatban' : 'Hozzáadás'"
            >
              <span aria-hidden="true">+</span>
            </button>
          </form>

          <!-- B. phase: progress dots + counter + post-save buttons -->
          <div
            v-if="effectivePhase === 'B'"
            class="mt-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5" aria-hidden="true">
                <span
                  v-for="n in ONBOARDING_KÜSZÖB"
                  :key="n"
                  class="h-1.5 w-8 rounded-full transition-colors duration-200"
                  :class="
                    n <= progressCount
                      ? 'bg-moss-500'
                      : 'bg-espresso-900/15'
                  "
                />
              </div>
              <span class="font-body text-sm text-espresso-900/70">
                {{ progressCount }} / {{ ONBOARDING_KÜSZÖB }} cucc felvíve
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="btn-primary text-sm"
                style="padding: 8px 20px"
                @click="handleMégEgyCucc"
              >
                Még egy cucc
              </button>
              <button
                type="button"
                class="btn-secondary text-sm"
                style="padding: 8px 20px"
                @click="handleEnnyiVolt"
              >
                Ennyi volt
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ C. phase: slim completion bar ============ -->
    <template v-else>
      <div
        class="flex items-center justify-between gap-3 rounded-pill bg-iceBlue-50 px-5 py-3"
      >
        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="icon-accent h-5 w-5 flex-shrink-0 text-ember-500"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
          <span class="font-body text-sm text-espresso-900">
            Szép, van miről tervezned. Ide bármikor visszajöhetsz.
          </span>
        </div>
        <button
          type="button"
          class="btn-secondary text-xs"
          style="padding: 6px 14px"
          @click="resetForm"
        >
          + Újabb cucc
        </button>
      </div>
    </template>
  </section>
</template>
