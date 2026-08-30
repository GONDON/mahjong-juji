import { describe, it, expect } from 'vitest'
import { settleCycle } from '../miniprogram/domain/settleCycle'

describe('settleCycle', () => {
  it('converts chip delta to yuan', () => {
    const r = settleCycle(
      [
        { playerId: 'a', nickname: 'A', chips: 25, hasHu: false },
        { playerId: 'b', nickname: 'B', chips: 0, hasHu: false },
        { playerId: 'c', nickname: 'C', chips: 20, hasHu: false },
        { playerId: 'd', nickname: 'D', chips: 35, hasHu: false },
      ],
      2,
    )
    expect(r.find((x) => x.playerId === 'a')).toEqual({
      playerId: 'a',
      chipDelta: 5,
      yuan: 10,
    })
    expect(r.find((x) => x.playerId === 'b')!.yuan).toBe(-40)
  })

  it('uses startingChips instead of a hardcoded 20', () => {
    const r = settleCycle(
      [
        { playerId: 'a', nickname: 'A', chips: 15, hasHu: false },
        { playerId: 'b', nickname: 'B', chips: 0, hasHu: false },
        { playerId: 'c', nickname: 'C', chips: 10, hasHu: false },
        { playerId: 'd', nickname: 'D', chips: 25, hasHu: false },
      ],
      2,
      10,
    )
    expect(r.find((x) => x.playerId === 'a')).toEqual({
      playerId: 'a',
      chipDelta: 5,
      yuan: 10,
    })
    expect(r.find((x) => x.playerId === 'b')!.yuan).toBe(-20)
  })
})
