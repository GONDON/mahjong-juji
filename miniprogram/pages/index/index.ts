// @ts-nocheck
import {
  createSession,
  getSession,
  getSessionByRoomCode,
  type SessionDoc,
} from '../../services/sessionApi'
import {
  CHIP_OPTIONS,
  DEFAULT_SEAT_NICKNAMES,
  RECENT_STORAGE_KEY,
  battleTabTarget,
  canSubmitJoin,
  historyTabTarget,
  joinCodeCells,
  normalizeJoinCode,
  parseStoredCampaigns,
  presentRecentCampaign,
  selectChipValue,
  sessionRoute,
  upsertRecentCampaign,
  type RecentCampaign,
  type TabTarget,
} from './indexState'

function windowMetrics() {
  const info =
    typeof wx.getWindowInfo === 'function'
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync()
  const safeBottom =
    info.safeArea && info.screenHeight
      ? Math.max(0, info.screenHeight - info.safeArea.bottom)
      : 0
  return {
    statusBarHeight: info.statusBarHeight || 20,
    safeBottom,
  }
}

function cellViews(code: string) {
  return joinCodeCells(code).map((ch, slot) => ({ slot, ch }))
}

function campaignFromDoc(doc: SessionDoc): RecentCampaign {
  return {
    sessionId: doc.sessionId,
    roomCode: doc.roomCode,
    chipValueYuan: doc.chipValueYuan,
    status: doc.status,
    updatedAt: Date.now(),
  }
}

Page({
  data: {
    statusBarHeight: 20,
    safeBottom: 0,
    chipOptions: CHIP_OPTIONS,
    chipValueYuan: 1,
    joinCode: '',
    joinCells: cellViews(''),
    canJoin: false,
    joining: false,
    creating: false,
    campaigns: [] as RecentCampaign[],
    recents: [] as ReturnType<typeof presentRecentCampaign>[],
  },

  onLoad() {
    const metrics = windowMetrics()
    this.setData({
      statusBarHeight: metrics.statusBarHeight,
      safeBottom: metrics.safeBottom,
    })
  },

  onShow() {
    this.refreshRecents()
  },

  onChipTap(e: WechatMiniprogram.TouchEvent) {
    const next = selectChipValue(
      Number(e.currentTarget.dataset.value),
      this.data.chipValueYuan,
    )
    this.setData({ chipValueYuan: next })
  },

  onJoinCodeInput(e: WechatMiniprogram.Input) {
    const joinCode = normalizeJoinCode(String(e.detail.value ?? ''))
    this.setData({
      joinCode,
      joinCells: cellViews(joinCode),
      canJoin: canSubmitJoin(joinCode),
    })
  },

  async onCreateTap() {
    if (this.data.creating) return
    this.setData({ creating: true })
    try {
      const { sessionId, roomCode } = await createSession({
        chipValueYuan: this.data.chipValueYuan,
        nicknames: [...DEFAULT_SEAT_NICKNAMES] as [
          string,
          string,
          string,
          string,
        ],
      })
      this.remember({
        sessionId,
        roomCode,
        chipValueYuan: this.data.chipValueYuan,
        status: 'open',
        updatedAt: Date.now(),
      })
      wx.navigateTo({
        url: `/pages/dealer-pick/dealer-pick?sessionId=${encodeURIComponent(sessionId)}`,
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '开房失败', icon: 'none' })
    } finally {
      this.setData({ creating: false })
    }
  },

  async onJoinTap() {
    if (this.data.joining) return
    const code = normalizeJoinCode(this.data.joinCode)
    if (!canSubmitJoin(code)) {
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
      this.remember(campaignFromDoc(doc))
      if (doc.status === 'playing' && doc.currentCycle) {
        wx.navigateTo({
          url: `/pages/battle/battle?sessionId=${encodeURIComponent(doc.sessionId)}`,
        })
      } else if (doc.status === 'open' || doc.status === 'settling') {
        wx.navigateTo({
          url: `/pages/dealer-pick/dealer-pick?sessionId=${encodeURIComponent(doc.sessionId)}`,
        })
      } else {
        wx.navigateTo({
          url: `/pages/session/session?sessionId=${encodeURIComponent(doc.sessionId)}`,
        })
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加入失败', icon: 'none' })
    } finally {
      this.setData({ joining: false })
    }
  },

  onRecentTap(e: WechatMiniprogram.TouchEvent) {
    const sessionId = String(e.currentTarget.dataset.id || '')
    const campaign = this.data.campaigns.find(
      (item: RecentCampaign) => item.sessionId === sessionId,
    )
    if (!campaign) return
    wx.navigateTo({ url: sessionRoute(campaign) })
  },

  onBattleTab() {
    this.follow(battleTabTarget(this.data.campaigns))
  },

  onHistoryTab() {
    this.follow(historyTabTarget(this.data.campaigns))
  },

  onRankTap() {
    wx.navigateTo({ url: '/pages/rank/rank' })
  },

  onProfileTap() {
    wx.showToast({ title: '角色卡即将开放', icon: 'none' })
  },

  remember(campaign: RecentCampaign) {
    const campaigns = upsertRecentCampaign(this.data.campaigns, campaign)
    try {
      wx.setStorageSync(RECENT_STORAGE_KEY, campaigns)
    } catch (err) {
      console.error(err)
    }
    this.paintRecents(campaigns)
  },

  async refreshRecents() {
    let stored: RecentCampaign[] = []
    try {
      stored = parseStoredCampaigns(wx.getStorageSync(RECENT_STORAGE_KEY))
    } catch (err) {
      console.error(err)
    }

    const campaigns: RecentCampaign[] = []
    for (const item of stored) {
      try {
        const doc = await getSession(item.sessionId)
        campaigns.push({
          ...campaignFromDoc(doc),
          updatedAt:
            doc.status === item.status ? item.updatedAt : Date.now(),
        })
      } catch {
        campaigns.push(item)
      }
    }

    try {
      wx.setStorageSync(RECENT_STORAGE_KEY, campaigns)
    } catch (err) {
      console.error(err)
    }
    this.paintRecents(campaigns)
  },

  paintRecents(campaigns: RecentCampaign[]) {
    const now = Date.now()
    this.setData({
      campaigns,
      recents: campaigns.map((item) => presentRecentCampaign(item, now)),
    })
  },

  follow(target: TabTarget) {
    if (target.type === 'toast') {
      wx.showToast({ title: target.title, icon: 'none' })
      return
    }
    wx.navigateTo({ url: target.url })
  },
})
