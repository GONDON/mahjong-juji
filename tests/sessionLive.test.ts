import { afterEach, describe, expect, it, vi } from 'vitest'
import { startPresencePoll } from '../miniprogram/services/presencePoll'
import {
  FIRST_PACKET_TIMEOUT_MS,
  subscribeSession,
  toPublicSessionDoc,
} from '../miniprogram/services/sessionLive'
import type { SessionDoc } from '../miniprogram/services/sessionApi'

function doc(status: SessionDoc['status']): SessionDoc {
  return {
    sessionId: 's1',
    roomCode: 'ABCD',
    chipValueYuan: 1,
    scorerId: 'scorer',
    seats: [],
    members: [],
    memberOpenIds: ['scorer'],
    status,
    cycles: [],
    hands: [],
    huEvents: [],
    createdAt: 1,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('toPublicSessionDoc', () => {
  it('strips undoStack, dealerPickId, and _id', () => {
    const pub = toPublicSessionDoc({
      ...doc('playing'),
      undoStack: [{ x: 1 }],
      dealerPickId: 'p1',
      _id: 'raw',
    } as unknown as Record<string, unknown>)
    expect(pub.status).toBe('playing')
    expect('undoStack' in pub).toBe(false)
    expect('dealerPickId' in pub).toBe(false)
    expect('_id' in pub).toBe(false)
  })
})

describe('subscribeSession', () => {
  it('applies the first watch snapshot as onDoc when staying', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onDoc = vi.fn()
    const onNavigate = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'battle',
      onDoc,
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
      getSession: async () => doc('playing'),
    })
    send({ ...doc('playing'), undoStack: [] } as unknown as Record<string, unknown>)
    expect(onDoc).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
    live.stop()
  })

  it('navigates dealer-pick to battle on playing', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onDoc = vi.fn()
    const onNavigate = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc,
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
    })
    send(doc('playing') as unknown as Record<string, unknown>)
    expect(onNavigate).toHaveBeenCalledWith(
      '/pages/battle/battle?sessionId=s1',
    )
    expect(onDoc).not.toHaveBeenCalled()
    live.stop()
  })

  it('navigates battle to session on ended', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onNavigate = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'battle',
      onDoc: vi.fn(),
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
    })
    send(doc('ended') as unknown as Record<string, unknown>)
    expect(onNavigate).toHaveBeenCalledWith(
      '/pages/session/session?sessionId=s1',
    )
    live.stop()
  })

  it('does not navigate from session detail', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onNavigate = vi.fn()
    const onDoc = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'session',
      onDoc,
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
    })
    send(doc('playing') as unknown as Record<string, unknown>)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onDoc).toHaveBeenCalled()
    live.stop()
  })

  it('falls back to poll on watch error', async () => {
    vi.useFakeTimers()
    const getSession = vi.fn(async () => doc('open'))
    const onDoc = vi.fn()
    let fail!: (err: unknown) => void
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc,
      onNavigate: vi.fn(),
      getSession,
      watch: (_id, handlers) => {
        fail = handlers.onError
        return { close: vi.fn() }
      },
      startPoll: startPresencePoll,
    })
    fail(new Error('watch down'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(getSession).toHaveBeenCalled()
    expect(onDoc).toHaveBeenCalled()
    live.stop()
  })

  it('starts poll when the first watch packet never arrives', async () => {
    vi.useFakeTimers()
    const getSession = vi.fn(async () => doc('open'))
    const onDoc = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc,
      onNavigate: vi.fn(),
      getSession,
      watch: () => ({ close: vi.fn() }),
      startPoll: startPresencePoll,
      firstPacketTimeoutMs: FIRST_PACKET_TIMEOUT_MS,
    })
    await vi.advanceTimersByTimeAsync(FIRST_PACKET_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(2000)
    expect(getSession).toHaveBeenCalled()
    live.stop()
  })

  it('stop() prevents further poll ticks', async () => {
    vi.useFakeTimers()
    const getSession = vi.fn(async () => doc('open'))
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc: vi.fn(),
      onNavigate: vi.fn(),
      getSession,
      watch: () => null,
      startPoll: startPresencePoll,
    })
    live.stop()
    await vi.advanceTimersByTimeAsync(8000)
    expect(getSession).not.toHaveBeenCalled()
  })
})
