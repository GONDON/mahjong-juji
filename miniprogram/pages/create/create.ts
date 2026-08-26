// @ts-nocheck
import { createSession } from '../../services/sessionApi'

const CHIP_OPTIONS = [1, 2, 3, 4, 5]

Page({
  data: {
    chipOptions: CHIP_OPTIONS,
    chipValueYuan: 1,
    nicknames: ['', '', '', ''],
    submitting: false,
  },

  onChipTap(e: WechatMiniprogram.TouchEvent) {
    const value = Number(e.currentTarget.dataset.value)
    if (!CHIP_OPTIONS.includes(value)) return
    this.setData({ chipValueYuan: value })
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
