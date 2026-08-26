// @ts-nocheck
import {
  CHARACTER_STORAGE_KEY,
  avatarSrc,
  isCharacterComplete,
  preferLocalCharacter,
  type CharacterCard,
} from '../../domain/character'
import { tablePathFor } from '../../domain/sessionRoute'
import {
  createSession,
  enterSession,
  getCharacter,
  getSession,
  getSessionByRoomCode,
  upsertCharacter,
  type SessionDoc,
} from '../../services/sessionApi'
import {
  CHIP_OPTIONS,
  DEFAULT_SEAT_NICKNAMES,
  RECENT_STORAGE_KEY,
  canSubmitJoin,
  clampRecentSwipe,
  normalizeJoinCode,
  parseStoredCampaigns,
  presentJoinField,
  presentRecentCampaign,
  removeRecentCampaign,
  selectChipValue,
  sessionDetailRoute,
  sessionRoute,
  snapRecentSwipe,
  upsertRecentCampaign,
  type RecentCampaign,
} from './indexState'

function readLocalCard(): CharacterCard | null {
  try {
    const raw = wx.getStorageSync(CHARACTER_STORAGE_KEY)
    return raw && raw.avatarId ? raw : null
  } catch {
    return null
  }
}

function writeLocalCard(card: CharacterCard) {
  wx.setStorageSync(CHARACTER_STORAGE_KEY, card)
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
    chipOptions: CHIP_OPTIONS,
    chipValueYuan: 1,
    ...presentJoinField(''),
    joinEpoch: 0,
    joining: false,
    creating: false,
    campaigns: [] as RecentCampaign[],
    recents: [] as Array<
      ReturnType<typeof presentRecentCampaign> & { offsetX: number }
    >,
    hasProfile: false,
    profileSrc: '',
    lockingScroll: false,
  },

  _offsets: {} as Record<string, number>,
  _swipe: null as null | {
    id: string
    startX: number
    startY: number
    startOffset: number
    tracking: boolean | null
  },
  _ignoreTap: false,

  onShow() {
    this._offsets = this._offsets || {}
    this.refreshProfile()
    this.refreshRecents()
  },

  onChipTap(e: WechatMiniprogram.TouchEvent) {
    const next = selectChipValue(
      Number(e.currentTarget.dataset.value),
      this.data.chipValueYuan,
    )
    this.setData({ chipValueYuan: next })
  },

  onJoinCodeFocus() {
    this.setData(presentJoinField(this.data.joinCode, true))
  },

  onJoinCodeBlur() {
    this.setData(presentJoinField(this.data.joinCode, false))
  },

  onJoinCodeInput(e: WechatMiniprogram.Input) {
    const joinCode = normalizeJoinCode(String(e.detail.value ?? ''))
    this.setData(presentJoinField(joinCode, true))
    return { value: joinCode, cursor: joinCode.length }
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
      try {
        await enterSession({ sessionId })
      } catch (err) {
        // createSession already inserts the creator into members; do not abort.
        console.error(err)
      }
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
      try {
        await enterSession({ sessionId: doc.sessionId })
      } catch (err) {
        console.error(err)
        wx.showToast({ title: '加入失败', icon: 'none' })
        return
      }
      this.remember(campaignFromDoc(doc))
      this.setData({
        ...presentJoinField(''),
        joinEpoch: this.data.joinEpoch + 1,
      })
      wx.navigateTo({
        url: tablePathFor(doc.status, doc.sessionId),
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加入失败', icon: 'none' })
    } finally {
      this.setData({ joining: false })
    }
  },

  findCampaign(sessionId: string): RecentCampaign | undefined {
    return this.data.campaigns.find(
      (item: RecentCampaign) => item.sessionId === sessionId,
    )
  },

  onRecentTap(e: WechatMiniprogram.TouchEvent) {
    if (this._ignoreTap) {
      this._ignoreTap = false
      return
    }
    const sessionId = String(e.currentTarget.dataset.id || '')
    if ((this._offsets[sessionId] || 0) !== 0) {
      this.setSwipeOffset(sessionId, 0)
      return
    }
    const campaign = this.findCampaign(sessionId)
    if (!campaign) return
    wx.navigateTo({ url: sessionDetailRoute(campaign) })
  },

  onReenterTap(e: WechatMiniprogram.TouchEvent) {
    if (this._ignoreTap) {
      this._ignoreTap = false
      return
    }
    const sessionId = String(e.currentTarget.dataset.id || '')
    const campaign = this.findCampaign(sessionId)
    if (!campaign) return
    wx.navigateTo({ url: sessionRoute(campaign) })
  },

  onRecentDelete(e: WechatMiniprogram.TouchEvent) {
    const sessionId = String(e.currentTarget.dataset.id || '')
    const campaigns = removeRecentCampaign(this.data.campaigns, sessionId)
    delete this._offsets[sessionId]
    try {
      wx.setStorageSync(RECENT_STORAGE_KEY, campaigns)
    } catch (err) {
      console.error(err)
    }
    this.paintRecents(campaigns)
  },

  onRecentTouchStart(e: WechatMiniprogram.TouchEvent) {
    const t = e.changedTouches[0]
    const id = String(e.currentTarget.dataset.id || '')
    const openId = Object.keys(this._offsets).find(
      (key) => key !== id && (this._offsets[key] || 0) !== 0,
    )
    if (openId) this.setSwipeOffset(openId, 0)
    this._swipe = {
      id,
      startX: t.clientX,
      startY: t.clientY,
      startOffset: this._offsets[id] || 0,
      tracking: null,
    }
  },

  onRecentTouchMove(e: WechatMiniprogram.TouchEvent) {
    const swipe = this._swipe
    if (!swipe) return
    const t = e.changedTouches[0]
    const dx = t.clientX - swipe.startX
    const dy = t.clientY - swipe.startY
    if (swipe.tracking === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      swipe.tracking = Math.abs(dx) > Math.abs(dy)
      if (swipe.tracking) this.setData({ lockingScroll: true })
    }
    if (!swipe.tracking) return
    this.setSwipeOffset(swipe.id, clampRecentSwipe(swipe.startOffset + dx))
  },

  onRecentTouchEnd() {
    const swipe = this._swipe
    this._swipe = null
    if (this.data.lockingScroll) this.setData({ lockingScroll: false })
    if (!swipe || !swipe.tracking) return
    this._ignoreTap = true
    this.setSwipeOffset(swipe.id, snapRecentSwipe(this._offsets[swipe.id] || 0))
    setTimeout(() => {
      this._ignoreTap = false
    }, 80)
  },

  setSwipeOffset(sessionId: string, offsetX: number) {
    const offsets: Record<string, number> = { [sessionId]: offsetX }
    this._offsets = offsets
    this.setData({
      recents: this.data.recents.map(
        (item: { sessionId: string; offsetX: number }) => ({
          ...item,
          offsetX: item.sessionId === sessionId ? offsetX : 0,
        }),
      ),
    })
  },

  onRankTap() {
    wx.navigateTo({ url: '/pages/rank/rank' })
  },

  onProfileTap() {
    wx.navigateTo({ url: '/pages/profile/profile' })
  },

  paintProfile(card: CharacterCard | null) {
    const hasProfile = isCharacterComplete(card)
    this.setData({
      hasProfile,
      profileSrc: hasProfile && card ? avatarSrc(card.avatarId) : '',
    })
  },

  async refreshProfile() {
    const local = readLocalCard()
    this.paintProfile(local)
    try {
      const cloud = await getCharacter()
      const { card, shouldRetryUpsert } = preferLocalCharacter(local, cloud)
      if (card) {
        writeLocalCard(card)
        this.paintProfile(card)
        if (shouldRetryUpsert && isCharacterComplete(card)) {
          try {
            await upsertCharacter({
              nickname: card.nickname,
              avatarId: card.avatarId,
            })
          } catch (err) {
            console.error(err)
          }
        }
      } else {
        this.paintProfile(null)
      }
    } catch (err) {
      console.error(err)
    }
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
      recents: campaigns.map((item) => ({
        ...presentRecentCampaign(item, now),
        offsetX: this._offsets[item.sessionId] || 0,
      })),
    })
  },
})
