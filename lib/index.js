/**
 * dsh-input-history-recall host half.
 *
 * This plugin is purely a browser-side feature: it adds composer keyboard
 * history recall (double-press ArrowUp/ArrowDown scrolls this session's sent
 * messages). All behavior lives in the client bundle (`lib/client.js`); the
 * host half only exists so the Cordis Loader activates the entry, which is
 * what the client-modules scanner keys on to serve `/plugins/<id>/client.js`.
 * @module dsh-input-history-recall
 */

/** Plugin identity for cordis.yml rows. */
export const name = 'dsh-input-history-recall'

/** No Host-side services are required; the client half does everything. */
export function apply() {
  // intentionally empty
}
