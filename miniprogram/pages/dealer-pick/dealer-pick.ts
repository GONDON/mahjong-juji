// @ts-nocheck
import { getSession, startCycle } from '../../services/sessionApi'

Page({
  data: {
    sessionId: '',
    roomCode: '',
    seats: [] as { playerId: string; nickname: string }[],
    selectedId: '',
    confirming: false,
    loading: true,
    /** Mock default: everyone is scorer; cloud enforces via sessionWrite. */
    isScorer: true,
  },

  async onLoad(query: Record<string, string | undefined>) {
    const sessionId = query.sessionId ? decodeURIComponent(query.sessionId) : ''
    if (!sessionId) {
      wx.showToast({ title: '缺少 sessionId', icon: 'none' })
      this.setData({ loading: false })
      return
    }
    this.setData({ sessionId })
    try {
      const doc = await getSession(sessionId)
      this.setData({
        roomCode: doc.roomCode,
        seats: doc.seats.map((s) => ({
          playerId: s.playerId,
          nickname: s.nickname,
        })),
        isScorer: true,
        loading: false,
      })
    } catch (err) {
      console.error(err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onSelect(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.isScorer) return
    const playerId = String(e.currentTarget.dataset.id || '')
    if (!playerId) return
    this.setData({ selectedId: playerId })
  },

  async onConfirm() {
    if (!this.data.isScorer || this.data.confirming) return
    const { sessionId, selectedId } = this.data
    if (!selectedId) {
      wx.showToast({ title: '请先点选庄家', icon: 'none' })
      return
    }

    this.setData({ confirming: true })
    try {
      await startCycle(sessionId, selectedId)
      wx.redirectTo({
        url: `/pages/battle/battle?sessionId=${encodeURIComponent(sessionId)}`,
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '开局失败', icon: 'none' })
      this.setData({ confirming: false })
    }
  },
})
