import { avatarSrc } from '../../domain/character'
import type { BasicFan } from '../../domain/types'
import type { SessionDoc, SessionStatus } from '../../services/sessionApi'

export const STATUS_LABEL: Record<SessionStatus, string> = {
  open: '未开局',
  playing: '进行中',
  settling: '待结算',
  ended: '已结束',
}

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

export type SessionSettleView = {
  playerId: string
  nickname: string
  faceSrc: string
  chipDelta: number
  yuan: number
  chipLabel: string
  yuanLabel: string
  yuanClass: 'up' | 'down' | ''
}

export type SessionHuView = {
  winner: string
  winType: string
  fan: string
  perPayer: number
  line: string
  payLabel: string
}

export type SessionHandView = {
  index: number
  liuju: boolean
  dealer: string
  streak: number
  title: string
  hus: SessionHuView[]
}

export type SessionCycleView = {
  index: number
  expanded: boolean
  settlements: SessionSettleView[]
  hands: SessionHandView[]
}

export type SessionDetailView = {
  roomCode: string
  chipValueYuan: number
  status: SessionStatus | ''
  statusLabel: string
  ended: boolean
  canEnd: boolean
  cycles: SessionCycleView[]
}

export type SessionExpandState = Set<number> | 'latest'

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

function nickMap(doc: SessionDoc): Record<string, string> {
  const m: Record<string, string> = {}
  for (const s of doc.seats) m[s.playerId] = s.nickname
  return m
}

function faceMap(doc: SessionDoc): Record<string, string> {
  const m: Record<string, string> = {}
  for (const s of doc.seats) m[s.playerId] = avatarSrc(s.avatarId || 'avatar_00')
  return m
}

function buildCycles(
  doc: SessionDoc,
  expanded: SessionExpandState,
): SessionCycleView[] {
  const nicks = nickMap(doc)
  const faces = faceMap(doc)
  const lastIndex = doc.cycles[doc.cycles.length - 1]?.index
  return doc.cycles.map((c) => {
    const hands = doc.hands.filter((h) => h.cycleIndex === c.index)
    const handIndexes = new Set(hands.map((h) => h.index))
    const huEvents = doc.huEvents
      .filter((e) => handIndexes.has(e.handIndex))
      .map((e) => {
        const winner = nicks[e.input.winnerId] || e.input.winnerId
        const winType = e.input.winType === 'zimo' ? '自摸' : '点炮'
        const fan = BASIC_FAN_LABEL[e.input.basicFan] || e.input.basicFan
        return {
          handIndex: e.handIndex,
          winner,
          winType,
          fan,
          perPayer: e.score.perPayer,
          line: `${winner} ${winType} ${fan}`,
          payLabel: `每人付 ${e.score.perPayer} 牌`,
        }
      })
    const handSummaries: SessionHandView[] = hands.map((h) => {
      const hus = huEvents.filter((e) => e.handIndex === h.index)
      const dealer = nicks[h.dealerId] || h.dealerId
      return {
        index: h.index,
        liuju: h.liuju,
        dealer,
        streak: h.streak,
        title: `第 ${h.index} 局  庄 ${dealer}（连${h.streak}）`,
        hus,
      }
    })
    const settlements: SessionSettleView[] = c.settlements.map((s) => ({
      playerId: s.playerId,
      nickname: nicks[s.playerId] || s.nickname || s.playerId,
      faceSrc: faces[s.playerId] || avatarSrc('avatar_00'),
      chipDelta: s.chipDelta,
      yuan: s.yuan,
      chipLabel: `牌 ${signed(s.chipDelta)}`,
      yuanLabel: `${signed(s.yuan)} 元`,
      yuanClass: s.yuan > 0 ? 'up' : s.yuan < 0 ? 'down' : '',
    }))
    return {
      index: c.index,
      expanded:
        expanded === 'latest'
          ? c.index === lastIndex
          : expanded.has(c.index),
      settlements,
      hands: handSummaries,
    }
  })
}

export function presentSession(
  doc: SessionDoc,
  expanded: SessionExpandState = 'latest',
): SessionDetailView {
  return {
    roomCode: doc.roomCode,
    chipValueYuan: doc.chipValueYuan,
    status: doc.status,
    statusLabel: STATUS_LABEL[doc.status] || doc.status,
    ended: doc.status === 'ended',
    canEnd: doc.status !== 'ended' && !doc.currentCycle,
    cycles: buildCycles(doc, expanded),
  }
}

export function toggleCycleExpanded(
  cycles: SessionCycleView[],
  index: number,
): SessionCycleView[] {
  return cycles.map((c) =>
    c.index === index ? { ...c, expanded: !c.expanded } : c,
  )
}
