import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetMockSessions,
  __setMockOpenId,
  advanceToNextCycle,
  appendHu,
  createSession,
  getSession,
  MOCK_SCORER_ID,
  settleCycleManual,
  startCycle,
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
