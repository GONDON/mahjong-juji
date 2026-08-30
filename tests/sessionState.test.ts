import { describe, expect, it } from 'vitest'
import type { SessionDoc } from '../miniprogram/services/sessionApi'
import {
  presentSession,
  toggleCycleExpanded,
} from '../miniprogram/pages/session/sessionState'

function doc(over: Partial<SessionDoc> = {}): SessionDoc {
  return {
    sessionId: 's1',
    roomCode: 'UCWJ',
    chipValueYuan: 1,
    scorerId: 'scorer',
    seats: [
      { playerId: 'e', nickname: '东', chips: 18, hasHu: true, avatarId: 'avatar_01' },
      { playerId: 's', nickname: '南', chips: 18, hasHu: true, avatarId: 'avatar_02' },
      { playerId: 'w', nickname: '西', chips: 18, hasHu: true, avatarId: 'avatar_03' },
      { playerId: 'n', nickname: '北', chips: 26, hasHu: true, avatarId: 'avatar_04' },
    ],
    members: [],
    memberOpenIds: ['scorer'],
    status: 'ended',
    cycles: [
      {
        index: 1,
        dealerPickId: 'e',
        status: 'settled',
        settlements: [
          { playerId: 'e', chipDelta: -2, yuan: -2, openId: null, nickname: '东' },
          { playerId: 's', chipDelta: -2, yuan: -2, openId: null, nickname: '南' },
          { playerId: 'w', chipDelta: -2, yuan: -2, openId: null, nickname: '西' },
          { playerId: 'n', chipDelta: 6, yuan: 6, openId: null, nickname: '北' },
        ],
      },
    ],
    hands: [
      {
        index: 1,
        cycleIndex: 1,
        dealerId: 'e',
        streak: 0,
        firstHuId: 'n',
        liuju: false,
      },
    ],
    huEvents: [
      {
        handIndex: 1,
        input: {
          winnerId: 'n',
          winType: 'zimo',
          basicFan: 'duidui',
          extras: [],
          genCount: 0,
          mingGang: 0,
          anGang: 0,
        },
        score: {
          transfers: [],
          perPayer: 2,
          fanPart: 2,
          gangPart: 0,
          dealerMult: 2,
          bankruptTriggered: false,
        },
        truncated: [],
      },
    ],
    createdAt: 1,
    ...over,
  }
}

describe('presentSession', () => {
  it('shows room recap labels and signed money without a duplicate page title', () => {
    const view = presentSession(doc())
    expect(view.roomCode).toBe('UCWJ')
    expect(view.chipValueYuan).toBe(1)
    expect(view.startingChips).toBe(20)
    expect(view.statusLabel).toBe('已结束')
    expect(view.ended).toBe(true)
    expect(view.canEnd).toBe(false)
    expect(view.cycles[0].settlements.map((s) => s.yuanLabel)).toEqual([
      '-2 元',
      '-2 元',
      '-2 元',
      '+6 元',
    ])
    expect(view.cycles[0].settlements[3]).toMatchObject({
      yuanClass: 'up',
      chipLabel: '牌 +6',
      faceSrc: '/assets/avatars/avatar_04.png',
    })
    expect(view.cycles[0].settlements[0].yuanClass).toBe('down')
  })

  it('surfaces startingChips from the session, defaulting missing to 20', () => {
    expect(presentSession(doc({ startingChips: 30 })).startingChips).toBe(30)
    expect(presentSession(doc()).startingChips).toBe(20)
  })

  it('surfaces zimoFanLabel, defaulting missing houseRules to 不加番', () => {
    expect(presentSession(doc()).zimoFanLabel).toBe('自摸不加番')
    expect(
      presentSession(doc({ houseRules: { zimoFan: 'plusOne' } })).zimoFanLabel,
    ).toBe('自摸加一番')
  })

  it('keeps a wash yuan in ink, not loss red', () => {
    const wash = doc({
      cycles: [
        {
          ...doc().cycles[0],
          settlements: [
            { playerId: 'e', chipDelta: 0, yuan: 0, openId: null, nickname: '东' },
            { playerId: 'n', chipDelta: 0, yuan: 0, openId: null, nickname: '北' },
          ],
        },
      ],
    })
    expect(presentSession(wash).cycles[0].settlements.every((s) => s.yuanClass === '')).toBe(true)
  })

  it('expands the latest cycle on first paint and keeps a collapsed set later', () => {
    const two = doc({
      cycles: [
        doc().cycles[0],
        { ...doc().cycles[0], index: 2 },
      ],
    })
    const first = presentSession(two, 'latest')
    expect(first.cycles.map((c) => c.expanded)).toEqual([false, true])

    const kept = presentSession(two, new Set())
    expect(kept.cycles.every((c) => !c.expanded)).toBe(true)
  })

  it('formats hand ledger copy for a zimo and a liuju', () => {
    const view = presentSession(doc())
    expect(view.cycles[0].hands[0]).toMatchObject({
      title: '第 1 局  庄 东（连0）',
      liuju: false,
    })
    expect(view.cycles[0].hands[0].hus[0]).toMatchObject({
      line: '北 自摸 对对胡',
      payLabel: '每人付 2 牌',
    })

    const liuju = presentSession(
      doc({
        hands: [
          {
            index: 1,
            cycleIndex: 1,
            dealerId: 'e',
            streak: 1,
            firstHuId: null,
            liuju: true,
          },
        ],
        huEvents: [],
      }),
    )
    expect(liuju.cycles[0].hands[0].title).toBe('第 1 局  庄 东（连1）')
    expect(liuju.cycles[0].hands[0].hus).toEqual([])
    expect(liuju.cycles[0].hands[0].liuju).toBe(true)
  })

  it('includes extras and gens in the hu line', () => {
    const withFan = doc({
      huEvents: [
        {
          ...doc().huEvents[0],
          input: {
            ...doc().huEvents[0].input,
            basicFan: 'duidui',
            extras: ['jiangdui'],
            genCount: 1,
          },
        },
      ],
    })
    expect(presentSession(withFan).cycles[0].hands[0].hus[0].line).toBe(
      '北 自摸 对对胡 将对 1根',
    )
  })

  it('allows ending only when the session is settled with no current cycle', () => {
    expect(presentSession(doc({ status: 'settling' })).canEnd).toBe(true)
    expect(
      presentSession(
        doc({
          status: 'playing',
          currentCycle: { index: 2, dealer: { dealerId: 'e', streak: 0 }, firstHuId: null },
        }),
      ).canEnd,
    ).toBe(false)
  })
})

describe('toggleCycleExpanded', () => {
  it('flips only the tapped cycle', () => {
    const cycles = presentSession(doc(), 'latest').cycles
    const next = toggleCycleExpanded(cycles, 1)
    expect(next[0].expanded).toBe(false)
    expect(toggleCycleExpanded(next, 1)[0].expanded).toBe(true)
  })
})
