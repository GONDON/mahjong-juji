import { describe, expect, it } from 'vitest'
import {
  CHIP_OPTIONS,
  DEFAULT_SEAT_NICKNAMES,
  HOME_FETCH_LIMIT,
  HOME_RECENT_LIMIT,
  HISTORY_FETCH_LIMIT,
  canSubmitJoin,
  joinCodeCells,
  joinCodeCaretSlot,
  normalizeJoinCode,
  presentJoinField,
  presentRecentCampaign,
  selectChipValue,
  sessionDetailRoute,
  sessionRoute,
  sliceHomeRecents,
  type RecentCampaign,
} from '../miniprogram/pages/index/indexState'

const playing: RecentCampaign = {
  sessionId: 'sess_1',
  roomCode: '8K2P',
  chipValueYuan: 2,
  startingChips: 20,
  status: 'playing',
  createdAt: 1_000,
}

const ended: RecentCampaign = {
  sessionId: 'sess_2',
  roomCode: '4A9B',
  chipValueYuan: 5,
  startingChips: 20,
  status: 'ended',
  createdAt: 500,
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

  it('caps fetch/display constants', () => {
    expect(HOME_RECENT_LIMIT).toBe(5)
    expect(HOME_FETCH_LIMIT).toBe(6)
    expect(HISTORY_FETCH_LIMIT).toBe(50)
  })

  it('slices six rows to five and flags hasMore', () => {
    const six = [0, 1, 2, 3, 4, 5].map((i) => ({
      ...playing,
      sessionId: `sess_${i}`,
      createdAt: 1000 - i,
    }))
    expect(sliceHomeRecents([])).toEqual({ recents: [], hasMore: false })
    expect(sliceHomeRecents(six.slice(0, 5))).toEqual({
      recents: six.slice(0, 5),
      hasMore: false,
    })
    expect(sliceHomeRecents(six)).toEqual({
      recents: six.slice(0, 5),
      hasMore: true,
    })
  })

  it('presents active and finished rows for the lobby list', () => {
    expect(presentRecentCampaign(playing)).toMatchObject({
      title: '房间 8K2P',
      meta: '底分 2 · 20牌',
      actionLabel: '再入局',
      active: true,
    })
    expect(
      presentRecentCampaign({ ...playing, startingChips: 15 }),
    ).toMatchObject({
      meta: '底分 2 · 15牌',
    })
    expect(presentRecentCampaign(ended)).toMatchObject({
      title: '房间 4A9B',
      meta: '已结束',
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

