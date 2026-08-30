/**
 * Plain-JS port of miniprogram/domain scoring helpers for the cloud function.
 * Keep in sync with TypeScript sources when rules change.
 */

const BASIC = {
  pinghu: 1,
  duidui: 2,
  qingyise: 4,
  qidui: 4,
  longqidui: 16,
  jingougou: 4,
  qingdui: 8,
  qingqidui: 16,
  qinglongqidui: 32,
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

const SEVEN_PAIRS = {
  qidui: true,
  longqidui: true,
  qingqidui: true,
  qinglongqidui: true,
}

function dragonGenDeduct(basic) {
  return basic === 'longqidui' || basic === 'qinglongqidui' ? 1 : 0
}

function fanProduct(basic, extras, genCount) {
  let m = BASIC[basic] || 1
  const list = extras || []
  const selected = {}
  for (const e of list) selected[e] = true
  const skipJiangdui = Boolean(SEVEN_PAIRS[basic])
  const skipZhongzhang = selected.jiangdui || selected.daiyaojiu
  for (const e of list) {
    if (e === 'gen') continue
    if (e === 'jiangdui' && skipJiangdui) continue
    if (e === 'zhongzhang' && skipZhongzhang) continue
    if (EXTRA[e]) m *= EXTRA[e]
  }
  const gens = Math.max(0, (genCount || 0) - dragonGenDeduct(basic))
  for (let i = 0; i < gens; i++) m *= 2
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

function scoreHu(table, input, houseRules) {
  const { dealer } = table
  const dealerMult =
    input.winnerId === dealer.dealerId ? 2 + dealer.streak : 1
  const zimoMult =
    input.winType === 'zimo' && houseRules && houseRules.zimoFan === 'plusOne'
      ? 2
      : 1
  const fanPart =
    fanProduct(input.basicFan, input.extras, input.genCount) *
    zimoMult *
    dealerMult
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

function commitHu(table, input, houseRules) {
  const score = scoreHu(table, input, houseRules)
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

const DEFAULT_STARTING_CHIPS = 20
const STARTING_CHIPS_MIN = 10
const STARTING_CHIPS_MAX = 50
const STARTING_CHIPS_STEP = 5

function isValidStartingChips(value) {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= STARTING_CHIPS_MIN &&
    value <= STARTING_CHIPS_MAX &&
    value % STARTING_CHIPS_STEP === 0
  )
}

function readStartingChips(value) {
  return isValidStartingChips(value) ? value : DEFAULT_STARTING_CHIPS
}

function requireStartingChips(value) {
  if (value == null) return DEFAULT_STARTING_CHIPS
  if (!isValidStartingChips(value)) {
    throw new Error('startingChips must be 10–50 in steps of 5')
  }
  return value
}

function isValidZimoFan(value) {
  return value === 'none' || value === 'plusOne'
}

function readHouseRules(value) {
  if (value && typeof value === 'object' && isValidZimoFan(value.zimoFan)) {
    return { zimoFan: value.zimoFan }
  }
  return { zimoFan: 'none' }
}

function requireHouseRules(value) {
  if (value == null) return { zimoFan: 'plusOne' }
  if (value && typeof value === 'object' && isValidZimoFan(value.zimoFan)) {
    return { zimoFan: value.zimoFan }
  }
  throw new Error('houseRules.zimoFan must be none or plusOne')
}

function settleCycle(seats, chipValueYuan, startingChips) {
  const base = readStartingChips(startingChips)
  return seats.map((s) => {
    const chipDelta = s.chips - base
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
  readStartingChips,
  requireStartingChips,
  readHouseRules,
  requireHouseRules,
}
