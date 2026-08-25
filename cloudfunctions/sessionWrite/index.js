/**
 * sessionWrite — scorer-gated session API for WeChat cloud.
 *
 * Client: wx.cloud.callFunction({ name: 'sessionWrite', data: { action, ... } })
 * Actions: createSession, getSession, getSessionByRoomCode, startCycle,
 *   appendHu, liuju, undoLastHu, settleCycleManual, endSession, listYearSettlements,
 *   whoami, getCharacter, upsertCharacter, enterSession, claimSeat, unclaimSeat,
 *   scorerUnclaimSeat, scorerRenameSeat
 *
 * Collections: denormalized `sessions` docs (same shape as mock SessionDoc +
 * scorerOpenId, undoStack, dealerPickId); `users` docs keyed by openId.
 */

const cloud = require('wx-server-sdk')
const {
  freshDealer,
  commitHu,
  openNextHand,
  settleCycle,
} = require('./domain')
const {
  isCharacterComplete,
  memberSnapshot,
  validateCharacter,
} = require('./character')
const {
  canMutateSeats,
  upsertMember,
  claimSeat: applyClaimSeat,
  unclaimSeat: applyUnclaimSeat,
  scorerUnclaimSeat: applyScorerUnclaimSeat,
  renameUnclaimedSeat,
} = require('./presence')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const DB_HINT =
  'Cloud database not configured. Create a WeChat cloud env, deploy this function, and set USE_MOCK=false. See docs/cloud-setup.md'

function ok(data) {
  return { ok: true, data }
}

function fail(error) {
  return { ok: false, error: String(error) }
}

function getDb() {
  try {
    return cloud.database()
  } catch (e) {
    throw new Error(DB_HINT)
  }
}

function sessionsCol() {
  return getDb().collection('sessions')
}

function usersCol() {
  return getDb().collection('users')
}

function publicDoc(doc) {
  if (!doc) return null
  const {
    undoStack: _u,
    dealerPickId: _d,
    _id,
    ...rest
  } = doc
  return { ...rest, sessionId: rest.sessionId || _id }
}

function tableFrom(doc) {
  if (!doc.currentCycle) throw new Error('no active cycle')
  return {
    seats: doc.seats.map((s) => ({ ...s })),
    dealer: { ...doc.currentCycle.dealer },
    firstHuId: doc.currentCycle.firstHuId,
  }
}

function applyTable(doc, table) {
  doc.seats = table.seats.map((s) => ({ ...s }))
  if (doc.currentCycle) {
    doc.currentCycle.dealer = { ...table.dealer }
    doc.currentCycle.firstHuId = table.firstHuId
  }
  const hand = doc.hands[doc.hands.length - 1]
  if (hand && !hand.liuju) {
    hand.firstHuId = table.firstHuId
    hand.dealerId = table.dealer.dealerId
    hand.streak = table.dealer.streak
  }
}

/** Merge claimable seat fields while preserving chips / hasHu. */
function applyClaimableSeats(doc, next) {
  doc.seats = next.map((s, i) => {
    const prev = doc.seats[i]
    const seat = {
      playerId: s.playerId,
      nickname: s.nickname,
      chips: prev && prev.chips != null ? prev.chips : 0,
      hasHu: prev && prev.hasHu != null ? prev.hasHu : false,
    }
    if (s.claimedOpenId) seat.claimedOpenId = s.claimedOpenId
    if (s.avatarId) seat.avatarId = s.avatarId
    return seat
  })
}

function assertScorer(doc, openid) {
  if (!openid) throw new Error('missing openid')
  // Empty scorerOpenId is an invalid session — do not skip the gate.
  if (doc.scorerOpenId !== openid) {
    throw new Error('only the scorer can write this session')
  }
}

function requireOpenId(openid) {
  if (!openid) throw new Error('missing openid')
  return openid
}

