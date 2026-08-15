/**
 * useLoadoutRecommendations — P7 / v2 #22 — Trip-aware loadout.
 *
 * Mintát a useStats.ts (Phase 6, user-szintű) és useTripWeight.ts
 * (Phase 1, reaktív tripIdRef) ad.
 *
 * Dedikált composable, NEM a useTrips/useStats bővítése — a loadout
 * 4 forrásból aggregál (trip + trip_gear + gear_items.comfort +
 * trip_debriefs.excess_items), és a v2 §0 #5 elv szigorúan tiltja a
 * Trip ≠ My Gear összemosást.
 *
 * useState namespace: 'loadout-recs' (külön a 'trips' és 'trip-stats'
 * névtértől).
 *
 * Reaktív: a `tripIdRef` változásakor a `load()` újrafut — a user
 * route-váltáskor nem kell manual refresh.
 */
import type {
  LoadoutRecommendationsResponse,
  LoadoutReadiness,
} from '~/types/db';

export type LoadoutRecommendationsByTripId = Record<
  string,
  LoadoutRecommendationsResponse | null
>;

interface UseLoadoutRecommendationsState {
  byTripId: LoadoutRecommendationsByTripId;
  loading: boolean;
  error: string | null;
  /** Az épp betöltött tripId, hogy a section render tudja, mikor kell
   * a `state.byTripId` szlotját olvasni. */
  currentTripId: string | null;
}

export type LoadoutReasonKey =
  | 'high_comfort'
  | 'low_excess'
  | 'both'
  | 'new_item'
  | null;

export interface UseLoadoutRecommendationsApi {
  state: Ref<UseLoadoutRecommendationsState>;
  /** Betölti a megadott tripId-re az ajánlás-listát (Promise.all
   * alól hívható, hiba esetén az adott trip slot `null` marad, a
   * state.error kitöltődik). */
  load: (tripId: string) => Promise<LoadoutRecommendationsResponse | null>;
  /** Az adott tripId-hez tartozó cache-elt válasz (vagy null). */
  get: (tripId: string) => LoadoutRecommendationsResponse | null;
  /** A readiness 4 címke magyar nyelvű copyja — a section
   * használja, NEM a szerver (a szerver csak a kódot adja vissza). */
  emptyStateCopy: (readiness: LoadoutReadiness | undefined | null) => string;
  /** A reason magyar copyja. Ha `null`, akkor üres stringet ad. */
  reasonCopy: (reason: LoadoutReasonKey) => string;
  resetError: () => void;
}

export function useLoadoutRecommendations(): UseLoadoutRecommendationsApi {
  const state = useState<UseLoadoutRecommendationsState>(
    'loadout-recs',
    () => ({
      byTripId: {},
      loading: false,
      error: null,
      currentTripId: null,
    }),
  );

  const load = async (
    tripId: string,
  ): Promise<LoadoutRecommendationsResponse | null> => {
    if (!tripId) return null;
    state.value.loading = true;
    state.value.error = null;
    state.value.currentTripId = tripId;
    try {
      const data = await $fetch<LoadoutRecommendationsResponse>(
        `/api/trips/${tripId}/loadout-recommendations`,
      );
      state.value.byTripId[tripId] = data ?? null;
      return data;
    } catch (e) {
      const err = e as { statusMessage?: string; message?: string };
      state.value.error =
        err?.statusMessage ??
        err?.message ??
        'Ajánlások betöltése sikertelen';
      // A korábbi cache-et meghagyjuk, hogy a section a `null` helyett
      // a régi adatot mutassa (a user ne veszítse el az előző load
      // eredményét egy átmeneti hiba miatt).
      return null;
    } finally {
      state.value.loading = false;
    }
  };

  const get = (
    tripId: string,
  ): LoadoutRecommendationsResponse | null => {
    if (!tripId) return null;
    return state.value.byTripId[tripId] ?? null;
  };

  const emptyStateCopy = (
    readiness: LoadoutReadiness | undefined | null,
  ): string => {
    switch (readiness) {
      case 'no_trips':
        return 'Még nincs elég adat — rögzíts egy túrát a Debrief kitöltéséhez, hogy személyes ajánlást kapj.';
      case 'no_debriefs':
        return 'A túráid megvannak, de a Debrief még nincs kitöltve. Töltsd ki bármelyik túrádon a "Mit bántam meg?" űrlapot, hogy a felesleges itemeket kiszűrhessük.';
      case 'no_comfort':
        return 'A túráid és a Debrief megvannak, de a komfort-értékeléseid hiányosak. Értékeld a My Gear listádon legalább 3 itemet a komfort dimenziókban, hogy az ajánlás személyre szóljon.';
      case 'enough_data':
        return 'Ajánlás a te túráid alapján';
      default:
        return 'Az ajánlás jelenleg nem elérhető.';
    }
  };

  const reasonCopy = (reason: LoadoutReasonKey): string => {
    switch (reason) {
      case 'high_comfort':
        return 'Magas komfort-értékelés';
      case 'low_excess':
        return 'Ritkán volt felesleges';
      case 'both':
        return 'Magas komfort, ritkán felesleges';
      case 'new_item':
        return 'Még nem értékelted, de nem is hibás';
      case null:
        return '';
      default:
        return '';
    }
  };

  const resetError = () => {
    state.value.error = null;
  };

  return {
    state,
    load,
    get,
    emptyStateCopy,
    reasonCopy,
    resetError,
  };
}
