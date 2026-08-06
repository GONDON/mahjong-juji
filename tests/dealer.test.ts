import { describe, it, expect } from 'vitest'
import { afterHand, freshDealer, dealerMult } from '../miniprogram/domain/dealer'

describe('dealer', () => {
  it('mult is 2+streak', () => {
    expect(dealerMult(0)).toBe(2)
    expect(dealerMult(2)).toBe(4)
  })

  it('liuju keeps dealer', () => {
    expect(afterHand({ dealerId: 'a', streak: 2 }, null)).toEqual({
      dealerId: 'a',
      streak: 2,
    })
  })

  it('dealer first hu increases streak', () => {
    expect(afterHand({ dealerId: 'a', streak: 0 }, 'a')).toEqual({
      dealerId: 'a',
      streak: 1,
    })
  })

  it('non-dealer first hu switches and resets', () => {
    expect(afterHand({ dealerId: 'a', streak: 3 }, 'b')).toEqual({
      dealerId: 'b',
      streak: 0,
    })
  })

  it('freshDealer resets streak', () => {
    expect(freshDealer('c')).toEqual({ dealerId: 'c', streak: 0 })
  })
})
