import { fanProduct } from './fans'
import type { HouseRules } from './houseRules'
import type { HuInput, ScoreHuResult, TableState, Transfer } from './types'

export function scoreHu(
  table: TableState,
  input: HuInput,
  houseRules: HouseRules,
): ScoreHuResult {
  const { dealer } = table
  const dealerMult =
    input.winnerId === dealer.dealerId ? 2 + dealer.streak : 1
  const zimoMult =
    input.winType === 'zimo' && houseRules.zimoFan === 'plusOne' ? 2 : 1
  const fanPart =
    fanProduct(input.basicFan, input.extras, input.genCount) *
    zimoMult *
    dealerMult
  const gangPart = input.mingGang * 1 + input.anGang * 2
  const perPayer = fanPart + gangPart

  if (input.winType === 'dianpao' && !input.dianpaoId) {
    throw new Error('dianpaoId required')
  }

  const payers =
    input.winType === 'zimo'
      ? table.seats.filter(
          (s) => !s.hasHu && s.playerId !== input.winnerId && s.chips > 0,
        )
      : table.seats.filter((s) => s.playerId === input.dianpaoId)

  const transfers: Transfer[] = payers.map((s) => ({
    fromId: s.playerId,
    toId: input.winnerId,
    chips: perPayer,
    reason: 'fee' as const,
  }))

  return {
    transfers,
    perPayer,
    fanPart,
    gangPart,
    dealerMult,
    bankruptTriggered: false,
  }
}
