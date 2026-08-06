import type { PlayerId, Seat, Transfer } from './types'

export function applyTransfers(
  seatsIn: Seat[],
  transfers: Transfer[],
): {
  seats: Seat[]
  truncated: Transfer[]
  bankruptIds: PlayerId[]
} {
  const seats = seatsIn.map((s) => ({ ...s }))
  const byId = new Map(seats.map((s) => [s.playerId, s]))
  const truncated: Transfer[] = []
  const bankruptIds: PlayerId[] = []

  for (const t of transfers) {
    const from = byId.get(t.fromId)!
    const to = byId.get(t.toId)!
    const paid = Math.min(from.chips, t.chips)
    from.chips -= paid
    to.chips += paid
    truncated.push({ ...t, chips: paid })
    if (from.chips === 0 && !bankruptIds.includes(from.playerId)) {
      bankruptIds.push(from.playerId)
    }
  }

  return { seats, truncated, bankruptIds }
}
