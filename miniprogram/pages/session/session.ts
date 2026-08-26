// @ts-nocheck
import {
  endSession,
  type SessionDoc,
  type SessionStatus,
} from '../../services/sessionApi'
import { subscribeSession } from '../../services/sessionLive'
import type { TablePage } from '../../domain/sessionRoute'
import type { BasicFan } from '../../domain/types'

const BASIC_FAN_LABEL: Record<BasicFan, string> = {
  pinghu: '平胡',
  duidui: '对对胡',
  qingyise: '清一色',
  qidui: '七对',
  jingougou: '金钩钩',
  qingdui: '清对',
  qingqidui: '清七对',
  qingjingougou: '清金钩钩',
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  open: '未开局',
  playing: '进行中',
  settling: '待结算/可续轮',
  ended: '已结束',
}

function nickMap(doc: SessionDoc): Record<string, string> {
  const m: Record<string, string> = {}
  for (const s of doc.seats) m[s.playerId] = s.nickname
  return m
}

function buildCycles(doc: SessionDoc) {
  const nicks = nickMap(doc)
  return doc.cycles.map((c) => {
    const hands = doc.hands.filter((h) => h.cycleIndex === c.index)
    const handIndexes = new Set(hands.map((h) => h.index))
    const huEvents = doc.huEvents
      .filter((e) => handIndexes.has(e.handIndex))
      .map((e) => ({
        handIndex: e.handIndex,
        winner: nicks[e.input.winnerId] || e.input.winnerId,
        winType: e.input.winType === 'zimo' ? '自摸' : '点炮',
        fan: BASIC_FAN_LABEL[e.input.basicFan] || e.input.basicFan,
        perPayer: e.score.perPayer,
      }))
    const handSummaries = hands.map((h) => {
      const hus = huEvents.filter((e) => e.handIndex === h.index)
      return {
        index: h.index,
        liuju: h.liuju,
        dealer: nicks[h.dealerId] || h.dealerId,
        streak: h.streak,
        hus,
      }
    })
    return {
      index: c.index,
      expanded: false,
      settlements: c.settlements.map((s) => ({
        ...s,
        nickname: nicks[s.playerId] || s.playerId,
      })),
      hands: handSummaries,
    }
  })
}

Page({
  data: {
    sessionId: '',
    roomCode: '',
    chipValueYuan: 0,
    status: '',
    statusLabel: '',
    cycles: [] as ReturnType<typeof buildCycles>,
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
    const expanded = new Set(
      this.data.cycles.filter((c) => c.expanded).map((c) => c.index),
    )
    const cycles = buildCycles(doc).map((c) => ({
      ...c,
      expanded: expanded.has(c.index),
    }))
    const canEnd = doc.status !== 'ended' && !doc.currentCycle
    this.setData({
      roomCode: doc.roomCode,
      chipValueYuan: doc.chipValueYuan,
      status: doc.status,
      statusLabel: STATUS_LABEL[doc.status] || doc.status,
      cycles,
      canEnd,
      loading: false,
    })
  },

  onToggleCycle(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const cycles = this.data.cycles.map((c) =>
      c.index === index ? { ...c, expanded: !c.expanded } : c,
    )
    this.setData({ cycles })
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
