// @ts-nocheck
import {
  CHARACTER_STORAGE_KEY,
  avatarSrc,
  isCharacterComplete,
  preferLocalCharacter,
  type CharacterCard,
} from '../../domain/character'
import { DEFAULT_HOUSE_RULES } from '../../domain/houseRules'
import {
  DEFAULT_STARTING_CHIPS,
  STARTING_CHIPS_MAX,
  STARTING_CHIPS_MIN,
  stepStartingChips,
} from '../../domain/startingChips'
import { tablePathFor } from '../../domain/sessionRoute'
import {
  createSession,
  enterSession,
  getCharacter,
  getSessionByRoomCode,
  listMySessions,
  upsertCharacter,
} from '../../services/sessionApi'
import {
  CHIP_OPTIONS,
  DEFAULT_SEAT_NICKNAMES,
  HOME_FETCH_LIMIT,
  canSubmitJoin,
  normalizeJoinCode,
  presentJoinField,
  presentRecentCampaign,
  selectChipValue,
  sessionDetailRoute,
  sessionRoute,
  sliceHomeRecents,
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

Page({
  data: {
    chipOptions: CHIP_OPTIONS,
    chipValueYuan: 1,
    startingChips: DEFAULT_STARTING_CHIPS,
    zimoFan: DEFAULT_HOUSE_RULES.zimoFan,
    canDecStarting: DEFAULT_STARTING_CHIPS > STARTING_CHIPS_MIN,
    canIncStarting: DEFAULT_STARTING_CHIPS < STARTING_CHIPS_MAX,
    ...presentJoinField(''),
    joinEpoch: 0,
    joining: false,
    creating: false,
    campaigns: [] as RecentCampaign[],
    recents: [] as ReturnType<typeof presentRecentCampaign>[],
    hasMore: false,
    recentsReady: false,
    hasProfile: false,
    profileSrc: '',
  },

  onShow() {
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

  onZimoFanTap(e: WechatMiniprogram.TouchEvent) {
    const zimoFan = String(e.currentTarget.dataset.value)
    if (zimoFan !== 'none' && zimoFan !== 'plusOne') return
    this.setData({ zimoFan })
  },

  onStartingStep(e: WechatMiniprogram.TouchEvent) {
    const dir = Number(e.currentTarget.dataset.dir)
    if (dir !== 1 && dir !== -1) return
    const startingChips = stepStartingChips(this.data.startingChips, dir)
    this.setData({
      startingChips,
      canDecStarting: startingChips > STARTING_CHIPS_MIN,
      canIncStarting: startingChips < STARTING_CHIPS_MAX,
    })
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
      const { sessionId } = await createSession({
        chipValueYuan: this.data.chipValueYuan,
        startingChips: this.data.startingChips,
        houseRules: { zimoFan: this.data.zimoFan },
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

  onSeeAllTap() {
    wx.navigateTo({ url: '/pages/history/history' })
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

  async refreshRecents() {
    try {
      const list = await listMySessions({ limit: HOME_FETCH_LIMIT })
      this.paintRecents(list)
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      if (!this.data.recentsReady) {
        this.setData({ recentsReady: true, hasMore: false })
      }
    }
  },

  paintRecents(list: RecentCampaign[]) {
    const { recents, hasMore } = sliceHomeRecents(list)
    this.setData({
      campaigns: recents,
      recents: recents.map((item) => presentRecentCampaign(item)),
      hasMore,
      recentsReady: true,
    })
  },
})
