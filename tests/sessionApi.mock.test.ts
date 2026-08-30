import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  __resetMockSessions,
  __setMockActor,
  __setMockOpenId,
  advanceToNextCycle,
  appendHu,
  createSession,
  enterSession,
  getSession,
  listMySessions,
  MOCK_SCORER_ID,
  LIST_MY_SESSIONS_MAX,
  settleCycleManual,
  startCycle,
  toSessionSummary,
} from '../miniprogram/services/sessionApi'

describe('sessionApi mock', () => {
  beforeEach(() => {
    __resetMockSessions()
  })

  it('createSession → startCycle → appendHu pinghu dianpao updates chips', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })

    const opened = await getSession(sessionId)
    expect(opened.scorerId).toBe(MOCK_SCORER_ID)
    expect(opened.members).toHaveLength(1)
    expect(opened.seats.every((s) => !s.claimedOpenId)).toBe(true)
    const [idA, idB, idC] = opened.seats.map((s) => s.playerId)
    expect(idA).toMatch(/^nid_/)
    expect(idB).toMatch(/^nid_/)

    await startCycle(sessionId, idA)

    await appendHu(sessionId, {
      winnerId: idB,
      winType: 'dianpao',
      dianpaoId: idC,
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })

    const doc = await getSession(sessionId)
    expect(doc.seats[1].chips).toBe(21)
    expect(doc.seats[2].chips).toBe(19)
    expect(doc.seats[1].hasHu).toBe(true)
    expect(doc.huEvents).toHaveLength(1)
    expect(doc.status).toBe('playing')
  })

  it('getSession deep-clones without structuredClone (WeChat runtime)', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })

    const hadStructuredClone = 'structuredClone' in globalThis
    const original = globalThis.structuredClone
    // Simulate WeChat miniprogram base library without structuredClone.
    // @ts-expect-error intentional delete for runtime compat test
    delete globalThis.structuredClone

    try {
      const doc = await getSession(sessionId)
      expect(doc.sessionId).toBe(sessionId)
      expect(doc.seats).toHaveLength(4)

      doc.seats[0].chips = 999
      const again = await getSession(sessionId)
      expect(again.seats[0].chips).toBe(0)
    } finally {
      if (hadStructuredClone) {
        globalThis.structuredClone = original
      }
    }
  })

  it('sets memberOpenIds on create', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    const doc = await getSession(sessionId)
    expect(doc.memberOpenIds).toEqual([MOCK_SCORER_ID])
  })

  it('rejects startCycle until the table is open again', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    const idA = (await getSession(sessionId)).seats[0].playerId
    await startCycle(sessionId, idA)
    await settleCycleManual(sessionId)
    await expect(startCycle(sessionId, idA)).rejects.toThrow(/open/i)
    await advanceToNextCycle(sessionId)
    const after = await getSession(sessionId)
    expect(after.status).toBe('open')
    expect(after.cycles).toHaveLength(1)
    expect(after.seats).toHaveLength(4)
    await startCycle(sessionId, idA)
    expect((await getSession(sessionId)).status).toBe('playing')
  })

  it('gates advanceToNextCycle to the scorer and settling', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    await expect(advanceToNextCycle(sessionId)).rejects.toThrow(/settling/i)
    const idA = (await getSession(sessionId)).seats[0].playerId
    await startCycle(sessionId, idA)
    await expect(advanceToNextCycle(sessionId)).rejects.toThrow(/settling/i)
    await settleCycleManual(sessionId)
    __setMockOpenId('not-scorer')
    await expect(advanceToNextCycle(sessionId)).rejects.toThrow(/scorer/i)
    __setMockOpenId(null)
    await advanceToNextCycle(sessionId)
    expect((await getSession(sessionId)).status).toBe('open')
  })
})

describe('listMySessions', () => {
  beforeEach(() => {
    __resetMockSessions()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('maps a row and fills sessionId from _id', () => {
    expect(
      toSessionSummary({
        _id: 'sess_x',
        roomCode: '8K2P',
        chipValueYuan: 2,
        status: 'open',
        createdAt: 10,
      }),
    ).toEqual({
      sessionId: 'sess_x',
      roomCode: '8K2P',
      chipValueYuan: 2,
      startingChips: 20,
      status: 'open',
      createdAt: 10,
    })
    expect(toSessionSummary({ roomCode: '8K2P' })).toBeNull()
  })

  it('coerces Date createdAt from the cloud SDK', () => {
    expect(
      toSessionSummary({
        sessionId: 'sess_x',
        roomCode: '8K2P',
        chipValueYuan: 2,
        status: 'ended',
        createdAt: new Date(1_700_000_000_000),
      }),
    ).toEqual({
      sessionId: 'sess_x',
      roomCode: '8K2P',
      chipValueYuan: 2,
      startingChips: 20,
      status: 'ended',
      createdAt: 1_700_000_000_000,
    })
  })

  it('returns only rooms the actor joined, newest first, capped', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const a = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    vi.setSystemTime(2000)
    const b = await createSession({
      chipValueYuan: 2,
      nicknames: ['东', '南', '西', '北'],
    })
    vi.useRealTimers()

    __setMockActor('user-b')
    await enterSession({ sessionId: a.sessionId })

    const asGuest = await listMySessions()
    expect(asGuest.map((s) => s.sessionId)).toEqual([a.sessionId])

    __setMockActor(MOCK_SCORER_ID)
    const asScorer = await listMySessions()
    expect(asScorer.map((s) => s.sessionId)).toEqual([b.sessionId, a.sessionId])
    expect(asScorer[0].chipValueYuan).toBe(2)

    const capped = await listMySessions({ limit: 1 })
    expect(capped).toHaveLength(1)
    expect(capped[0].sessionId).toBe(b.sessionId)
    expect(LIST_MY_SESSIONS_MAX).toBe(50)
  })
})

describe('startingChips on session', () => {
  beforeEach(() => {
    __resetMockSessions()
  })

  it('stores startingChips, deals them, and settles against them', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 2,
      startingChips: 15,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    const opened = await getSession(sessionId)
    expect(opened.startingChips).toBe(15)
    const idA = opened.seats[0].playerId
    await startCycle(sessionId, idA)
    const playing = await getSession(sessionId)
    expect(playing.seats.every((s) => s.chips === 15)).toBe(true)
    const rows = await settleCycleManual(sessionId)
    expect(rows.every((r) => r.chipDelta === 0 && r.yuan === 0)).toBe(true)
  })

  it('rejects illegal startingChips on create', async () => {
    await expect(
      createSession({
        chipValueYuan: 1,
        startingChips: 11,
        nicknames: ['A', 'B', 'C', 'D'],
      }),
    ).rejects.toThrow(/startingChips/)
  })
})

describe('houseRules on session', () => {
  beforeEach(() => {
    __resetMockSessions()
  })

  it('stores plusOne by default and scores zimo with it', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    const opened = await getSession(sessionId)
    expect(opened.houseRules).toEqual({ zimoFan: 'plusOne' })
    await startCycle(sessionId, opened.seats[0].playerId)
    const r = await appendHu(sessionId, {
      winnerId: opened.seats[1].playerId,
      winType: 'zimo',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.score.perPayer).toBe(2)
  })

  it('rejects illegal houseRules on create', async () => {
    await expect(
      createSession({
        chipValueYuan: 1,
        nicknames: ['东', '南', '西', '北'],
        houseRules: { zimoFan: 'timesThree' } as never,
      }),
    ).rejects.toThrow(/houseRules/)
  })
})
