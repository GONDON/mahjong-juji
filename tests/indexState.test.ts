import { describe, expect, it } from 'vitest'
import {
  CHIP_OPTIONS,
  DEFAULT_SEAT_NICKNAMES,
  RECENT_DELETE_WIDTH,
  canSubmitJoin,
  clampRecentSwipe,
  formatEndedAgo,
  joinCodeCells,
  joinCodeCaretSlot,
  normalizeJoinCode,
  parseStoredCampaigns,
  presentJoinField,
  presentRecentCampaign,
  removeRecentCampaign,
  selectChipValue,
  sessionDetailRoute,
  sessionRoute,
  snapRecentSwipe,
  upsertRecentCampaign,
  type RecentCampaign,
} from '../miniprogram/pages/index/indexState'

const playing: RecentCampaign = {
  sessionId: 'sess_1',
  roomCode: '8K2P',
  chipValueYuan: 2,
  status: 'playing',
  updatedAt: 1_000,
}

const ended: RecentCampaign = {
  sessionId: 'sess_2',
  roomCode: '4A9B',
  chipValueYuan: 5,
  status: 'ended',
  updatedAt: 500,
}

describe('lobby chip value', () => {
  it('offers 1 through 5', () => {
    expect(CHIP_OPTIONS).toEqual([1, 2, 3, 4, 5])
  })

  it('accepts 1-5 and keeps the current value otherwise', () => {
    expect(selectChipValue(1, 2)).toBe(1)
    expect(selectChipValue(3, 2)).toBe(3)
    expect(selectChipValue(4, 2)).toBe(4)
    expect(selectChipValue(5, 2)).toBe(5)
    expect(selectChipValue(6, 2)).toBe(2)
    expect(selectChipValue(0, 2)).toBe(2)
  })
})

describe('lobby join code', () => {
  it('normalizes to 4 uppercase room-code characters', () => {
    expect(normalizeJoinCode('8k2p')).toBe('8K2P')
    expect(normalizeJoinCode('8k2pzz')).toBe('8K2P')
    expect(normalizeJoinCode('8-k io')).toBe('8K')
  })

  it('pads visible cells to four slots', () => {
    expect(joinCodeCells('8K')).toEqual(['8', 'K', '', ''])
  })

  it('allows join only when the code is complete', () => {
    expect(canSubmitJoin('8K2')).toBe(false)
    expect(canSubmitJoin('8K2P')).toBe(true)
  })

  it('puts the caret on the next empty slot, last slot when full', () => {
    expect(joinCodeCaretSlot('')).toBe(0)
    expect(joinCodeCaretSlot('8')).toBe(1)
    expect(joinCodeCaretSlot('8K2')).toBe(3)
    expect(joinCodeCaretSlot('8K2P')).toBe(3)
  })

  it('walks the simulated caret through each box, including the fourth when full', () => {
    const carets = (code: string) =>
      presentJoinField(code, true).joinCells.map((cell) => cell.caret)

    expect(carets('')).toEqual([true, false, false, false])
    expect(carets('8')).toEqual([false, true, false, false])
    expect(carets('8K')).toEqual([false, false, true, false])
    expect(carets('8K2')).toEqual([false, false, false, true])
    expect(carets('8K2P')).toEqual([false, false, false, true])
    expect(
      presentJoinField('8K2P', false).joinCells.every((cell) => !cell.caret),
    ).toBe(true)
  })

  it('clears the join field to an empty unfocused state', () => {
    expect(presentJoinField('KKVZ')).not.toEqual(presentJoinField(''))
    expect(presentJoinField('')).toEqual({
      joinCode: '',
      canJoin: false,
      joinCells: [
        { slot: 0, ch: '', caret: false },
        { slot: 1, ch: '', caret: false },
        { slot: 2, ch: '', caret: false },
        { slot: 3, ch: '', caret: false },
      ],
    })
  })
})

describe('lobby recent campaigns', () => {
  it('uses wind nicknames as default seats', () => {
    expect(DEFAULT_SEAT_NICKNAMES).toEqual(['东', '南', '西', '北'])
  })

  it('puts the newest campaign first and drops duplicates', () => {
    const next = { ...playing, chipValueYuan: 5, updatedAt: 2_000 }
    const list = upsertRecentCampaign([ended, playing], next)
    expect(list.map((c) => c.sessionId)).toEqual(['sess_1', 'sess_2'])
    expect(list[0].chipValueYuan).toBe(5)
  })

  it('removes a campaign by session id', () => {
    expect(removeRecentCampaign([playing, ended], 'sess_1')).toEqual([ended])
    expect(removeRecentCampaign([playing, ended], 'missing')).toEqual([
      playing,
      ended,
    ])
  })

  it('presents active and finished rows for the lobby list', () => {
    expect(presentRecentCampaign(playing, 1_000)).toMatchObject({
      title: '房间 8K2P',
      meta: '底分 2',
      actionLabel: '再入局',
      active: true,
    })
    expect(presentRecentCampaign(ended, 1_000 + 2 * 60 * 60 * 1000)).toMatchObject({
      title: '房间 4A9B',
      meta: '已结束 · 2 小时前',
      actionLabel: '已结束',
      active: false,
    })
  })

  it('routes re-entry by session status', () => {
    expect(sessionRoute(playing)).toBe('/pages/battle/battle?sessionId=sess_1')
    expect(sessionRoute({ ...playing, status: 'open' })).toBe(
      '/pages/dealer-pick/dealer-pick?sessionId=sess_1',
    )
    expect(sessionRoute(ended)).toBe('/pages/session/session?sessionId=sess_2')
    expect(sessionRoute({ ...playing, status: 'settling' })).toBe(
      '/pages/battle/battle?sessionId=sess_1',
    )
  })

  it('routes a row tap to session detail', () => {
    expect(sessionDetailRoute(playing)).toBe(
      '/pages/session/session?sessionId=sess_1',
    )
    expect(sessionDetailRoute(ended)).toBe(
      '/pages/session/session?sessionId=sess_2',
    )
  })
})

describe('recent swipe', () => {
  it('clamps left to the delete width and ignores a right swipe', () => {
    expect(clampRecentSwipe(40)).toBe(0)
    expect(clampRecentSwipe(-40)).toBe(-40)
    expect(clampRecentSwipe(-200)).toBe(-RECENT_DELETE_WIDTH)
  })

  it('snaps open past halfway, otherwise closed', () => {
    expect(snapRecentSwipe(-20)).toBe(0)
    expect(snapRecentSwipe(-RECENT_DELETE_WIDTH / 2 - 1)).toBe(
      -RECENT_DELETE_WIDTH,
    )
    expect(snapRecentSwipe(-RECENT_DELETE_WIDTH)).toBe(-RECENT_DELETE_WIDTH)
  })
})

describe('ended-ago copy', () => {
  it('uses hour-scale Chinese relative time', () => {
    const now = 10_000_000
    expect(formatEndedAgo(now - 2 * 60 * 60 * 1000, now)).toBe('2 小时前')
  })
})

describe('stored campaigns', () => {
  it('keeps well-formed rows and drops junk', () => {
    expect(
      parseStoredCampaigns([playing, { sessionId: 1 }, null, ended]),
    ).toEqual([playing, ended])
    expect(parseStoredCampaigns(undefined)).toEqual([])
  })
})
