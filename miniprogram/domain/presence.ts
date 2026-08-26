import { trimNickname } from './character'

export const WIND_NICKNAMES = ['东', '南', '西', '北'] as const

export type SessionMember = {
  openId: string
  nickname: string
  avatarId: string
  joinedAt: number
}

export type ClaimableSeat = {
  playerId: string
  nickname: string
  claimedOpenId?: string
  avatarId?: string
}

export function canMutateSeats(status: string): boolean {
  return status === 'open'
}

export function upsertMember(
  members: SessionMember[],
  patch: { openId: string; nickname: string; avatarId: string },
  now: number,
): SessionMember[] {
  const i = members.findIndex((m) => m.openId === patch.openId)
  if (i < 0) {
    return [...members, { ...patch, joinedAt: now }]
  }
  const next = members.slice()
  next[i] = {
    ...next[i],
    nickname: patch.nickname,
    avatarId: patch.avatarId,
  }
  return next
}

function clearClaim(seat: ClaimableSeat, index: number): ClaimableSeat {
  return {
    playerId: seat.playerId,
    nickname: WIND_NICKNAMES[index] || seat.nickname,
  }
}

function applyClaim(
  seat: ClaimableSeat,
  actor: { openId: string; nickname: string; avatarId: string },
): ClaimableSeat {
  return {
    ...seat,
    claimedOpenId: actor.openId,
    avatarId: actor.avatarId,
    nickname: actor.nickname,
  }
}

export function claimSeat(
  seats: ClaimableSeat[],
  playerId: string,
  actor: { openId: string; nickname: string; avatarId: string },
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'occupied' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  const target = seats[idx]
  if (target.claimedOpenId && target.claimedOpenId !== actor.openId) {
    return { ok: false, error: 'occupied' }
  }
  const next = seats.map((s, i) =>
    s.claimedOpenId === actor.openId ? clearClaim(s, i) : { ...s },
  )
  next[idx] = applyClaim(next[idx], actor)
  return { ok: true, seats: next }
}

export function unclaimSeat(
  seats: ClaimableSeat[],
  playerId: string,
  openId: string,
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'not_owner' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (seats[idx].claimedOpenId !== openId) return { ok: false, error: 'not_owner' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = clearClaim(next[idx], idx)
  return { ok: true, seats: next }
}

export function scorerUnclaimSeat(
  seats: ClaimableSeat[],
  playerId: string,
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'empty' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (!seats[idx].claimedOpenId) return { ok: false, error: 'empty' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = clearClaim(next[idx], idx)
  return { ok: true, seats: next }
}

export function renameUnclaimedSeat(
  seats: ClaimableSeat[],
  playerId: string,
  nickname: string,
):
  | { ok: true; seats: ClaimableSeat[] }
  | { ok: false; error: 'not_found' | 'claimed' | 'empty_name' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (seats[idx].claimedOpenId) return { ok: false, error: 'claimed' }
  const name = trimNickname(nickname)
  if (!name) return { ok: false, error: 'empty_name' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = { ...next[idx], nickname: name }
  return { ok: true, seats: next }
}
