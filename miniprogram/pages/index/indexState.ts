import type { SessionStatus } from '../../services/sessionApi'

export const CHIP_OPTIONS = [1, 2, 5] as const
export const DEFAULT_SEAT_NICKNAMES = ['东', '南', '西', '北'] as const
export const ROOM_CODE_LENGTH = 4
export const RECENT_STORAGE_KEY = 'lobby.recentCampaigns'
export const MAX_RECENT = 6

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

export type TabTarget =
  | { type: 'nav'; url: string }
  | { type: 'toast'; title: string }

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
  const sessionId = encodeURIComponent(campaign.sessionId)
  if (campaign.status === 'playing') {
    return `/pages/battle/battle?sessionId=${sessionId}`
  }
  if (campaign.status === 'ended') {
    return `/pages/session/session?sessionId=${sessionId}`
  }
  return `/pages/dealer-pick/dealer-pick?sessionId=${sessionId}`
}

export function battleTabTarget(list: RecentCampaign[]): TabTarget {
  const playing = list.find((item) => item.status === 'playing')
  if (playing) return { type: 'nav', url: sessionRoute(playing) }
  const live = list.find(
    (item) => item.status === 'open' || item.status === 'settling',
  )
  if (live) return { type: 'nav', url: sessionRoute(live) }
  return { type: 'toast', title: '先开一局或加入房间' }
}

export function historyTabTarget(list: RecentCampaign[]): TabTarget {
  const latest = list[0]
  if (!latest) return { type: 'toast', title: '还没有流水' }
  return {
    type: 'nav',
    url: `/pages/session/session?sessionId=${encodeURIComponent(latest.sessionId)}`,
  }
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