/** trim + lower + collapse spaces; year board keys by playerId = nid_${norm}. */
function normalizeNickname(nickname) {
  return String(nickname || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Stable year identity from nickname; duplicate nicknames in one session get `_seat${i}`. */
function playerIdsFromNicknames(nicknames) {
  const seen = new Set()
  return nicknames.map((nickname, i) => {
    const base = `nid_${normalizeNickname(nickname)}`
    if (seen.has(base)) return `${base}_seat${i}`
    seen.add(base)
    return base
  })
}

async function loadById(sessionId) {
  const col = sessionsCol()
  const res = await col.doc(sessionId).get()
  if (!res.data) throw new Error(`session not found: ${sessionId}`)
  return { col, doc: res.data, id: sessionId }
}

async function save(id, doc) {
  const { _id, ...payload } = doc
  await sessionsCol().doc(id).set({ data: payload })
}

async function loadUserCard(openid) {
  try {
    const res = await usersCol().doc(openid).get()
    const data = res.data
    if (!data || (typeof data === 'object' && !data.openId && !data.nickname)) {
      return null
    }
    return data
  } catch (e) {
    const msg = (e && e.message) || String(e)
    // Missing user doc is normal; collection / env failures must surface.
    if (/does not exist|DOCUMENT_NOT_EXIST|not found/i.test(msg)) return null
    throw e
  }
}

function settleCurrent(doc) {
  if (!doc.currentCycle) throw new Error('no active cycle to settle')
  const settlements = settleCycle(doc.seats, doc.chipValueYuan).map((row, i) => ({
    ...row,
    openId: (doc.seats[i] && doc.seats[i].claimedOpenId) || null,
    nickname:
      (doc.seats[i] && doc.seats[i].nickname) || row.playerId,
  }))
  doc.cycles.push({
    index: doc.currentCycle.index,
    dealerPickId: doc.dealerPickId || doc.currentCycle.dealer.dealerId,
    settlements,
    status: 'settled',
  })
  doc.currentCycle = null
  doc.dealerPickId = null
  doc.undoStack = []
  doc.status = 'settling'
  return settlements
}

function genRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return code
}

async function createSession(event, openid) {
  if (!openid) throw new Error('missing openid')
  const { chipValueYuan, nicknames } = event
  if (!Array.isArray(nicknames) || nicknames.length !== 4) {
    throw new Error('nicknames must be 4 strings')
  }
  const col = sessionsCol()
  const roomCode = genRoomCode()
  const playerIds = playerIdsFromNicknames(nicknames)
  const seats = nicknames.map((nickname, i) => ({
    playerId: playerIds[i],
    nickname,
    chips: 0,
    hasHu: false,
  }))
  const createdAt = Date.now()
  const userDoc = await loadUserCard(openid)
  const snap = memberSnapshot(userDoc)
  const members = [{ openId: openid, ...snap, joinedAt: createdAt }]
  const addRes = await col.add({
    data: {
      roomCode,
      chipValueYuan,
      scorerOpenId: openid,
      scorerId: openid,
      seats,
      members,
      status: 'open',
      cycles: [],
      hands: [],
      huEvents: [],
      undoStack: [],
      createdAt,
    },
  })
  const sessionId = addRes._id
  await col.doc(sessionId).update({ data: { sessionId } })
  return { sessionId, roomCode }
}

async function getSession(event) {
  const { doc } = await loadById(event.sessionId)
  return publicDoc(doc)
}

async function getSessionByRoomCode(event) {
  const code = String(event.roomCode || '').toUpperCase()
  const res = await sessionsCol().where({ roomCode: code }).limit(1).get()
  if (!res.data || res.data.length === 0) return null
  return publicDoc(res.data[0])
}

async function startCycle(event, openid) {
  const { sessionId, dealerId } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (doc.status === 'ended') throw new Error('session ended')
  if (doc.currentCycle) throw new Error('cycle already in progress')

  const dealer = freshDealer(dealerId)
  // Preserve claimedOpenId / avatarId / display nickname while resetting chips.
  const seats = doc.seats.map((s) => ({ ...s, chips: 20, hasHu: false }))
  const cycleIndex = (doc.cycles || []).length + 1
  doc.seats = seats
  doc.currentCycle = { index: cycleIndex, dealer, firstHuId: null }
  doc.dealerPickId = dealerId
  doc.undoStack = []
  doc.status = 'playing'
  doc.hands = doc.hands || []
  doc.hands.push({
    index: doc.hands.length + 1,
    cycleIndex,
    dealerId: dealer.dealerId,
    streak: dealer.streak,
    firstHuId: null,
    liuju: false,
  })
  await save(id, doc)
  return null
}

async function appendHu(event, openid) {
  const { sessionId, input } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (doc.status !== 'playing' || !doc.currentCycle) {
    throw new Error('no playing cycle')
  }
  const before = tableFrom(doc)
  doc.undoStack = doc.undoStack || []
  doc.undoStack.push(before)
  const result = commitHu(before, input)
  applyTable(doc, result.table)
  const hand = doc.hands[doc.hands.length - 1]
  doc.huEvents = doc.huEvents || []
  doc.huEvents.push({
    handIndex: hand ? hand.index : doc.hands.length,
    input,
    score: result.score,
    truncated: result.truncated,
  })
  let settlements
  if (result.cycleOver) {
    settlements = settleCurrent(doc)
  }
  await save(id, doc)
  return {
    table: result.table,
    score: result.score,
    truncated: result.truncated,
    bankruptIds: result.bankruptIds,
    cycleOver: result.cycleOver,
    settlements,
  }
}

async function liuju(event, openid) {
  const { sessionId } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (doc.status !== 'playing' || !doc.currentCycle) {
    throw new Error('no playing cycle')
  }
  const table = tableFrom(doc)
  const hand = doc.hands[doc.hands.length - 1]
  if (hand) {
    hand.liuju = true
    hand.firstHuId = table.firstHuId
  }
  // Preserve firstHuId for dealer progression (pure 流局 → unchanged).
  const next = openNextHand(table)
  applyTable(doc, next)
  doc.undoStack = []
  doc.hands.push({
    index: doc.hands.length + 1,
    cycleIndex: doc.currentCycle.index,
    dealerId: next.dealer.dealerId,
    streak: next.dealer.streak,
    firstHuId: null,
    liuju: false,
  })
  await save(id, doc)
  return null
}

async function undoLastHu(event, openid) {
  const { sessionId } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  doc.undoStack = doc.undoStack || []
  doc.huEvents = doc.huEvents || []
  if (doc.undoStack.length === 0 || doc.huEvents.length === 0) {
    throw new Error('nothing to undo')
  }
  const snap = doc.undoStack.pop()
  const last = doc.huEvents[doc.huEvents.length - 1]
  const hand = doc.hands[doc.hands.length - 1]
  if (!hand || hand.liuju || last.handIndex !== hand.index) {
    doc.undoStack.push(snap)
    throw new Error('undo only within current hand')
  }
  doc.huEvents.pop()
  applyTable(doc, snap)
  await save(id, doc)
  return publicDoc(doc)
}

async function settleCycleManual(event, openid) {
  const { sessionId } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (doc.status !== 'playing' || !doc.currentCycle) {
    throw new Error('no playing cycle')
  }
  const settlements = settleCurrent(doc)
  await save(id, doc)
  return settlements
}

async function endSession(event, openid) {
  const { sessionId } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (doc.currentCycle) {
    throw new Error('settle current cycle before ending session')
  }
  doc.status = 'ended'
  await save(id, doc)
  return null
}

async function listYearSettlements(event) {
  const year = Number(event.year)
  const res = await sessionsCol().where({ status: 'ended' }).limit(100).get()
  const rows = []
  for (const doc of res.data || []) {
    if (new Date(doc.createdAt).getFullYear() !== year) continue
    for (const cycle of doc.cycles || []) {
      for (const s of cycle.settlements || []) {
        rows.push({
          sessionId: doc.sessionId || doc._id,
          playerId: s.playerId,
          yuan: s.yuan,
          openId: s.openId != null ? s.openId : null,
        })
      }
    }
  }
  return rows
}

function whoami(openid) {
  return { openId: requireOpenId(openid) }
}

async function getCharacter(openid) {
  requireOpenId(openid)
  return loadUserCard(openid)
}

async function upsertCharacter(event, openid) {
  requireOpenId(openid)
  const validated = validateCharacter(event.nickname, event.avatarId)
  if (!validated.ok) throw new Error(validated.message)

  const card = {
    openId: openid,
    nickname: validated.nickname,
    avatarId: validated.avatarId,
    updatedAt: Date.now(),
  }
  await usersCol().doc(openid).set({ data: card })

  if (event.sessionId) {
    const { doc, id } = await loadById(event.sessionId)
    doc.members = upsertMember(
      doc.members || [],
      {
        openId: openid,
        nickname: card.nickname,
        avatarId: card.avatarId,
      },
      Date.now(),
    )
    doc.seats = (doc.seats || []).map((s) =>
      s.claimedOpenId === openid
        ? { ...s, nickname: card.nickname, avatarId: card.avatarId }
        : s,
    )
    await save(id, doc)
  }

  return card
}

async function enterSession(event, openid) {
  requireOpenId(openid)
  let sessionId = event.sessionId
  let doc
  let id

  if (sessionId) {
    ;({ doc, id } = await loadById(sessionId))
  } else if (event.roomCode) {
    const code = String(event.roomCode || '').toUpperCase()
    const res = await sessionsCol().where({ roomCode: code }).limit(1).get()
    if (!res.data || res.data.length === 0) throw new Error('session not found')
    doc = res.data[0]
    id = doc.sessionId || doc._id
  } else {
    throw new Error('session not found')
  }

  const userDoc = await loadUserCard(openid)
  const snap = memberSnapshot(userDoc)
  doc.members = upsertMember(
    doc.members || [],
    { openId: openid, ...snap },
    Date.now(),
  )
  await save(id, doc)
  return publicDoc(doc)
}

async function claimSeat(event, openid) {
  requireOpenId(openid)
  const { sessionId, playerId } = event
  const card = await loadUserCard(openid)
  if (!isCharacterComplete(card)) {
    throw new Error('character incomplete')
  }
  const snap = memberSnapshot(card)
  const db = getDb()
  const result = await db.runTransaction(async (transaction) => {
    const res = await transaction.collection('sessions').doc(sessionId).get()
    if (!res.data) throw new Error(`session not found: ${sessionId}`)
    const doc = res.data
    if (!canMutateSeats(doc.status)) {
      throw new Error('session not open for seats')
    }
    doc.members = doc.members || []
    if (!doc.members.some((m) => m.openId === openid)) {
      doc.members = upsertMember(
        doc.members,
        { openId: openid, ...snap },
        Date.now(),
      )
    }
    const target = (doc.seats || []).find((s) => s.playerId === playerId)
    if (target && target.claimedOpenId && target.claimedOpenId !== openid) {
      throw new Error('seat occupied')
    }
    const claimed = applyClaimSeat(doc.seats, playerId, {
      openId: openid,
      nickname: snap.nickname,
      avatarId: snap.avatarId,
    })
    if (!claimed.ok) {
      if (claimed.error === 'occupied') throw new Error('seat occupied')
      throw new Error(claimed.error)
    }
    applyClaimableSeats(doc, claimed.seats)
    const { _id, ...payload } = doc
    await transaction.collection('sessions').doc(sessionId).set({ data: payload })
    return publicDoc(doc)
  })
  return result
}

async function unclaimSeat(event, openid) {
  requireOpenId(openid)
  const { sessionId, playerId } = event
  const { doc, id } = await loadById(sessionId)
  if (!canMutateSeats(doc.status)) {
    throw new Error('session not open for seats')
  }
  const result = applyUnclaimSeat(doc.seats, playerId, openid)
  if (!result.ok) {
    throw new Error(result.error === 'not_owner' ? 'not owner' : result.error)
  }
  applyClaimableSeats(doc, result.seats)
  await save(id, doc)
  return publicDoc(doc)
}

async function scorerUnclaimSeat(event, openid) {
  const { sessionId, playerId } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (!canMutateSeats(doc.status)) {
    throw new Error('session not open for seats')
  }
  const result = applyScorerUnclaimSeat(doc.seats, playerId)
  if (!result.ok) {
    throw new Error(result.error)
  }
  applyClaimableSeats(doc, result.seats)
  await save(id, doc)
  return publicDoc(doc)
}

async function scorerRenameSeat(event, openid) {
  const { sessionId, playerId, nickname } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (!canMutateSeats(doc.status)) {
    throw new Error('session not open for seats')
  }
  const result = renameUnclaimedSeat(doc.seats, playerId, nickname)
  if (!result.ok) {
    throw new Error(result.error)
  }
  applyClaimableSeats(doc, result.seats)
  await save(id, doc)
  return publicDoc(doc)
}

exports.main = async function main(event = {}) {
  const { OPENID } = cloud.getWXContext()
  const action = event.action
  try {
    switch (action) {
      case 'createSession':
        return ok(await createSession(event, OPENID))
      case 'getSession':
        return ok(await getSession(event))
      case 'getSessionByRoomCode':
        return ok(await getSessionByRoomCode(event))
      case 'startCycle':
        return ok(await startCycle(event, OPENID))
      case 'appendHu':
        return ok(await appendHu(event, OPENID))
      case 'liuju':
        return ok(await liuju(event, OPENID))
      case 'undoLastHu':
        return ok(await undoLastHu(event, OPENID))
      case 'settleCycleManual':
        return ok(await settleCycleManual(event, OPENID))
      case 'endSession':
        return ok(await endSession(event, OPENID))
      case 'listYearSettlements':
        return ok(await listYearSettlements(event))
      case 'whoami':
        return ok(whoami(OPENID))
      case 'getCharacter':
        return ok(await getCharacter(OPENID))
      case 'upsertCharacter':
        return ok(await upsertCharacter(event, OPENID))
      case 'enterSession':
        return ok(await enterSession(event, OPENID))
      case 'claimSeat':
        return ok(await claimSeat(event, OPENID))
      case 'unclaimSeat':
        return ok(await unclaimSeat(event, OPENID))
      case 'scorerUnclaimSeat':
        return ok(await scorerUnclaimSeat(event, OPENID))
      case 'scorerRenameSeat':
        return ok(await scorerRenameSeat(event, OPENID))
      default:
        return fail(`unknown action: ${action}`)
    }
  } catch (e) {
    const msg = (e && e.message) || String(e)
    if (/DATABASE|collection|env|not exist|PERMISSION|init/i.test(msg)) {
      return fail(DB_HINT + ` (${msg})`)
    }
    return fail(msg)
  }
}
