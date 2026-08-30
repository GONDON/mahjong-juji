// @ts-nocheck
import { readHouseRules } from '../../domain/houseRules'
import { scoreHu } from '../../domain/scoreHu'
import type {
  BasicFan,
  ExtraFan,
  HuInput,
  Seat,
  TableState,
  WinType,
} from '../../domain/types'

const BASIC_FANS: { id: BasicFan; label: string }[] = [
  { id: 'pinghu', label: '平胡' },
  { id: 'duidui', label: '对对胡' },
  { id: 'qingyise', label: '清一色' },
  { id: 'qidui', label: '七对' },
  { id: 'longqidui', label: '龙七对' },
  { id: 'jingougou', label: '金钩钩' },
  { id: 'qingdui', label: '清对' },
  { id: 'qingqidui', label: '清七对' },
  { id: 'qinglongqidui', label: '清龙七对' },
  { id: 'qingjingougou', label: '清金钩钩' },
]

const EXTRA_TOGGLES: { id: ExtraFan; label: string }[] = [
  { id: 'gangshanghua', label: '杠上花' },
  { id: 'gangshangpao', label: '杠上炮' },
  { id: 'qianggang', label: '抢杠' },
  { id: 'haidi', label: '海底' },
  { id: 'menqing', label: '门清' },
  { id: 'zhongzhang', label: '中张' },
  { id: 'daiyaojiu', label: '带幺九' },
  { id: 'jiangdui', label: '将对' },
  { id: 'tianhu', label: '天胡' },
  { id: 'dihu', label: '地胡' },
]

function emptyForm() {
  return {
    winType: 'zimo' as WinType,
    dianpaoId: '',
    basicFan: 'pinghu' as BasicFan,
    extrasOn: {
      gangshanghua: false,
      gangshangpao: false,
      qianggang: false,
      haidi: false,
      menqing: false,
      zhongzhang: false,
      daiyaojiu: false,
      jiangdui: false,
      tianhu: false,
      dihu: false,
    },
    genCount: 0,
    mingGang: 0,
    anGang: 0,
  }
}

