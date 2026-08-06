import { describe, it, expect } from 'vitest'
import { scoreHu } from '../miniprogram/domain/scoreHu'
import type { TableState } from '../miniprogram/domain/types'

function table(partial?: Partial<TableState>): TableState {
  return {
    seats: [
      { playerId: 'a', nickname: 'A', chips: 20, hasHu: false },
      { playerId: 'b', nickname: 'B', chips: 20, hasHu: false },
      { playerId: 'c', nickname: 'C', chips: 20, hasHu: false },
      { playerId: 'd', nickname: 'D', chips: 20, hasHu: false },
    ],
    dealer: { dealerId: 'a', streak: 0 },
    firstHuId: null,
    ...partial,
  }
}

describe('scoreHu', () => {
  it('non-dealer pinghu dianpao: payer pays 1', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.perPayer).toBe(1)
    expect(r.transfers).toEqual([
      { fromId: 'c', toId: 'b', chips: 1, reason: 'fee' },
    ])
  })

  it('dealer first-seat zimo duidui: each of 3 pays 4', () => {
    const r = scoreHu(table(), {
      winnerId: 'a',
      winType: 'zimo',
      basicFan: 'duidui',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.dealerMult).toBe(2)
    expect(r.perPayer).toBe(4)
    expect(r.transfers).toHaveLength(3)
    expect(r.transfers.every((t) => t.chips === 4)).toBe(true)
  })

  it('streak makes mult 4; qingyise zimo +1 ming gang => 17 each', () => {
    const r = scoreHu(table({ dealer: { dealerId: 'a', streak: 2 } }), {
      winnerId: 'a',
      winType: 'zimo',
      basicFan: 'qingyise',
      extras: [],
      genCount: 0,
      mingGang: 1,
      anGang: 0,
    })
    expect(r.dealerMult).toBe(4)
    expect(r.fanPart).toBe(16)
    expect(r.gangPart).toBe(1)
    expect(r.perPayer).toBe(17)
  })

  it('dianpao +1 anGang adds 2', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 1,
    })
    expect(r.perPayer).toBe(3)
    expect(r.transfers[0].chips).toBe(3)
  })
})
