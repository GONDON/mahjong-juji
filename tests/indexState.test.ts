import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEAT_NICKNAMES,
  canSubmitJoin,
  formatEndedAgo,
  joinCodeCells,
  normalizeJoinCode,
  parseStoredCampaigns,
  presentRecentCampaign,
  selectChipValue,
  sessionRoute,
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
  it('accepts 1, 2, or 5 and keeps the current value otherwise', () => {
    expect(selectChipValue(1, 2)).toBe(1)
    expect(selectChipValue(5, 2)).toBe(5)
    expect(selectChipValue(4, 2)).toBe(2)
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
