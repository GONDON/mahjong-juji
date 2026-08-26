// @ts-nocheck
import { listMySessions } from '../../services/sessionApi'
import {
  HISTORY_FETCH_LIMIT,
  presentRecentCampaign,
  sessionDetailRoute,
  sessionRoute,
  type RecentCampaign,
} from '../index/indexState'

Page({
  data: {
    loading: true,
    recents: [] as ReturnType<typeof presentRecentCampaign>[],
    campaigns: [] as RecentCampaign[],
  },

  onShow() {
    this.reload()
  },

  findCampaign(sessionId: string): RecentCampaign | undefined {
    return this.data.campaigns.find(
      (item: RecentCampaign) => item.sessionId === sessionId,
    )
  },

  onRecentTap(e: WechatMiniprogram.TouchEvent) {
    const sessionId = String(e.currentTarget.dataset.id || '')
    const campaign = this.findCampaign(sessionId)
    if (!campaign) return
    wx.navigateTo({ url: sessionDetailRoute(campaign) })
  },

  onReenterTap(e: WechatMiniprogram.TouchEvent) {
    const sessionId = String(e.currentTarget.dataset.id || '')
    const campaign = this.findCampaign(sessionId)
    if (!campaign) return
    wx.navigateTo({ url: sessionRoute(campaign) })
  },

  async reload() {
    const hadRows = this.data.recents.length > 0
    if (!hadRows) this.setData({ loading: true })
    try {
      const list = await listMySessions({ limit: HISTORY_FETCH_LIMIT })
      this.setData({
        loading: false,
        campaigns: list,
        recents: list.map((item) => presentRecentCampaign(item)),
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      if (!hadRows) this.setData({ loading: false })
    }
  },
})
