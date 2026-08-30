import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOUSE_RULES,
  readHouseRules,
  requireHouseRules,
  zimoFanLabel,
} from '../miniprogram/domain/houseRules'

describe('houseRules', () => {
  it('defaults new rooms to plusOne', () => {
    expect(DEFAULT_HOUSE_RULES).toEqual({ zimoFan: 'plusOne' })
    expect(requireHouseRules(undefined)).toEqual({ zimoFan: 'plusOne' })
    expect(requireHouseRules(null)).toEqual({ zimoFan: 'plusOne' })
  })

  it('reads missing or bad values as none', () => {
    expect(readHouseRules(undefined)).toEqual({ zimoFan: 'none' })
    expect(readHouseRules({})).toEqual({ zimoFan: 'none' })
    expect(readHouseRules({ zimoFan: 'timesThree' })).toEqual({ zimoFan: 'none' })
    expect(readHouseRules({ zimoFan: 'plusOne' })).toEqual({ zimoFan: 'plusOne' })
    expect(readHouseRules({ zimoFan: 'none' })).toEqual({ zimoFan: 'none' })
  })

  it('rejects illegal create payloads', () => {
    expect(() => requireHouseRules({ zimoFan: 'timesThree' })).toThrow(
      /houseRules/,
    )
    expect(() => requireHouseRules({ zimoFan: 'plusOne' })).not.toThrow()
  })

  it('labels zimo fan modes', () => {
    expect(zimoFanLabel('plusOne')).toBe('自摸加一番')
    expect(zimoFanLabel('none')).toBe('自摸不加番')
  })
})
