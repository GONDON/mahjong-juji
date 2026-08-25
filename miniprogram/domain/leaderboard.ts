import type { PlayerId } from './types'

export interface SessionPlayerYuan {
  sessionId: string
  playerId: PlayerId
  yuan: number
  /** Present when settlement carried a claimed seat openId. */
  openId?: string | null
}

export interface PlayerYearStat {
  playerId: PlayerId
  totalYuan: number
  sessions: number
  avgYuan: number
}

export function buildYearStats(
  rows: SessionPlayerYuan[],
): PlayerYearStat[] {
  const map = new Map<PlayerId, { total: number; sessions: Set<string> }>()
  for (const r of rows) {
    let g = map.get(r.playerId)
    if (!g) {
      g = { total: 0, sessions: new Set() }
      map.set(r.playerId, g)
    }
    g.total += r.yuan
    g.sessions.add(r.sessionId)
  }
  return [...map.entries()].map(([playerId, g]) => ({
    playerId,
    totalYuan: g.total,
    sessions: g.sessions.size,
    avgYuan: g.total / g.sessions.size,
  }))
}

export function rankGodWorst(
  stats: PlayerYearStat[],
  minSessions = 3,
): {
  godByTotal: PlayerYearStat[]
  godByAvg: PlayerYearStat[]
  worstByTotal: PlayerYearStat[]
  worstByAvg: PlayerYearStat[]
} {
  const byTotal = [...stats].sort((a, b) => b.totalYuan - a.totalYuan)
  const avgEligible = stats.filter((s) => s.sessions >= minSessions)
  const byAvg = [...avgEligible].sort((a, b) => b.avgYuan - a.avgYuan)
  return {
    godByTotal: byTotal,
    godByAvg: byAvg,
    worstByTotal: [...byTotal].reverse(),
    worstByAvg: [...byAvg].reverse(),
  }
}
