// @ts-nocheck
import { DEFAULT_HOUSE_RULES } from '../../domain/houseRules'
import {
  DEFAULT_STARTING_CHIPS,
  STARTING_CHIPS_MAX,
  STARTING_CHIPS_MIN,
  stepStartingChips,
} from '../../domain/startingChips'
import { createSession } from '../../services/sessionApi'

const CHIP_OPTIONS = [1, 2, 3, 4, 5]

Page({
  data: {
    chipOptions: CHIP_OPTIONS,
    chipValueYuan: 1,
    startingChips: DEFAULT_STARTING_CHIPS,
    zimoFan: DEFAULT_HOUSE_RULES.zimoFan,
    canDecStarting: DEFAULT_STARTING_CHIPS > STARTING_CHIPS_MIN,
    canIncStarting: DEFAULT_STARTING_CHIPS < STARTING_CHIPS_MAX,
    nicknames: ['', '', '', ''],
    submitting: false,
  },

  onChipTap(e: WechatMiniprogram.TouchEvent) {
    const value = Number(e.currentTarget.dataset.value)
    if (!CHIP_OPTIONS.includes(value)) return
    this.setData({ chipValueYuan: value })
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

  onNicknameInput(e: WechatMiniprogram.Input) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index) || index < 0 || index > 3) return
    const nicknames = [...this.data.nicknames] as [string, string, string, string]
    nicknames[index] = String(e.detail.value ?? '')
    this.setData({ nicknames })
  },

  async onSubmit() {
    if (this.data.submitting) return

    const nicknames = this.data.nicknames.map((n: string) => n.trim()) as [
      string,
      string,
      string,
      string,
    ]
    const empty = nicknames.findIndex((n) => !n)
    if (empty >= 0) {
      wx.showToast({ title: `请填写座位${empty + 1}昵称`, icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    try {
      const { sessionId } = await createSession({
        chipValueYuan: this.data.chipValueYuan,
        startingChips: this.data.startingChips,
        houseRules: { zimoFan: this.data.zimoFan },
        nicknames,
      })
      wx.navigateTo({
        url: `/pages/dealer-pick/dealer-pick?sessionId=${encodeURIComponent(sessionId)}`,
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '开房失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },
})
