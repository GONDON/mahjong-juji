import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STARTING_CHIPS,
  isValidStartingChips,
  readStartingChips,
  requireStartingChips,
  stepStartingChips,
} from '../miniprogram/domain/startingChips'

describe('startingChips', () => {
  it('accepts 10–50 in steps of 5', () => {
    expect(isValidStartingChips(10)).toBe(true)
    expect(isValidStartingChips(20)).toBe(true)
    expect(isValidStartingChips(50)).toBe(true)
    expect(isValidStartingChips(15)).toBe(true)
    expect(isValidStartingChips(11)).toBe(false)
    expect(isValidStartingChips(5)).toBe(false)
    expect(isValidStartingChips(55)).toBe(false)
    expect(isValidStartingChips(20.5)).toBe(false)
    expect(isValidStartingChips('20')).toBe(false)
  })

  it('reads missing or illegal values as 20', () => {
    expect(readStartingChips(undefined)).toBe(DEFAULT_STARTING_CHIPS)
    expect(readStartingChips(null)).toBe(20)
    expect(readStartingChips(11)).toBe(20)
    expect(readStartingChips(30)).toBe(30)
  })

  it('require treats omit as 20 and rejects illegal provided values', () => {
    expect(requireStartingChips(undefined)).toBe(20)
    expect(() => requireStartingChips(11)).toThrow(/startingChips/)
    expect(requireStartingChips(15)).toBe(15)
  })

  it('steps by 5 and clamps at 10 and 50', () => {
    expect(stepStartingChips(20, 1)).toBe(25)
    expect(stepStartingChips(20, -1)).toBe(15)
    expect(stepStartingChips(10, -1)).toBe(10)
    expect(stepStartingChips(50, 1)).toBe(50)
  })
})
