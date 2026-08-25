// @ts-nocheck
import {
  CHARACTER_STORAGE_KEY,
  SELECTABLE_AVATAR_IDS,
  avatarSrc,
  isCharacterComplete,
  preferLocalCharacter,
  validateCharacter,
  type CharacterCard,
} from '../../domain/character'
import {
  getCharacter,
  upsertCharacter,
  whoami,
} from '../../services/sessionApi'

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

function paintCard(
  page: WechatMiniprogram.Page.Instance<any, any>,
  card: CharacterCard | null,
) {
  if (!card) return
  page.setData({
    nickname: card.nickname || '',
    avatarId: card.avatarId || '',
    openId: card.openId || page.data.openId,
  })
}

Page({
  data: {
    sessionId: '',
    openId: '',
    nickname: '',
    avatarId: '',
    saving: false,
    avatarOptions: SELECTABLE_AVATAR_IDS.map((id) => ({
      id,
      src: avatarSrc(id),
    })),
  },

  onLoad(query: Record<string, string | undefined>) {
    const sessionId = String(query.sessionId || '')
    this.setData({ sessionId })
  },

  onShow() {
    const local = readLocalCard()
    paintCard(this, local)
    getCharacter()
      .then(async (cloud) => {
        const { card, shouldRetryUpsert } = preferLocalCharacter(local, cloud)
        if (!card) return
        writeLocalCard(card)
        paintCard(this, card)
        if (shouldRetryUpsert && isCharacterComplete(card)) {
          try {
            await upsertCharacter({
              nickname: card.nickname,
              avatarId: card.avatarId,
              sessionId: this.data.sessionId || undefined,
            })
          } catch (err) {
            console.error(err)
          }
        }
      })
      .catch((err) => {
        console.error(err)
      })
  },

  onAvatarTap(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return
    this.setData({ avatarId: id })
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: String(e.detail.value ?? '') })
  },

  async onSave() {
    if (this.data.saving) return

    const validated = validateCharacter(this.data.nickname, this.data.avatarId)
    if (!validated.ok) {
      wx.showToast({ title: validated.message, icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      let openId = this.data.openId
      if (!openId) {
        const me = await whoami()
        openId = me.openId
        this.setData({ openId })
      }

      const localCard: CharacterCard = {
        openId,
        nickname: validated.nickname,
        avatarId: validated.avatarId,
        updatedAt: Date.now(),
      }
      writeLocalCard(localCard)

      const sessionId = this.data.sessionId || undefined
      const card = await upsertCharacter({
        nickname: validated.nickname,
        avatarId: validated.avatarId,
        sessionId,
      })
      writeLocalCard(card)
      this.setData({
        nickname: card.nickname,
        avatarId: card.avatarId,
        openId: card.openId,
      })
      wx.showToast({ title: '已保存', icon: 'success' })
      if (sessionId) {
        wx.navigateBack()
      }
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '保存失败，稍后重试', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },
})
