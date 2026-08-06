import { describe, it, expect } from 'vitest'
import { fanProduct } from '../miniprogram/domain/fans'

describe('fanProduct', () => {
  it('pinghu alone is 1', () => {
    expect(fanProduct('pinghu', [], 0)).toBe(1)
  })

  it('duidui * gangshanghua * one gen = 8', () => {
    expect(fanProduct('duidui', ['gangshanghua'], 1)).toBe(8)
  })

  it('qingyise is 4', () => {
    expect(fanProduct('qingyise', [], 0)).toBe(4)
  })
})
