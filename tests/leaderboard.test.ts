import { describe, it, expect } from 'vitest'
import {
  buildYearStats,
  rankGodWorst,
} from '../miniprogram/domain/leaderboard'
import type { SessionPlayerYuan } from '../miniprogram/domain/leaderboard'

describe('buildYearStats', () => {
  it('sums yuan and counts distinct sessions per player', () => {
    const rows: SessionPlayerYuan[] = [
      { sessionId: 's1', playerId: 'a', yuan: 10 },
      { sessionId: 's1', playerId: 'b', yuan: -10 },
      { sessionId: 's2', playerId: 'a', yuan: 20 },
      { sessionId: 's2', playerId: 'b', yuan: -20 },
      { sessionId: 's3', playerId: 'a', yuan: -5 },
    ]
    const stats = buildYearStats(rows)
    const a = stats.find((s) => s.playerId === 'a')!
    const b = stats.find((s) => s.playerId === 'b')!
    expect(a.totalYuan).toBe(25)
    expect(a.sessions).toBe(3)
    expect(a.avgYuan).toBeCloseTo(25 / 3)
    expect(b.totalYuan).toBe(-30)
    expect(b.sessions).toBe(2)
    expect(b.avgYuan).toBe(-15)
  })
})

describe('rankGodWorst', () => {
  it('ranks by total for all players; avg ranks require minSessions', () => {
    const stats = buildYearStats([
      { sessionId: 's1', playerId: 'a', yuan: 30 },
      { sessionId: 's2', playerId: 'a', yuan: 30 },
      { sessionId: 's3', playerId: 'a', yuan: 30 },
      { sessionId: 's1', playerId: 'b', yuan: 60 },
      { sessionId: 's2', playerId: 'b', yuan: 40 },
    ])
    const r = rankGodWorst(stats, 3)

    expect(r.godByTotal[0].playerId).toBe('b')
    expect(r.worstByTotal[0].playerId).toBe('a')

    expect(r.godByAvg.map((s) => s.playerId)).toEqual(['a'])
    expect(r.worstByAvg.map((s) => s.playerId)).toEqual(['a'])
    expect(r.godByAvg.find((s) => s.playerId === 'b')).toBeUndefined()
  })
})
