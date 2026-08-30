import { describe, it, expect } from 'vitest'
import type { HouseRules } from '../miniprogram/domain/houseRules'
import { scoreHu } from '../miniprogram/domain/scoreHu'
import type { TableState } from '../miniprogram/domain/types'

const none: HouseRules = { zimoFan: 'none' }
const plus: HouseRules = { zimoFan: 'plusOne' }

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
    }, none)
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
    }, none)
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
    }, none)
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
    }, none)
    expect(r.perPayer).toBe(3)
    expect(r.fanPart).toBe(1)
    expect(r.gangPart).toBe(2)
    expect(r.transfers[0].chips).toBe(3)
  })

  it('non-dealer longqidui dianpao is 16 even with one gen', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'longqidui',
      extras: [],
      genCount: 1,
      mingGang: 0,
      anGang: 0,
    }, none)
    expect(r.fanPart).toBe(16)
    expect(r.perPayer).toBe(16)
  })

  it('non-dealer pinghu zimo plusOne: each pays 2', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'zimo',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.fanPart).toBe(2)
    expect(r.perPayer).toBe(2)
    expect(r.transfers).toHaveLength(3)
  })

  it('non-dealer duidui zimo plusOne: each pays 4', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'zimo',
      basicFan: 'duidui',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.fanPart).toBe(4)
    expect(r.perPayer).toBe(4)
  })

  it('duidui dianpao plusOne still pays 2', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'duidui',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.perPayer).toBe(2)
    expect(r.transfers).toHaveLength(1)
  })

  it('pinghu gangshanghua zimo plusOne is 4', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'zimo',
      basicFan: 'pinghu',
      extras: ['gangshanghua'],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.fanPart).toBe(4)
    expect(r.perPayer).toBe(4)
  })
})
