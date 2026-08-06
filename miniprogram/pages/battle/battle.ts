// @ts-nocheck
import type { CycleSettlementRow } from '../../domain/settleCycle'
import type { HuInput } from '../../domain/types'
import {
  appendHu,
  endSession,
  getSession,
  liuju,
  settleCycleManual,
  undoLastHu,
  type SessionDoc,
  type SessionSeat,
} from '../../services/sessionApi'

const POS_LABELS = ['下', '右', '上', '左']

function dealerMult(streak: number): number {
  return 2 + streak
}

function buildViewSeats(seats: SessionSeat[], dealerId: string) {
  return seats.map((s, i) => ({
    ...s,
    posLabel: POS_LABELS[i] || String(i + 1),
    isDealer: s.playerId === dealerId,
  }))
}

function canUndoFrom(doc: SessionDoc): boolean {
  if (!doc.currentCycle || doc.huEvents.length === 0 || doc.hands.length === 0) {
    return false
  }
  const hand = doc.hands[doc.hands.length - 1]
  const last = doc.huEvents[doc.huEvents.length - 1]
  return !hand.liuju && last.handIndex === hand.index
}

Page({
  data: {
    sessionId: '',
    loading: true,
    busy: false,
    roomCode: '',
    dealerId: '',
    dealerNickname: '',
    streak: 0,
    mult: 2,
    cycleIndex: 0,
    handIndex: 0,
    seats: [] as ReturnType<typeof buildViewSeats>,
    canUndo: false,
    /** Mock default: everyone is scorer. Cloud relies on server gate. */
    isScorer: true,
    showHuSheet: false,
    winnerId: '',
    showSettle: false,
    settlements: [] as (CycleSettlementRow & { nickname: string })[],
  },

  onLoad(query: Record<string, string | undefined>) {
    const sessionId = query.sessionId ? decodeURIComponent(query.sessionId) : ''
    this.setData({ sessionId })
  },

  onShow() {
    if (this.data.sessionId) {
      this.reload()
    }
  },

  async reload() {
    const { sessionId } = this.data
    if (!sessionId) {
      this.setData({ loading: false })
      return
    }
    try {
      const doc = await getSession(sessionId)
      this.applyDoc(doc)
    } catch (err) {
      console.error(err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  applyDoc(doc: SessionDoc, settlements?: CycleSettlementRow[]) {
    const dealer = doc.currentCycle?.dealer
    const dealerId = dealer?.dealerId || ''
    const streak = dealer?.streak ?? 0
    const dealerSeat = doc.seats.find((s) => s.playerId === dealerId)
    const hand = doc.hands[doc.hands.length - 1]
    const settleRows =
      settlements ||
      (doc.status === 'settling' && doc.cycles.length
        ? doc.cycles[doc.cycles.length - 1].settlements
        : undefined)

    const nickMap = Object.fromEntries(doc.seats.map((s) => [s.playerId, s.nickname]))

    // Mock default: everyone is scorer. Cloud write gate is server-side (Critical 1).
    this.setData({
      loading: false,
      roomCode: doc.roomCode,
      dealerId,
      dealerNickname: dealerSeat?.nickname || (dealerId ? '—' : '未开局'),
      streak,
      mult: dealer ? dealerMult(streak) : 0,
      cycleIndex: doc.currentCycle?.index ?? doc.cycles.length,
      handIndex: hand?.index ?? 0,
      seats: buildViewSeats(doc.seats, dealerId),
      canUndo: canUndoFrom(doc),
      isScorer: true,
      showSettle: Boolean(settleRows && settleRows.length),
      settlements: (settleRows || []).map((r) => ({
        ...r,
        nickname: nickMap[r.playerId] || r.playerId,
      })),
    })
  },

  selectSeat(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.isScorer || this.data.busy || this.data.showSettle) return
    const playerId = String(e.currentTarget.dataset.id || '')
    const hasHu = e.currentTarget.dataset.hashu === true || e.currentTarget.dataset.hashu === 'true'
    if (!playerId || hasHu) return

    const seat = this.data.seats.find((s) => s.playerId === playerId)
    if (!seat || seat.hasHu) return

    this.setData({
      showHuSheet: true,
      winnerId: playerId,
    })
  },

  closeHuSheet() {
    this.setData({
      showHuSheet: false,
      winnerId: '',
    })
  },

  async onHuConfirm(e: WechatMiniprogram.CustomEvent<HuInput>) {
    if (this.data.busy) return
    const input = e.detail
    if (!input?.winnerId) return
    if (input.winType === 'dianpao' && !input.dianpaoId) {
      wx.showToast({ title: '请选择点炮者', icon: 'none' })
      return
    }

    this.setData({ busy: true })
    try {
      const result = await appendHu(this.data.sessionId, input)
      this.setData({ showHuSheet: false, winnerId: '', busy: false })
      if (result.cycleOver) {
        const doc = await getSession(this.data.sessionId)
        this.applyDoc(doc, result.settlements)
      } else {
        await this.reload()
      }
    } catch (err) {
      console.error(err)
      this.setData({ busy: false })
      wx.showToast({ title: '录胡失败', icon: 'none' })
    }
  },

  async onSettleCycle() {
    if (!this.data.isScorer || this.data.busy || this.data.showSettle) return
    const { sessionId } = this.data
    const ok = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '本轮结清？',
        content: '提前结束本轮并按当前筹码结算，确认后不可撤销本轮牌局。',
        success: (r) => resolve(Boolean(r.confirm)),
        fail: () => resolve(false),
      })
    })
    if (!ok) return

    this.setData({ busy: true })
    try {
      const settlements = await settleCycleManual(sessionId)
      const doc = await getSession(sessionId)
      this.applyDoc(doc, settlements)
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '结清失败', icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },

  async onLiuju() {
    if (!this.data.isScorer || this.data.busy || this.data.showSettle) return
    const { sessionId } = this.data
    const ok = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '结束本局？',
        content: '若本局无人胡，庄与连庄不变；若已有人胡，下一局按首胡者坐庄（庄家首胡则连庄+1）。',
        success: (r) => resolve(Boolean(r.confirm)),
        fail: () => resolve(false),
      })
    })
    if (!ok) return

    this.setData({ busy: true })
    try {
      await liuju(sessionId)
      await this.reload()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '流局失败', icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },

  async onUndo() {
    if (!this.data.isScorer || this.data.busy || this.data.showSettle || !this.data.canUndo) return
    this.setData({ busy: true })
    try {
      await undoLastHu(this.data.sessionId)
      await this.reload()
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '无法撤销', icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },

  onSessionDetail() {
    const { sessionId } = this.data
    wx.navigateTo({
      url: `/pages/session/session?sessionId=${encodeURIComponent(sessionId)}`,
      fail: () => {
        wx.showToast({ title: '夜局详情稍后开放', icon: 'none' })
      },
    })
  },

  onNextCycle() {
    const { sessionId } = this.data
    wx.redirectTo({
      url: `/pages/dealer-pick/dealer-pick?sessionId=${encodeURIComponent(sessionId)}`,
    })
  },

  async onEndSession() {
    if (this.data.busy) return
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
