import { afterEach, describe, expect, it, vi } from 'vitest'
import { startPresencePoll } from '../miniprogram/services/presencePoll'

describe('presence poll', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ticks on the interval until stopped', async () => {
    vi.useFakeTimers()
    const tick = vi.fn()
    const poll = startPresencePoll({ tick, intervalMs: 2000 })
    expect(tick).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(tick).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(tick).toHaveBeenCalledTimes(2)
    poll.stop()
    await vi.advanceTimersByTimeAsync(4000)
    expect(tick).toHaveBeenCalledTimes(2)
  })

  it('skips ticks while paused', async () => {
    vi.useFakeTimers()
    const tick = vi.fn()
    let paused = true
    const poll = startPresencePoll({
      tick,
      intervalMs: 1000,
      isPaused: () => paused,
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).not.toHaveBeenCalled()
    paused = false
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(1)
    poll.stop()
  })

  it('does not overlap in-flight ticks', async () => {
    vi.useFakeTimers()
    let resolveTick: () => void = () => {}
    const tick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve
        }),
    )
    const poll = startPresencePoll({ tick, intervalMs: 1000 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(tick).toHaveBeenCalledTimes(1)
    resolveTick()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)
    expect(tick).toHaveBeenCalledTimes(2)
    poll.stop()
  })
})
