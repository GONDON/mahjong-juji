// @ts-nocheck
import { getSessionByRoomCode } from '../../services/sessionApi'

Page({
  data: {
    joinCode: '',
    joining: false,
  },

  onCreateTap() {
    wx.navigateTo({ url: '/pages/create/create' })
  },

  onJoinCodeInput(e: WechatMiniprogram.Input) {
    this.setData({ joinCode: String(e.detail.value ?? '').toUpperCase() })
  },

  async onJoinTap() {
    if (this.data.joining) return
    const code = String(this.data.joinCode || '').trim().toUpperCase()
    if (!code) {
      wx.showToast({ title: '请输入房间码', icon: 'none' })
      return
    }

    this.setData({ joining: true })
    try {
      const doc = await getSessionByRoomCode(code)
      if (!doc) {
        wx.showToast({ title: '房间不存在', icon: 'none' })
        return
      }
      // MVP：加入为只读围观；有进行中轮次进战场，否则进选庄
      if (doc.status === 'playing' && doc.currentCycle) {
        wx.navigateTo({
          url: `/pages/battle/battle?sessionId=${encodeURIComponent(doc.sessionId)}`,
        })
      } else if (doc.status === 'open' || doc.status === 'settling') {
        wx.navigateTo({
          url: `/pages/dealer-pick/dealer-pick?sessionId=${encodeURIComponent(doc.sessionId)}`,
        })
      } else {
        wx.showToast({ title: '夜局已结束', icon: 'none' })
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加入失败', icon: 'none' })
    } finally {
      this.setData({ joining: false })
    }
  },

  onRankTap() {
    wx.navigateTo({ url: '/pages/rank/rank' })
  },
})
