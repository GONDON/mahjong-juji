import type { SessionStatus } from '../../services/sessionApi'
import { tablePathFor } from '../../domain/sessionRoute'

export const CHIP_OPTIONS = [1, 2, 3, 4, 5] as const
export const DEFAULT_SEAT_NICKNAMES = ['东', '南', '西', '北'] as const
export const ROOM_CODE_LENGTH = 4
export const HOME_RECENT_LIMIT = 5
export const HOME_FETCH_LIMIT = 6
export const HISTORY_FETCH_LIMIT = 50

const ROOM_CODE_CHARS = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g

export type RecentCampaign = {
  sessionId: string
  roomCode: string
  chipValueYuan: number
  startingChips: number
  status: SessionStatus
  createdAt: number
}

export type RecentCampaignView = RecentCampaign & {
  title: string
  meta: string
  actionLabel: string
  active: boolean
}

export function selectChipValue(next: number, current: number): number {
  return (CHIP_OPTIONS as readonly number[]).includes(next) ? next : current
}

export function normalizeJoinCode(raw: string): string {
  const matches = String(raw || '')
    .toUpperCase()
    .match(ROOM_CODE_CHARS)
  return (matches ? matches.join('') : '').slice(0, ROOM_CODE_LENGTH)
}

export function joinCodeCells(code: string): string[] {
  const normalized = normalizeJoinCode(code)
  return Array.from({ length: ROOM_CODE_LENGTH }, (_, i) => normalized[i] || '')
}

export function joinCodeCaretSlot(code: string): number {
  const normalized = normalizeJoinCode(code)
  return Math.min(normalized.length, ROOM_CODE_LENGTH - 1)
}

export type JoinCodeCellView = {
  slot: number
  ch: string
  caret: boolean
}

export type JoinFieldView = {
  joinCode: string
  canJoin: boolean
  joinCells: JoinCodeCellView[]
}

export function presentJoinField(
  code: string,
  focused = false,
): JoinFieldView {
  const joinCode = normalizeJoinCode(code)
  const caretSlot = joinCodeCaretSlot(joinCode)
  return {
    joinCode,
    canJoin: canSubmitJoin(joinCode),
    joinCells: joinCodeCells(joinCode).map((ch, slot) => ({
      slot,
      ch,
      caret: focused && slot === caretSlot,
    })),
  }
}

export function canSubmitJoin(code: string): boolean {
  return normalizeJoinCode(code).length === ROOM_CODE_LENGTH
}

export function sliceHomeRecents(
  list: RecentCampaign[],
): { recents: RecentCampaign[]; hasMore: boolean } {
  return {
    recents: list.slice(0, HOME_RECENT_LIMIT),
    hasMore: list.length > HOME_RECENT_LIMIT,
  }
}

export function presentRecentCampaign(
  campaign: RecentCampaign,
): RecentCampaignView {
  const active = campaign.status !== 'ended'
  return {
    ...campaign,
    title: `房间 ${campaign.roomCode}`,
    meta: active
      ? `底分 ${campaign.chipValueYuan} · ${campaign.startingChips}牌`
      : '已结束',
    actionLabel: active ? '再入局' : '已结束',
    active,
  }
}

export function sessionRoute(campaign: RecentCampaign): string {
  return tablePathFor(campaign.status, campaign.sessionId)
}

export function sessionDetailRoute(campaign: RecentCampaign): string {
  return `/pages/session/session?sessionId=${encodeURIComponent(campaign.sessionId)}`
}

