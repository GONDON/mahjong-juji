export const DEFAULT_STARTING_CHIPS = 20
export const STARTING_CHIPS_MIN = 10
export const STARTING_CHIPS_MAX = 50
export const STARTING_CHIPS_STEP = 5

export function isValidStartingChips(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= STARTING_CHIPS_MIN &&
    value <= STARTING_CHIPS_MAX &&
    value % STARTING_CHIPS_STEP === 0
  )
}

export function readStartingChips(value: unknown): number {
  return isValidStartingChips(value) ? value : DEFAULT_STARTING_CHIPS
}

export function requireStartingChips(value: unknown): number {
  if (value == null) return DEFAULT_STARTING_CHIPS
  if (!isValidStartingChips(value)) {
    throw new Error('startingChips must be 10–50 in steps of 5')
  }
  return value
}

export function stepStartingChips(current: number, direction: -1 | 1): number {
  const base = readStartingChips(current)
  const next = base + direction * STARTING_CHIPS_STEP
  if (next < STARTING_CHIPS_MIN) return STARTING_CHIPS_MIN
  if (next > STARTING_CHIPS_MAX) return STARTING_CHIPS_MAX
  return next
}
