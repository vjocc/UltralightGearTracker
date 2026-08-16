/**
 * useGearAssignments — Sprint 5 P2 — "Ki mit visz" aggregált nézet.
 *
 * Dedikált composable a §4 specifikáció szerint (NEM a `useTrips` bővítése,
 * ahogy a P1 retro §2.2 rámutatott: a dedikált composable jobban
 * karbantartható). A state a `useState('gear-assignments')` névtérben
 * él, hogy ne ütközzön a `useTrips.gearAssignmentsByTripId` cache-sel.
 *
 * Használat (a pages/trips/[id].vue-ban):
 *   const { state, load } = useGearAssignments();
 *   await load(tripId.value);
 *
 * Owner-only endpoint (§11.2 A default). A `tripParticipantsLookup`
 * (Kliens) a `useTrips.listParticipants`-szal van összekötve, hogy a
 * user-selector dropdown a `TripParticipantRow` típussal dolgozzon
 * (owner + accepted invitee-k).
 */
import type {
  GearAssignmentsResponse,
  GearAssignmentParticipant,
  AssignedGearItem,
} from '~/shared/gearAssignmentSchemas';

export interface GearAssignmentsState {
  /** Per-trip cache, a `load()` metódus tölti. */
  byTripId: Record<string, GearAssignmentsResponse | null>;
  loading: boolean;
  error: string | null;
}

/**
 * A P2 "Ki mit visz" nézet dedikált composable-ja. Saját useState
 * névteret használ, hogy a useTrips composable aggregate cache-étől
 * függetlenül tesztelhető / újratölthető legyen.
 */
export function useGearAssignments() {
  const state = useState<GearAssignmentsState>('gear-assignments', () => ({
    byTripId: {},
    loading: false,
    error: null,
  }));

  const setError = (e: unknown) => {
    const err = e as { statusMessage?: string; message?: string };
    state.value.error =
      err?.statusMessage ?? err?.message ?? 'Unexpected error';
  };

  /**
   * Betölti a „Ki mit visz" aggregált nézetet a megadott trip-re.
   * A response-ot a state.byTripId[tripId]-be rakja; a UI onnan olvas
   * a participants listát.
   */
  const load = async (tripId: string): Promise<GearAssignmentsResponse> => {
    state.value.loading = true;
    state.value.error = null;
    try {
      const response = await $fetch<GearAssignmentsResponse>(
        `/api/trips/${tripId}/gear-assignments`,
      );
      state.value.byTripId[tripId] = response;
      return response;
    } catch (e) {
      // Owner-only hibák (403/404) ne szennyezzék a state.error-t —
      // a section v-if gate-e elrejti a nem-owner UI-t.
      const err = e as { statusCode?: number };
      if (err?.statusCode === 403 || err?.statusCode === 404) {
        state.value.byTripId[tripId] = null;
        return { participants: [] };
      }
      setError(e);
      throw e;
    } finally {
      state.value.loading = false;
    }
  };

  /**
   * Itemenkénti lista (a §11.3 B user-döntés szerinti megjelenítési
   * sorrend). A userenkénti csoportosítás (A default) a `participants`
   * tömb közvetlen renderelésével működik — ehhez a helperhez csak
   * akkor kell, ha a jövőben B opcióra váltunk.
   */
  const flatItems = (
    response: GearAssignmentsResponse | null,
  ): Array<{
    participant: GearAssignmentParticipant;
    item: AssignedGearItem;
  }> => {
    if (!response) return [];
    const out: Array<{
      participant: GearAssignmentParticipant;
      item: AssignedGearItem;
    }> = [];
    for (const p of response.participants) {
      for (const item of p.items) {
        out.push({ participant: p, item });
      }
    }
    return out;
  };

  return {
    state,
    load,
    flatItems,
  };
}
