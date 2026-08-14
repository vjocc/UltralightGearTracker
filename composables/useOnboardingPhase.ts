/**
 * Sprint 4 — Phase 2 onboarding-flow shared phase logic.
 *
 * Why a composable (not a private const in GearOnboardingPanel.vue):
 *  - pages/gear/index.vue needs to know when to show the panel (showOnboarding).
 *  - The KÜSZÖB lives in one place so a future A/B test (2 vs 5) is a
 *    single-file change without touching the flow logic.
 *
 * Source of truth: docs/sprint-4-phase-2-onboarding.md §6.
 */
import { computed, type ComputedRef } from 'vue';

/**
 * The item-count threshold that closes the onboarding panel.
 *
 * Decision (Designer/PO, Phase 2 §3.2): 3.
 *  - 3 is Miller's-law "magical number" minimum for the "flow" feeling.
 *  - 3 items is enough for the BaseWeightSummary to render a meaningful
 *    number (vs "—" at 0).
 *  - The constant is named ONBOARDING_KÜSZÖB (not PHASE_2_THRESHOLD) so
 *    later phases (Wishlist, Trip-aware loadout) can reuse the same
 *    phase-machine if they want to.
 */
export const ONBOARDING_KÜSZÖB = 3;

export type OnboardingPhase = 'A' | 'B' | 'C';

export function useOnboardingPhase(
  itemCount: ComputedRef<number> | number
) {
  const count = computed(() =>
    typeof itemCount === 'number' ? itemCount : itemCount.value
  );

  const phase = computed<OnboardingPhase>(() => {
    if (count.value === 0) return 'A';
    if (count.value < ONBOARDING_KÜSZÖB) return 'B';
    return 'C';
  });

  /**
   * The panel is "active" while the user is still in the onboarding
   * window (0..KÜSZÖB-1 items). In C. phase the panel is NOT active
   * by this flag — the slim completion bar is rendered as part of the
   * panel itself, not driven by the page.
   */
  const isActive = computed(() => count.value < ONBOARDING_KÜSZÖB);

  return {
    phase,
    isActive,
    küszöb: ONBOARDING_KÜSZÖB,
  };
}
