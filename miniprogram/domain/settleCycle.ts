import type { PlayerId, Seat } from './types'

export interface CycleSettlementRow {
  playerId: PlayerId
  chipDelta: number
  yuan: number
}

export function settleCycle(
  seats: Seat[],
  chipValueYuan: number,
  startingChips = 20,
): CycleSettlementRow[] {
  return seats.map((s) => {
    const chipDelta = s.chips - startingChips
    return {
      playerId: s.playerId,
      chipDelta,
      yuan: chipDelta * chipValueYuan,
    }
  })
}
