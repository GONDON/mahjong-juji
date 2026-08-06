import { describe, it, expect } from 'vitest'
import { applyTransfers } from '../miniprogram/domain/chips'
import type { Seat, Transfer } from '../miniprogram/domain/types'

const seats = (): Seat[] => [
  { playerId: 'a', nickname: 'A', chips: 20, hasHu: false },
  { playerId: 'b', nickname: 'B', chips: 2, hasHu: false },
  { playerId: 'c', nickname: 'C', chips: 20, hasHu: false },
  { playerId: 'd', nickname: 'D', chips: 20, hasHu: false },
]

describe('applyTransfers', () => {
  it('truncates when payer cannot full pay and marks bankrupt', () => {
    const transfers: Transfer[] = [
      { fromId: 'b', toId: 'a', chips: 5, reason: 'fee' },
    ]
    const r = applyTransfers(seats(), transfers)
    expect(r.truncated[0].chips).toBe(2)
    expect(r.seats.find((s) => s.playerId === 'b')!.chips).toBe(0)
    expect(r.seats.find((s) => s.playerId === 'a')!.chips).toBe(22)
    expect(r.bankruptIds).toEqual(['b'])
  })
})
