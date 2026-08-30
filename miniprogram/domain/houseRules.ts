export type ZimoFan = 'none' | 'plusOne'

export type HouseRules = {
  zimoFan: ZimoFan
}

export const DEFAULT_HOUSE_RULES: HouseRules = { zimoFan: 'plusOne' }

export function isValidZimoFan(value: unknown): value is ZimoFan {
  return value === 'none' || value === 'plusOne'
}

export function readHouseRules(value: unknown): HouseRules {
  if (
    value &&
    typeof value === 'object' &&
    isValidZimoFan((value as HouseRules).zimoFan)
  ) {
    return { zimoFan: (value as HouseRules).zimoFan }
  }
  return { zimoFan: 'none' }
}

export function requireHouseRules(value: unknown): HouseRules {
  if (value == null) return { ...DEFAULT_HOUSE_RULES }
  if (
    value &&
    typeof value === 'object' &&
    isValidZimoFan((value as HouseRules).zimoFan)
  ) {
    return { zimoFan: (value as HouseRules).zimoFan }
  }
  throw new Error('houseRules.zimoFan must be none or plusOne')
}

export function zimoFanLabel(zimoFan: ZimoFan): string {
  return zimoFan === 'plusOne' ? '自摸加一番' : '自摸不加番'
}
