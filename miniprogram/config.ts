/**
 * Local / WeChat cloud toggles.
 *
 * Replace CLOUD_ENV_ID with the env id from WeChat DevTools → 云开发.
 * Keep USE_MOCK=true for npm tests and offline UI; set false after deploying
 * cloudfunctions/sessionWrite (see docs/cloud-setup.md).
 */

/** WeChat cloud environment id. Replace YOUR_ENV_ID before USE_MOCK=false. */
export const CLOUD_ENV_ID = 'YOUR_ENV_ID'

/**
 * When true (default), sessionApi uses the in-memory mock store.
 * When false, all reads/writes go through wx.cloud.callFunction('sessionWrite').
 */
export const USE_MOCK = true
