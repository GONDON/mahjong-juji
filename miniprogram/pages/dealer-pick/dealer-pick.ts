// @ts-nocheck
import {
  CHARACTER_STORAGE_KEY,
  avatarSrc,
  isCharacterComplete,
  type CharacterCard,
} from '../../domain/character'
import { canMutateSeats } from '../../domain/presence'
import {
  sessionFollowDecision,
  type TablePage,
} from '../../domain/sessionRoute'
import { subscribeSession } from '../../services/sessionLive'
import {
  claimSeat,
  scorerRenameSeat,
  scorerUnclaimSeat,
  startCycle,
  unclaimSeat,
  whoami,
  type SessionDoc,
  type SessionSeat,
} from '../../services/sessionApi'

function readLocalCard(): CharacterCard | null {
  try {
    const raw = wx.getStorageSync(CHARACTER_STORAGE_KEY)
    return raw && raw.avatarId ? raw : null
  } catch {
    return null
  }
}

function seatErrorToast(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || '')
  if (msg.includes('seat occupied')) return '座位已被占'
  if (msg.includes('character incomplete')) return '请先设置角色卡'
  if (msg.includes('session not open')) return '当前不能占座'
  return '加入失败'
}

function mapSeats(seats: SessionSeat[]) {
  return seats.map((s) => ({
    playerId: s.playerId,
    nickname: s.nickname,
    claimedOpenId: s.claimedOpenId || '',
    faceSrc: avatarSrc(s.avatarId || 'avatar_00'),
  }))
}

function mapMembers(doc: SessionDoc) {
  const claimed = new Set(
    (doc.seats || [])
      .map((s) => s.claimedOpenId)
      .filter((id): id is string => Boolean(id)),
  )
  return (doc.members || []).map((m) => ({
    openId: m.openId,
    nickname: m.nickname,
    src: avatarSrc(m.avatarId || 'avatar_00'),
    seated: claimed.has(m.openId),
  }))
}

function resolveIsScorer(myOpenId: string, doc: SessionDoc): boolean {
  return myOpenId === doc.scorerOpenId || myOpenId === doc.scorerId
}

Page({
  data: {
    sessionId: '',
    roomCode: '',
    status: '',
    seats: [] as {
      playerId: string
      nickname: string
      claimedOpenId: string
      faceSrc: string
    }[],
    members: [] as {
      openId: string
      nickname: string
      src: string
      seated: boolean
    }[],
    selectedId: '',
    confirming: false,
    busy: false,
    loading: true,
    myOpenId: '',
    isScorer: false,
  },

  _live: null as { stop: () => void } | null,
  _page: 'dealer-pick' as TablePage,

  async onLoad(query: Record<string, string | undefined>) {
    const sessionId = query.sessionId ? decodeURIComponent(query.sessionId) : ''
    if (!sessionId) {
      wx.showToast({ title: '缺少 sessionId', icon: 'none' })
      this.setData({ loading: false })
      return
    }
    this.setData({ sessionId })
  },

  async onShow() {
    if (!this.data.sessionId) return
    try {
      const me = await whoami()
      this.setData({ myOpenId: me.openId })
    } catch (err) {
      console.error(err)
    }
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
    if (!sessionId) return
    this._live = subscribeSession({
      sessionId,
      page: this._page,
      onDoc: (doc) => {
        this.applyDoc(doc, this.data.myOpenId)
      },
      onNavigate: (url) => {
        wx.redirectTo({ url })
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

  applyDoc(doc: SessionDoc, myOpenId: string) {
    this.setData({
      roomCode: doc.roomCode,
      status: doc.status,
      seats: mapSeats(doc.seats),
      members: mapMembers(doc),
      myOpenId,
      isScorer: resolveIsScorer(myOpenId, doc),
      loading: false,
    })
  },

  onSelectDealer(e: WechatMiniprogram.TouchEvent) {
    if (!this.data.isScorer) return
    const playerId = String(e.currentTarget.dataset.id || '')
    if (!playerId) return
    this.setData({ selectedId: playerId })
  },

  async onSeatFaceTap(e: WechatMiniprogram.TouchEvent) {
    if (this.data.busy) return
    const playerId = String(e.currentTarget.dataset.id || '')
    if (!playerId) return

    const seat = this.data.seats.find((s) => s.playerId === playerId)
    if (!seat) return

    const { sessionId } = this.data
    let myOpenId = this.data.myOpenId
    try {
      const me = await whoami()
      myOpenId = me.openId
      if (myOpenId !== this.data.myOpenId) {
        this.setData({ myOpenId })
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加入失败', icon: 'none' })
      return
    }

    if (!isCharacterComplete(readLocalCard())) {
      wx.navigateTo({
        url: `/pages/profile/profile?sessionId=${encodeURIComponent(sessionId)}`,
      })
      return
    }

    if (!canMutateSeats(this.data.status)) {
      wx.showToast({ title: '当前不能占座', icon: 'none' })
      return
    }

    const claimed = seat.claimedOpenId
    const isScorer = this.data.isScorer

    if (!claimed) {
      if (isScorer) {
        await this.onScorerEmptySeat(playerId)
      } else {
        await this.runSeatMutation(() => claimSeat(sessionId, playerId))
      }
      return
    }

    if (claimed === myOpenId) {
      await this.runSeatMutation(() => unclaimSeat(sessionId, playerId))
      return
    }

    if (!isScorer) {
      wx.showToast({ title: '座位已被占', icon: 'none' })
      return
    }

    const { confirm } = await wx.showModal({
      title: '请离座位',
      content: '把这个座位空出来？',
    })
    if (!confirm) return
    await this.runSeatMutation(() => scorerUnclaimSeat(sessionId, playerId))
  },

  async onScorerEmptySeat(playerId: string) {
    let tapIndex: number
    try {
      const res = await wx.showActionSheet({
        itemList: ['入座', '改代填名'],
      })
      tapIndex = res.tapIndex
    } catch {
      return
    }

    const { sessionId } = this.data
    if (tapIndex === 0) {
      await this.runSeatMutation(() => claimSeat(sessionId, playerId))
      return
    }
    if (tapIndex !== 1) return

    const seat = this.data.seats.find((s) => s.playerId === playerId)
    const modal = await wx.showModal({
      title: '改代填名',
      editable: true,
      placeholderText: '1–12 字',
      content: seat?.nickname || '',
    })
    if (!modal.confirm) return
    const nickname = String(modal.content || '').trim()
    if (!nickname) {
      wx.showToast({ title: '请填写牌桌名', icon: 'none' })
      return
    }
    await this.runSeatMutation(() =>
      scorerRenameSeat(sessionId, playerId, nickname),
    )
  },

  async runSeatMutation(fn: () => Promise<SessionDoc>) {
    if (this.data.busy) return
    this.setData({ busy: true })
    try {
      const doc = await fn()
      this.applyDoc(doc, this.data.myOpenId)
    } catch (err) {
      console.error(err)
      wx.showToast({ title: seatErrorToast(err), icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
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
      const next = sessionFollowDecision(this._page, 'playing', sessionId)
      if (next.action === 'redirect') {
        wx.redirectTo({ url: next.url })
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '开局失败', icon: 'none' })
      this.setData({ confirming: false })
    }
  },
})
