import { describe, it, expect } from 'vitest'
import {
  commitHu,
  commitLiuju,
  openNextHand,
} from '../miniprogram/domain/handFlow'
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

describe('handFlow', () => {
  it('non-dealer first hu then openNextHand => dealer becomes that player streak 0', () => {
    const { table: afterHu } = commitHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    const next = openNextHand(afterHu)
    expect(next.dealer).toEqual({ dealerId: 'b', streak: 0 })
    expect(next.firstHuId).toBeNull()
    expect(next.seats.every((s) => !s.hasHu)).toBe(true)
  })

  it('commitLiuju / afterHand null keeps dealer', () => {
    const dealer = { dealerId: 'a', streak: 2 }
    expect(commitLiuju(dealer)).toEqual(dealer)
  })

  it('commitHu marks winner hasHu and sets firstHuId', () => {
    const r = commitHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.table.seats.find((s) => s.playerId === 'b')!.hasHu).toBe(true)
    expect(r.table.firstHuId).toBe('b')
    expect(r.table.seats.find((s) => s.playerId === 'c')!.chips).toBe(19)
    expect(r.table.seats.find((s) => s.playerId === 'b')!.chips).toBe(21)
  })

  it('bankruptcy (payer cannot pay) sets cycleOver true', () => {
    const t = table({
      seats: [
        { playerId: 'a', nickname: 'A', chips: 20, hasHu: false },
        { playerId: 'b', nickname: 'B', chips: 20, hasHu: false },
        { playerId: 'c', nickname: 'C', chips: 0, hasHu: false },
        { playerId: 'd', nickname: 'D', chips: 20, hasHu: false },
      ],
    })
    const r = commitHu(t, {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.cycleOver).toBe(true)
    expect(r.bankruptIds).toEqual(['c'])
    expect(r.score.bankruptTriggered).toBe(true)
    expect(r.truncated[0].chips).toBe(0)
  })
})
