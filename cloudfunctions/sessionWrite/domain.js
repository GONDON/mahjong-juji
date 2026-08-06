/**
 * Plain-JS port of miniprogram/domain scoring helpers for the cloud function.
 * Keep in sync with TypeScript sources when rules change.
 */

const BASIC = {
  pinghu: 1,
  duidui: 2,
  qingyise: 4,
  qidui: 4,
  jingougou: 4,
  qingdui: 8,
  qingqidui: 16,
  qingjingougou: 16,
}

const EXTRA = {
  gangshanghua: 2,
  gangshangpao: 2,
  qianggang: 2,
  haidi: 2,
  menqing: 2,
  zhongzhang: 2,
  daiyaojiu: 4,
  jiangdui: 4,
  tianhu: 8,
  dihu: 4,
}

function fanProduct(basic, extras, genCount) {
  let m = BASIC[basic] || 1
  for (const e of extras || []) {
    if (e === 'gen') continue
    if (EXTRA[e]) m *= EXTRA[e]
  }
  for (let i = 0; i < (genCount || 0); i++) m *= 2
  return m
}

function freshDealer(dealerId) {
  return { dealerId, streak: 0 }
}

function afterHand(dealer, firstHuId) {
  if (firstHuId == null) return { ...dealer }
  if (firstHuId === dealer.dealerId) {
    return { dealerId: dealer.dealerId, streak: dealer.streak + 1 }
  }
  return { dealerId: firstHuId, streak: 0 }
}

function applyTransfers(seatsIn, transfers) {
  const seats = seatsIn.map((s) => ({ ...s }))
  const byId = new Map(seats.map((s) => [s.playerId, s]))
  const truncated = []
  const bankruptIds = []
  for (const t of transfers) {
    const from = byId.get(t.fromId)
    const to = byId.get(t.toId)
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

function scoreHu(table, input) {
  const { dealer } = table
  const dealerMult =
    input.winnerId === dealer.dealerId ? 2 + dealer.streak : 1
  const fanPart =
    fanProduct(input.basicFan, input.extras, input.genCount) * dealerMult
  const gangPart = (input.mingGang || 0) * 1 + (input.anGang || 0) * 2
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

  const transfers = payers.map((s) => ({
    fromId: s.playerId,
    toId: input.winnerId,
    chips: perPayer,
    reason: 'fee',
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

function commitHu(table, input) {
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

function commitLiuju(dealer) {
  return afterHand(dealer, null)
}

function openNextHand(table) {
  const dealer = afterHand(table.dealer, table.firstHuId)
  return {
    seats: table.seats.map((s) => ({ ...s, hasHu: false })),
    dealer,
    firstHuId: null,
  }
}

function settleCycle(seats, chipValueYuan) {
  return seats.map((s) => {
    const chipDelta = s.chips - 20
    return {
      playerId: s.playerId,
      chipDelta,
      yuan: chipDelta * chipValueYuan,
    }
  })
}

module.exports = {
  freshDealer,
  commitHu,
  commitLiuju,
  openNextHand,
  settleCycle,
}
