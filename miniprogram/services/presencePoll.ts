export const PRESENCE_POLL_MS = 2000

export type PresencePoll = {
  stop: () => void
}

export function startPresencePoll(opts: {
  tick: () => void | Promise<void>
  intervalMs?: number
  isPaused?: () => boolean
  setIntervalFn?: typeof setInterval
  clearIntervalFn?: typeof clearInterval
}): PresencePoll {
  const intervalMs = opts.intervalMs ?? PRESENCE_POLL_MS
  const schedule = opts.setIntervalFn ?? setInterval
  const cancel = opts.clearIntervalFn ?? clearInterval
  let inFlight = false
  const id = schedule(() => {
    if (inFlight) return
    if (opts.isPaused?.()) return
    inFlight = true
    Promise.resolve(opts.tick()).finally(() => {
      inFlight = false
    })
  }, intervalMs)
  return {
    stop() {
      cancel(id)
    },
  }
}
