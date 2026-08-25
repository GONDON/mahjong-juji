// @ts-nocheck
import {
  endSession,
  getSession,
  type SessionDoc,
  type SessionStatus,
} from '../../services/sessionApi'
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

  onLoad(query: Record<string, string | undefined>) {
    const sessionId = query.sessionId ? decodeURIComponent(query.sessionId) : ''
    this.setData({ sessionId })
  },

  async onShow() {
    await this.reload()
  },

  async reload() {
    const { sessionId } = this.data
    if (!sessionId) {
      this.setData({ loading: false })
      return
    }
    try {
      const doc = await getSession(sessionId)
      const canEnd = doc.status !== 'ended' && !doc.currentCycle
      this.setData({
        roomCode: doc.roomCode,
        chipValueYuan: doc.chipValueYuan,
        status: doc.status,
        statusLabel: STATUS_LABEL[doc.status] || doc.status,
        cycles: buildCycles(doc),
        canEnd,
        loading: false,
      })
    } catch (err) {
      console.error(err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
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
      wx.reLaunch({ url: '/pages/index/index' })
    } catch (err) {
      console.error(err)
      this.setData({ busy: false })
      wx.showToast({ title: '结束失败', icon: 'none' })
    }
  },
})
