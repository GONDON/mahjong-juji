// @ts-nocheck
import {
  buildYearStats,
  rankGodWorst,
  type PlayerYearStat,
} from '../../domain/leaderboard'
import { getSession, listYearSettlements } from '../../services/sessionApi'

interface RankRow {
  rank: number
  playerId: string
  nickname: string
  totalYuan: number
  avgYuan: number
  sessions: number
  totalLabel: string
  avgLabel: string
}

function fmtYuan(n: number): string {
  const rounded = Math.round(n * 10) / 10
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return (rounded > 0 ? '+' : '') + s + ' 元'
}

function toRows(
  stats: PlayerYearStat[],
  nicknames: Record<string, string>,
): RankRow[] {
  return stats.map((s, i) => ({
    rank: i + 1,
    playerId: s.playerId,
    nickname: nicknames[s.playerId] || s.playerId,
    totalYuan: s.totalYuan,
    avgYuan: s.avgYuan,
    sessions: s.sessions,
    totalLabel: fmtYuan(s.totalYuan),
    avgLabel: fmtYuan(s.avgYuan),
  }))
}

Page({
  data: {
    year: new Date().getFullYear(),
    loading: true,
    empty: false,
    godByTotal: [] as RankRow[],
    godByAvg: [] as RankRow[],
    worstByTotal: [] as RankRow[],
    worstByAvg: [] as RankRow[],
  },

  onShow() {
    this.reload()
  },

  async reload() {
    const year = new Date().getFullYear()
    this.setData({ year, loading: true })
    try {
      const rows = await listYearSettlements(year)
      if (rows.length === 0) {
        this.setData({
          loading: false,
          empty: true,
          godByTotal: [],
          godByAvg: [],
          worstByTotal: [],
          worstByAvg: [],
        })
        return
      }

      const nicknames: Record<string, string> = {}
      const sessionIds = [...new Set(rows.map((r) => r.sessionId))]
      await Promise.all(
        sessionIds.map(async (id) => {
          try {
            const doc = await getSession(id)
            for (const seat of doc.seats) {
              if (!nicknames[seat.playerId]) {
                nicknames[seat.playerId] = seat.nickname
              }
            }
          } catch {
            /* nickname fallback: playerId */
          }
        }),
      )

      const stats = buildYearStats(rows)
      const ranked = rankGodWorst(stats, 3)
      this.setData({
        loading: false,
        empty: false,
        godByTotal: toRows(ranked.godByTotal, nicknames),
        godByAvg: toRows(ranked.godByAvg, nicknames),
        worstByTotal: toRows(ranked.worstByTotal, nicknames),
        worstByAvg: toRows(ranked.worstByAvg, nicknames),
      })
    } catch (err) {
      console.error(err)
      this.setData({ loading: false, empty: true })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },
})
