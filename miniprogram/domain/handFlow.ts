import { applyTransfers } from './chips'
import { afterHand } from './dealer'
import { scoreHu } from './scoreHu'
import type {
  DealerState,
  HuInput,
  PlayerId,
  ScoreHuResult,
  TableState,
  Transfer,
} from './types'

export function commitHu(
  table: TableState,
  input: HuInput,
): {
  table: TableState
  score: ScoreHuResult
  truncated: Transfer[]
  bankruptIds: PlayerId[]
  cycleOver: boolean
} {
  const score = scoreHu(table, input)
  const applied = applyTransfers(table.seats, score.transfers)
  const seats = applied.seats.map((s) =>
    s.playerId === input.winnerId ? { ...s, hasHu: true } : s,
  )
  const firstHuId = table.firstHuId ?? input.winnerId
  return {
    table: { ...table, seats, firstHuId },
    score: { ...score, bankruptTriggered: applied.bankruptIds.length > 0 },
    truncated: applied.truncated,
    bankruptIds: applied.bankruptIds,
    cycleOver: applied.bankruptIds.length > 0,
  }
}

export function commitLiuju(dealer: DealerState): DealerState {
  return afterHand(dealer, null)
}

export function openNextHand(table: TableState): TableState {
  const dealer = afterHand(table.dealer, table.firstHuId)
  return {
    seats: table.seats.map((s) => ({ ...s, hasHu: false })),
    dealer,
    firstHuId: null,
  }
}
