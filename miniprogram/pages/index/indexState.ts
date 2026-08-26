import type { SessionStatus } from '../../services/sessionApi'
import { tablePathFor } from '../../domain/sessionRoute'

export const CHIP_OPTIONS = [1, 2, 3, 4, 5] as const
export const DEFAULT_SEAT_NICKNAMES = ['东', '南', '西', '北'] as const
export const ROOM_CODE_LENGTH = 4
export const RECENT_STORAGE_KEY = 'lobby.recentCampaigns'
export const MAX_RECENT = 6
export const RECENT_DELETE_WIDTH = 72

const ROOM_CODE_CHARS = /[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g

export type RecentCampaign = {
  sessionId: string
  roomCode: string
  chipValueYuan: number
  status: SessionStatus
  updatedAt: number
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

export function upsertRecentCampaign(
  list: RecentCampaign[],
  next: RecentCampaign,
  max = MAX_RECENT,
): RecentCampaign[] {
  const rest = list.filter((item) => item.sessionId !== next.sessionId)
  return [next, ...rest].slice(0, max)
}

export function removeRecentCampaign(
  list: RecentCampaign[],
  sessionId: string,
): RecentCampaign[] {
  return list.filter((item) => item.sessionId !== sessionId)
}

export function clampRecentSwipe(
  dx: number,
  width = RECENT_DELETE_WIDTH,
): number {
  return Math.min(0, Math.max(-width, dx))
}

export function snapRecentSwipe(
  offsetX: number,
  width = RECENT_DELETE_WIDTH,
): number {
  return offsetX < -width / 2 ? -width : 0
}

export function formatEndedAgo(updatedAt: number, now: number): string {
  const ms = Math.max(0, now - updatedAt)
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

export function presentRecentCampaign(
  campaign: RecentCampaign,
  now: number,
): RecentCampaignView {
  const active = campaign.status !== 'ended'
  return {
    ...campaign,
    title: `房间 ${campaign.roomCode}`,
    meta: active
      ? `底分 ${campaign.chipValueYuan}`
      : `已结束 · ${formatEndedAgo(campaign.updatedAt, now)}`,
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

export function parseStoredCampaigns(raw: unknown): RecentCampaign[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isRecentCampaign)
}

function isRecentCampaign(value: unknown): value is RecentCampaign {
  if (!value || typeof value !== 'object') return false
  const item = value as RecentCampaign
  return (
    typeof item.sessionId === 'string' &&
    typeof item.roomCode === 'string' &&
    typeof item.chipValueYuan === 'number' &&
    typeof item.updatedAt === 'number' &&
    (item.status === 'open' ||
      item.status === 'playing' ||
      item.status === 'settling' ||
      item.status === 'ended')
  )
}
