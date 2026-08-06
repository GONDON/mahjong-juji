// @ts-nocheck
import type { CycleSettlementRow } from '../../domain/settleCycle'
import {
  appendHu,
  endSession,
  getSession,
  liuju,
  undoLastHu,
  type SessionDoc,
  type SessionSeat,
} from '../../services/sessionApi'

const BASIC_FANS = [
  { id: 'pinghu', label: '平胡' },
  { id: 'duidui', label: '对对胡' },
  { id: 'qingyise', label: '清一色' },
]

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
    dealerNickname: '',
    streak: 0,
    mult: 2,
    cycleIndex: 0,
    handIndex: 0,
    seats: [] as ReturnType<typeof buildViewSeats>,
    canUndo: false,
    // inline hu panel
    showHuSheet: false,
    winnerId: '',
    winnerNickname: '',
    winType: 'zimo' as 'zimo' | 'dianpao',
    dianpaoId: '',
    basicFan: 'pinghu',
    basicFans: BASIC_FANS,
    payerOptions: [] as { playerId: string; nickname: string }[],
    // cycle settle
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

    this.setData({
      loading: false,
      roomCode: doc.roomCode,
      dealerNickname: dealerSeat?.nickname || (dealerId ? '—' : '未开局'),
      streak,
      mult: dealer ? dealerMult(streak) : 0,
      cycleIndex: doc.currentCycle?.index ?? doc.cycles.length,
      handIndex: hand?.index ?? 0,
      seats: buildViewSeats(doc.seats, dealerId),
      canUndo: canUndoFrom(doc),
      showSettle: Boolean(settleRows && settleRows.length),
      settlements: (settleRows || []).map((r) => ({
        ...r,
        nickname: nickMap[r.playerId] || r.playerId,
      })),
    })
  },

  /** Hook for Task 12 hu-sheet; opens minimal inline panel for now. */
  selectSeat(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy || this.data.showSettle) return
    const playerId = String(e.currentTarget.dataset.id || '')
    const hasHu = e.currentTarget.dataset.hashu === true || e.currentTarget.dataset.hashu === 'true'
    if (!playerId || hasHu) return

    const seat = this.data.seats.find((s) => s.playerId === playerId)
    if (!seat || seat.hasHu) return

    const payerOptions = this.data.seats
      .filter((s) => s.playerId !== playerId && !s.hasHu)
      .map((s) => ({ playerId: s.playerId, nickname: s.nickname }))

    this.setData({
      showHuSheet: true,
      winnerId: playerId,
      winnerNickname: seat.nickname,
      winType: 'zimo',
      dianpaoId: '',
      basicFan: 'pinghu',
      payerOptions,
    })
  },

  closeHuSheet() {
    this.setData({
      showHuSheet: false,
      winnerId: '',
      winnerNickname: '',
      dianpaoId: '',
    })
  },

  onWinType(e: WechatMiniprogram.TouchEvent) {
    const winType = String(e.currentTarget.dataset.type) as 'zimo' | 'dianpao'
    this.setData({
      winType,
      dianpaoId: winType === 'zimo' ? '' : this.data.dianpaoId,
    })
  },

  onBasicFan(e: WechatMiniprogram.TouchEvent) {
    const basicFan = String(e.currentTarget.dataset.id || 'pinghu')
    this.setData({ basicFan })
  },

  onDianpaoPick(e: WechatMiniprogram.TouchEvent) {
    const dianpaoId = String(e.currentTarget.dataset.id || '')
    this.setData({ dianpaoId })
  },

  async onConfirmHu() {
    if (this.data.busy) return
    const { sessionId, winnerId, winType, dianpaoId, basicFan } = this.data
    if (!winnerId) return
    if (winType === 'dianpao' && !dianpaoId) {
      wx.showToast({ title: '请选择点炮者', icon: 'none' })
      return
    }

    this.setData({ busy: true })
    try {
      const result = await appendHu(sessionId, {
        winnerId,
        winType,
        dianpaoId: winType === 'dianpao' ? dianpaoId : undefined,
        basicFan,
        extras: [],
        genCount: 0,
        mingGang: 0,
        anGang: 0,
      })
      this.setData({ showHuSheet: false, winnerId: '', busy: false })
      if (result.cycleOver) {
        const doc = await getSession(sessionId)
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

  async onLiuju() {
    if (this.data.busy || this.data.showSettle) return
    const { sessionId } = this.data
    const ok = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '确认流局？',
        content: '无人胡牌，庄与连庄不变，开下一局',
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
    if (this.data.busy || this.data.showSettle || !this.data.canUndo) return
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

  noop() {},
})
