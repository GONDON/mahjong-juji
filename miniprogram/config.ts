/**
 * Local / WeChat cloud toggles.
 *
 * CLOUD_ENV_ID is the env from WeChat DevTools → 云开发 (cloud1).
 * Node tests have no `wx`, so USE_MOCK stays true for `npm test`.
 * DevTools / device have `wx`, so the miniprogram calls sessionWrite.
 * See docs/cloud-setup.md.
 */

/** WeChat cloud environment id. */
export const CLOUD_ENV_ID = 'cloud1-d4g7zfv1x770ba8fe'

/**
 * When true, sessionApi uses the in-memory mock store.
 * Forced on in Node (vitest). False in WeChat so two devices can share a room.
 */
export const USE_MOCK = typeof wx === 'undefined'
