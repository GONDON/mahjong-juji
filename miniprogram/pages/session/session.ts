// @ts-nocheck
import {
  endSession,
  type SessionDoc,
} from '../../services/sessionApi'
import { subscribeSession } from '../../services/sessionLive'
import type { TablePage } from '../../domain/sessionRoute'
import {
  presentSession,
  toggleCycleExpanded,
} from './sessionState'

Page({
  data: {
    sessionId: '',
    roomCode: '',
    chipValueYuan: 0,
    startingChips: 0,
    zimoFanLabel: '',
    status: '',
    statusLabel: '',
    ended: false,
    cycles: [] as ReturnType<typeof presentSession>['cycles'],
    canEnd: false,
    loading: true,
    busy: false,
  },

  _live: null as { stop: () => void } | null,
  _page: 'session' as TablePage,

  onLoad(query: Record<string, string | undefined>) {
    const sessionId = query.sessionId ? decodeURIComponent(query.sessionId) : ''
    this.setData({ sessionId })
  },

  onShow() {
    this.startLive()
  },

  onHide() {
    this.stopLive()
  },

  onUnload() {
    this.stopLive()
  },

  startLive() {
    this.stopLive()
    const sessionId = this.data.sessionId
    if (!sessionId) {
      this.setData({ loading: false })
      return
    }
    this._live = subscribeSession({
      sessionId,
      page: this._page,
      onDoc: (doc) => this.applyDoc(doc),
      onNavigate: () => {
        // Session detail never follows away from this page.
      },
      onFirstError: () => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      },
    })
  },

  stopLive() {
    this._live?.stop()
    this._live = null
  },

  applyDoc(doc: SessionDoc) {
    const expanded =
      this.data.cycles.length === 0
        ? 'latest'
        : new Set(
            this.data.cycles.filter((c) => c.expanded).map((c) => c.index),
          )
    const view = presentSession(doc, expanded)
    this.setData({
      ...view,
      loading: false,
    })
  },

  onToggleCycle(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    this.setData({
      cycles: toggleCycleExpanded(this.data.cycles, index),
    })
  },

  async onEndSession() {
    if (this.data.busy || !this.data.canEnd) return
    const { confirm } = await wx.showModal({
      title: '结束牌局',
      content: '结束后不可再开轮，已结算轮次会保留。确定？',
    })
    if (!confirm) return
    this.setData({ busy: true })
    try {
      await endSession(this.data.sessionId)
    } catch (err) {
      console.error(err)
      this.setData({ busy: false })
      wx.showToast({ title: '结束失败', icon: 'none' })
      return
    }
    this.setData({ busy: false })
  },
})
