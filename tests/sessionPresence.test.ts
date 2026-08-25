import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetMockSessions,
  __setMockActor,
  claimSeat,
  createSession,
  enterSession,
  getSession,
  MOCK_SCORER_ID,
  scorerRenameSeat,
  scorerUnclaimSeat,
  settleCycleManual,
  startCycle,
  unclaimSeat,
  upsertCharacter,
} from '../miniprogram/services/sessionApi'

describe('session presence', () => {
  beforeEach(() => {
    __resetMockSessions()
  })

  it('adds creator to members without claiming a seat', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    const doc = await getSession(sessionId)
    expect(doc.members).toHaveLength(1)
    expect(doc.members[0].openId).toBe(MOCK_SCORER_ID)
    expect(doc.seats.every((s) => !s.claimedOpenId)).toBe(true)
  })

  it('lets a second player join, claim, move, and leave a seat', async () => {
    const { sessionId, roomCode } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    __setMockActor('user-b')
    await upsertCharacter({ nickname: '阿珍', avatarId: 'avatar_02' })
    const joined = await enterSession({ roomCode })
    expect(joined.members.map((m) => m.openId).sort()).toEqual(['user-b', MOCK_SCORER_ID].sort())

    const east = joined.seats[0].playerId
    const south = joined.seats[1].playerId
    const claimed = await claimSeat(sessionId, east)
    expect(claimed.seats[0].claimedOpenId).toBe('user-b')
    expect(claimed.seats[0].nickname).toBe('阿珍')

    const moved = await claimSeat(sessionId, south)
    expect(moved.seats[0].claimedOpenId).toBeUndefined()
    expect(moved.seats[1].claimedOpenId).toBe('user-b')

    const left = await unclaimSeat(sessionId, south)
    expect(left.seats[1].nickname).toBe('南')
  })

  it('rejects claiming occupied seats and incomplete characters', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    __setMockActor('user-b')
    await enterSession({ sessionId })
    await expect(claimSeat(sessionId, (await getSession(sessionId)).seats[0].playerId)).rejects.toThrow(
      /character incomplete/,
    )
    await upsertCharacter({ nickname: '阿珍', avatarId: 'avatar_02' })
    await claimSeat(sessionId, (await getSession(sessionId)).seats[0].playerId)
    __setMockActor('user-c')
    await upsertCharacter({ nickname: '阿强', avatarId: 'avatar_01' })
    await enterSession({ sessionId })
    await expect(
      claimSeat(sessionId, (await getSession(sessionId)).seats[0].playerId),
    ).rejects.toThrow(/occupied/)
  })

  it('scorer can kick and rename unclaimed seats; settlements carry openId', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    __setMockActor('user-b')
    await upsertCharacter({ nickname: '阿珍', avatarId: 'avatar_02' })
    await enterSession({ sessionId })
    const east = (await getSession(sessionId)).seats[0].playerId
    await claimSeat(sessionId, east)

    __setMockActor(MOCK_SCORER_ID)
    const kicked = await scorerUnclaimSeat(sessionId, east)
    expect(kicked.seats[0].claimedOpenId).toBeUndefined()
    const renamed = await scorerRenameSeat(sessionId, east, '老王')
    expect(renamed.seats[0].nickname).toBe('老王')

    __setMockActor('user-b')
    await claimSeat(sessionId, east)
    __setMockActor(MOCK_SCORER_ID)
    const ids = (await getSession(sessionId)).seats.map((s) => s.playerId)
    await startCycle(sessionId, ids[0])
    const rows = await settleCycleManual(sessionId)
    expect(rows[0].openId).toBe('user-b')
    expect(rows[1].openId).toBeNull()
    expect(rows[0].nickname).toBe('阿珍')
  })
})
