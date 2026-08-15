/**
 * Sprint 5 P0.3 — Activation funnel capture (B opció: saját events tábla).
 *
 * Privacy-first, GDPR-barát funnel analytics a 6 capture-hellyel
 * (docs/sprint-5-p0-product-loop.md §4.5):
 *   1. signup_completed         — pages/signup.vue
 *   2. first_gear_added         — composables/useGear.ts create()
 *   3. first_trip_created       — composables/useTrips.ts create()
 *   4. first_loadout_assembled  — composables/useTrips.ts addGear()
 *   5. first_completed_trip     — composables/useTrips.ts markTripCompleted()
 *   6. first_debrief_written    — composables/useTrips.ts saveDebrief()
 *
 * A `first_*` guard:
 *   * Kliens-oldalon: useState flag (per-event-name, per-page-session).
 *     A capture hívás felesleges network round-tripje elkerülhető
 *     a flag-gel.
 *   * Szerver-oldalon: a /api/events/track endpoint ellenőrzi, hogy
 *     az adott (user_id, event_name) már létezik-e a `funnel_events`
 *     táblában. Ha igen, idempotens no-op (created: false).
 *   Dupla guard — a kliens a network overhead-et takarítja meg, a
 *   szerver a védelmet adja (a capture hívás oldalfrissítés után
 *   ismételt híváskor is biztonságos).
 *
 * A hálózati hiba (4xx/5xx) NEM dob user-facing hibát: a
 * funnel-tracking best-effort, a user flow-t NEM blokkolja.
 *
 * NEM SSR-aktív: a capture hívás csak kliens oldalon fut
 * (`if (import.meta.client)`); a SSR rendereléskor a composable
 * inicializálódik, de a trackEvent hívás az SSR renderelő fa alatt
 * NEM tüzel. A spec §4.5 a kliens-oldali capture-t preferálja
 * (Supabase Auth signup callback, INSERT success-ágak, stb. mind
 * kliens oldalon futnak).
 */

export type FunnelEventName =
  | 'signup_completed'
  | 'first_gear_added'
  | 'first_trip_created'
  | 'first_loadout_assembled'
  | 'first_completed_trip'
  | 'first_debrief_written';

/**
 * A capture-helyeken alkalmazott default payload helper-ek. A
 * payload event-specifikus (pl. signup_completed forrása: email).
 * A helper-ek CSAK a type-level default payload shape-et írják le,
 * NEM futtatnak side-effect-et.
 */
export interface FunnelEventPayloads {
  signup_completed: { source?: 'email' | 'magic_link' };
  first_gear_added: { category_id?: string };
  first_trip_created: Record<string, never>;
  first_loadout_assembled: { trip_id: string };
  first_completed_trip: { trip_id: string };
  first_debrief_written: Record<string, never>;
}

/**
 * useState kulcs a per-event-name flag-nek. A komponens-példány
 * szintű megosztás a Nuxt `useState` globális state-jén át.
 *   flag-user  : per-event-name, per-user (login session alatt
 *                perzisztens a useState-ban).
 *   flag-global: per-event-name, minden userre közös (ugyanaz a
 *                Nuxt SPA session-ben a user-ek között is).
 *
 * A flag-global azért kell, mert a useState(name, init) factory
 * a Nuxt hydration után `init()`-et hív, ha a kulcs nincs a
 * payload-ban — és a SETELÉS a kulcsot a Nuxt state payload-ba
 * írja. A hydration payload-on kívüli (tehát user-specifikus)
 * flag-ekhez a flag-user kell, a hydration payload-ból jövő
 * (server-side, kliensre másolt) flag-ekhez a flag-global.
 *
 * A valóságban: a useState factory `() => false` egy friss
 * ref-et ad vissza hydration után is, tehát a flag-user frissen
 * `false` lesz — a user-specifikus jelzés védve van. A
 * flag-global a hydration payload-ból jövő (tehát
 * SSR-előaktivált) flag-eket reprezentálja. Együttes alkalmazásuk
 * biztonságos.
 */
const flagUserKey = (eventName: FunnelEventName) => `funnel:${eventName}:fired:user`;
const flagGlobalKey = (eventName: FunnelEventName) => `funnel:${eventName}:fired:global`;

/**
 * Captures a funnel event via the server-side endpoint with a
 * client-side first_* guard.
 *
 * Best-effort: a hálózati hiba NEM dob user-facing hibát (a
 * funnel-tracking side-effect, nem blokkolja a user flow-t).
 */
export function useFunnelEvents() {
  /**
   * Fire-and-forget: a Promise NEM throw-ol kifelé (a catch
   * elnyeli). A hívó oldal nem várhat a `trackEvent` Promise-re
   * — a user flow nem blokkolódhat a funnel-trackingen.
   */
  const trackEvent = (
    eventName: FunnelEventName,
    payload?: Record<string, unknown>,
  ): void => {
    // SSR: a capture hívás NEM fut szerver oldalon. A Supabase
    // auth signup callback, INSERT success-ágak, stb. mind
    // kliens oldalon futnak; a useState flag SSR alatt is
    // biztonságos (frissen `false`).
    if (!import.meta.client) return;

    // Kliens-oldali first_* guard: ha a user session-je alatt
    // már kiváltotta, NE küldjünk újabb hálózati round-trip-et.
    const userFlag = useState<boolean>(flagUserKey(eventName), () => false);
    if (userFlag.value) return;

    // A szerver-oldali guard a második védelmi vonal; a kliens
    // flag a network overhead-et takarítja meg.

    // A flag-et ITT, a fetch előtt állítjuk be (nem a fetch
    // success-ágán) — mert a P0.3-ban per-session, per-event
    // single-fire a cél, nem a "fetch sikeres" alapú dedup.
    // A szerver-oldali ellenőrzés a második védelmi vonal,
    // ha valamiért a kliens oldali flag elromlana (pl. HMR,
    // multi-tab, stb.).
    userFlag.value = true;

    // A global flag a Nuxt hydration payload-ból jövő
    // állapotot tükrözi; ha SSR alatt beállították (nem
    // fogjuk, de defense-in-depth), a kliens oldali track
    // is blokkolódjon.
    const globalFlag = useState<boolean>(flagGlobalKey(eventName), () => false);
    if (globalFlag.value) return;
    globalFlag.value = true;

    // fire-and-forget — a user flow nem blokkolódhat
    void $fetch('/api/events/track', {
      method: 'POST',
      body: { event_name: eventName, payload: payload ?? {} },
    }).catch(() => {
      // Best-effort: a hiba a konzolra kerül (dev), ill.
      // a kliens-oldali flag már beállt, így a user session
      // alatt nem próbálkozunk újra. A production-ban a
      // funnel adatvesztés elfogadható (privacy-first, nem
      // blokkolunk user flow-t tracking-hibával).
      // eslint-disable-next-line no-console
      console.warn('[funnel] trackEvent failed', eventName);
    });
  };

  /**
   * Resets the per-event-name flag. Csak tesztelési célra
   * (a dev HMR a useState flag-et megtartja, és a per-session
   * single-fire teszt nem megismételhető flag-reset nélkül).
   * Production-ban a flag a session végéig tart.
   */
  const resetFlag = (eventName: FunnelEventName) => {
    if (!import.meta.client) return;
    useState<boolean>(flagUserKey(eventName), () => false).value = false;
    useState<boolean>(flagGlobalKey(eventName), () => false).value = false;
  };

  return { trackEvent, resetFlag };
}
