/**
 * Pure JS port of miniprogram/domain/presence.ts.
 */

const { trimNickname } = require('./character')

const WIND_NICKNAMES = ['东', '南', '西', '北']

function canMutateSeats(status) {
  return status === 'open' || status === 'settling'
}

function upsertMember(members, patch, now) {
  const list = members || []
  const i = list.findIndex((m) => m.openId === patch.openId)
  if (i < 0) {
    return list.concat([{ ...patch, joinedAt: now }])
  }
  const next = list.slice()
  next[i] = {
    ...next[i],
    nickname: patch.nickname,
    avatarId: patch.avatarId,
  }
  return next
}

function clearClaim(seat, index) {
  return {
    playerId: seat.playerId,
    nickname: WIND_NICKNAMES[index] || seat.nickname,
  }
}

function applyClaim(seat, actor) {
  return {
    ...seat,
    claimedOpenId: actor.openId,
    avatarId: actor.avatarId,
    nickname: actor.nickname,
  }
}

function claimSeat(seats, playerId, actor) {
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

function unclaimSeat(seats, playerId, openId) {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (seats[idx].claimedOpenId !== openId) return { ok: false, error: 'not_owner' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = clearClaim(next[idx], idx)
  return { ok: true, seats: next }
}

function scorerUnclaimSeat(seats, playerId) {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (!seats[idx].claimedOpenId) return { ok: false, error: 'empty' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = clearClaim(next[idx], idx)
  return { ok: true, seats: next }
}

function renameUnclaimedSeat(seats, playerId, nickname) {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (seats[idx].claimedOpenId) return { ok: false, error: 'claimed' }
  const name = trimNickname(nickname)
  if (!name) return { ok: false, error: 'empty_name' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = { ...next[idx], nickname: name }
  return { ok: true, seats: next }
}

module.exports = {
  WIND_NICKNAMES,
  canMutateSeats,
  upsertMember,
  claimSeat,
  unclaimSeat,
  scorerUnclaimSeat,
  renameUnclaimedSeat,
}