Component({
  properties: {
    visible: { type: Boolean, value: false },
    winnerId: { type: String, value: '' },
    seats: { type: Array, value: [] },
    dealerId: { type: String, value: '' },
    streak: { type: Number, value: 0 },
    houseRules: { type: Object, value: { zimoFan: 'none' } },
  },

  data: {
    ...emptyForm(),
    basicFans: BASIC_FANS,
    extraToggles: EXTRA_TOGGLES.map((t) => ({ ...t, on: false })),
    winnerNickname: '',
    payerOptions: [] as { playerId: string; nickname: string }[],
    canConfirm: false,
    previewPerPayer: 0,
    previewFanPart: 0,
    previewGangPart: 0,
    previewDealerMult: 1,
    previewZimoMult: 1,
    previewLines: [] as { from: string; to: string; chips: number }[],
    previewHint: '',
  },

  observers: {
    visible(v: boolean) {
      if (v) {
        this.resetAndRefresh()
      }
    },
    'winnerId, seats, dealerId, streak, houseRules'() {
      if (this.data.visible) {
        this.refreshDerived()
        this.refreshPreview()
      }
    },
  },

  methods: {
    syncExtraToggles() {
      const { extrasOn } = this.data
      this.setData({
        extraToggles: EXTRA_TOGGLES.map((t) => ({
          ...t,
          on: Boolean(extrasOn[t.id]),
        })),
      })
    },

    resetAndRefresh() {
      this.setData({
        ...emptyForm(),
        extraToggles: EXTRA_TOGGLES.map((t) => ({ ...t, on: false })),
      })
      this.refreshDerived()
      this.refreshPreview()
    },

    refreshDerived() {
      const seats = (this.properties.seats || []) as Seat[]
      const winnerId = this.properties.winnerId as string
      const winner = seats.find((s) => s.playerId === winnerId)
      const payerOptions = seats
        .filter((s) => s.playerId !== winnerId && !s.hasHu)
        .map((s) => ({ playerId: s.playerId, nickname: s.nickname }))
      this.setData({
        winnerNickname: winner?.nickname || '',
        payerOptions,
      })
      this.updateCanConfirm()
    },

    updateCanConfirm() {
      const { winType, dianpaoId } = this.data
      const winnerId = this.properties.winnerId as string
      const canConfirm = Boolean(
        winnerId && (winType !== 'dianpao' || dianpaoId),
      )
      this.setData({ canConfirm })
    },

    buildInput(): HuInput | null {
      const winnerId = this.properties.winnerId as string
      if (!winnerId) return null
      const { winType, dianpaoId, basicFan, extrasOn, genCount, mingGang, anGang } =
        this.data
      if (winType === 'dianpao' && !dianpaoId) return null

      const extras: ExtraFan[] = EXTRA_TOGGLES.filter((t) => extrasOn[t.id]).map(
        (t) => t.id,
      )

      return {
        winnerId,
        winType,
        dianpaoId: winType === 'dianpao' ? dianpaoId : undefined,
        basicFan,
        extras,
        genCount,
        mingGang,
        anGang,
      }
    },

    buildTable(): TableState {
      const seats = (this.properties.seats || []) as Seat[]
      return {
        seats: seats.map((s) => ({
          playerId: s.playerId,
          nickname: s.nickname,
          chips: s.chips,
          hasHu: s.hasHu,
        })),
        dealer: {
          dealerId: this.properties.dealerId as string,
          streak: Number(this.properties.streak) || 0,
        },
        firstHuId: null,
      }
    },

    nickMap(): Record<string, string> {
      const seats = (this.properties.seats || []) as Seat[]
      return Object.fromEntries(seats.map((s) => [s.playerId, s.nickname]))
    },

    refreshPreview() {
      this.updateCanConfirm()
      const input = this.buildInput()
      if (!input) {
        this.setData({
          previewPerPayer: 0,
          previewFanPart: 0,
          previewGangPart: 0,
          previewDealerMult: 1,
          previewZimoMult: 1,
          previewLines: [],
          previewHint:
            this.data.winType === 'dianpao' ? '请选择点炮者后预览' : '',
        })
        return
      }

      try {
        const houseRules = readHouseRules(this.properties.houseRules)
        const result = scoreHu(this.buildTable(), input, houseRules)
        const nicks = this.nickMap()
        const previewZimoMult =
          input.winType === 'zimo' && houseRules.zimoFan === 'plusOne' ? 2 : 1
        this.setData({
          previewPerPayer: result.perPayer,
          previewFanPart: result.fanPart,
          previewGangPart: result.gangPart,
          previewDealerMult: result.dealerMult,
          previewZimoMult,
          previewLines: result.transfers.map((t) => ({
            from: nicks[t.fromId] || t.fromId,
            to: nicks[t.toId] || t.toId,
            chips: t.chips,
          })),
          previewHint: '',
        })
      } catch (err) {
        console.error(err)
        this.setData({
          previewPerPayer: 0,
          previewFanPart: 0,
          previewGangPart: 0,
          previewDealerMult: 1,
          previewZimoMult: 1,
          previewLines: [],
          previewHint: '预览失败',
        })
      }
    },

    onCancel() {
      this.triggerEvent('cancel')
    },

    onWinType(e: WechatMiniprogram.TouchEvent) {
      const winType = String(e.currentTarget.dataset.type) as WinType
      this.setData({
        winType,
        dianpaoId: winType === 'zimo' ? '' : this.data.dianpaoId,
      })
      this.refreshPreview()
    },

    onDianpaoPick(e: WechatMiniprogram.TouchEvent) {
      const dianpaoId = String(e.currentTarget.dataset.id || '')
      this.setData({ dianpaoId })
      this.refreshPreview()
    },

    onBasicFan(e: WechatMiniprogram.TouchEvent) {
      const basicFan = String(e.currentTarget.dataset.id || 'pinghu') as BasicFan
      this.setData({ basicFan })
      this.refreshPreview()
    },

    onExtraToggle(e: WechatMiniprogram.TouchEvent) {
      const id = String(e.currentTarget.dataset.id || '') as ExtraFan
      if (!id) return
      const key = `extrasOn.${id}`
      this.setData({ [key]: !this.data.extrasOn[id] })
      this.syncExtraToggles()
      this.refreshPreview()
    },

    onStep(e: WechatMiniprogram.TouchEvent) {
      const field = String(e.currentTarget.dataset.field || '')
      const delta = Number(e.currentTarget.dataset.delta) || 0
      if (!['genCount', 'mingGang', 'anGang'].includes(field)) return
      const next = Math.max(0, (this.data[field] as number) + delta)
      this.setData({ [field]: next })
      this.refreshPreview()
    },

    onConfirm() {
      if (!this.data.canConfirm) return
      const input = this.buildInput()
      if (!input) return
      this.triggerEvent('confirm', input)
    },

    noop() {},
  },
})
