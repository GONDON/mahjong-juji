import { describe, expect, it } from 'vitest'
import {
  claimSeat,
  renameUnclaimedSeat,
  scorerUnclaimSeat,
  unclaimSeat,
  upsertMember,
  WIND_NICKNAMES,
} from '../miniprogram/domain/presence'

const seats = () =>
  WIND_NICKNAMES.map((nickname, i) => ({
    playerId: `nid_${nickname}`,
    nickname,
  }))

const actorA = { openId: 'oa', nickname: '阿强', avatarId: 'avatar_01' }
const actorB = { openId: 'ob', nickname: '阿珍', avatarId: 'avatar_02' }

describe('presence', () => {
  it('upserts member without resetting joinedAt', () => {
    const once = upsertMember([], { openId: 'oa', nickname: '牌友', avatarId: 'avatar_00' }, 1)
    const twice = upsertMember(once, { openId: 'oa', nickname: '阿强', avatarId: 'avatar_01' }, 99)
    expect(twice).toHaveLength(1)
    expect(twice[0].joinedAt).toBe(1)
    expect(twice[0].nickname).toBe('阿强')
  })

  it('claims empty seat and moves on second claim', () => {
    const first = claimSeat(seats(), 'nid_东', actorA)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.seats[0].claimedOpenId).toBe('oa')
    expect(first.seats[0].nickname).toBe('阿强')
    const moved = claimSeat(first.seats, 'nid_南', actorA)
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.seats[0].claimedOpenId).toBeUndefined()
    expect(moved.seats[0].nickname).toBe('东')
    expect(moved.seats[1].claimedOpenId).toBe('oa')
  })

  it('rejects occupying another player seat', () => {
    const first = claimSeat(seats(), 'nid_东', actorA)
    if (!first.ok) throw new Error('setup')
    expect(claimSeat(first.seats, 'nid_东', actorB)).toEqual({
      ok: false,
      error: 'occupied',
    })
  })

  it('unclaim restores wind name; scorer can kick; cannot rename claimed', () => {
    const first = claimSeat(seats(), 'nid_东', actorA)
    if (!first.ok) throw new Error('setup')
    const kicked = scorerUnclaimSeat(first.seats, 'nid_东')
    expect(kicked.ok).toBe(true)
    if (!kicked.ok) return
    expect(kicked.seats[0].nickname).toBe('东')
    const named = renameUnclaimedSeat(kicked.seats, 'nid_东', '老王')
    expect(named.ok).toBe(true)
    const again = claimSeat(first.seats, 'nid_东', actorA)
    if (!again.ok) return
    expect(renameUnclaimedSeat(again.seats, 'nid_东', '老王').ok).toBe(false)
    expect(unclaimSeat(again.seats, 'nid_东', 'oa').ok).toBe(true)
    expect(unclaimSeat(again.seats, 'nid_东', 'ob').ok).toBe(false)
  })
})
