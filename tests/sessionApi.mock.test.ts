import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetMockSessions,
  appendHu,
  createSession,
  getSession,
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

    await startCycle(sessionId, 'p0')

    await appendHu(sessionId, {
      winnerId: 'p1',
      winType: 'dianpao',
      dianpaoId: 'p2',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })

    const doc = await getSession(sessionId)
    expect(doc.seats.find((s) => s.playerId === 'p1')!.chips).toBe(21)
    expect(doc.seats.find((s) => s.playerId === 'p2')!.chips).toBe(19)
    expect(doc.seats.find((s) => s.playerId === 'p1')!.hasHu).toBe(true)
    expect(doc.huEvents).toHaveLength(1)
    expect(doc.status).toBe('playing')
  })
})
