import type { DealerState, PlayerId } from './types'

export function dealerMult(streak: number): number {
  return 2 + streak
}

export function freshDealer(dealerId: PlayerId): DealerState {
  return { dealerId, streak: 0 }
}

export function afterHand(
  dealer: DealerState,
  firstHuId: PlayerId | null,
): DealerState {
  if (firstHuId == null) return { ...dealer }
  if (firstHuId === dealer.dealerId) {
    return { dealerId: dealer.dealerId, streak: dealer.streak + 1 }
  }
  return { dealerId: firstHuId, streak: 0 }
}
