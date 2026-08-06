// @ts-nocheck
import { getSession } from '../../services/sessionApi'

Page({
  data: {
    sessionId: '',
    roomCode: '',
    cycleCount: 0,
    status: '',
    loading: true,
  },

  onLoad(query: Record<string, string | undefined>) {
    const sessionId = query.sessionId ? decodeURIComponent(query.sessionId) : ''
    this.setData({ sessionId })
  },

  async onShow() {
    const { sessionId } = this.data
    if (!sessionId) {
      this.setData({ loading: false })
      return
    }
    try {
      const doc = await getSession(sessionId)
      this.setData({
        roomCode: doc.roomCode,
        cycleCount: doc.cycles.length,
        status: doc.status,
        loading: false,
      })
    } catch (err) {
      console.error(err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },
})
