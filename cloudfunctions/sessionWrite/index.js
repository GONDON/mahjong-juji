/**
 * sessionWrite — scorer-gated session API for WeChat cloud.
 *
 * Client: wx.cloud.callFunction({ name: 'sessionWrite', data: { action, ... } })
 * Actions: createSession, getSession, getSessionByRoomCode, startCycle,
 *   appendHu, liuju, undoLastHu, settleCycleManual, endSession, listYearSettlements
 *
 * Collections: denormalized `sessions` docs (same shape as mock SessionDoc +
 * scorerOpenId, undoStack, dealerPickId).
 */

const cloud = require('wx-server-sdk')
const {
  freshDealer,
  commitHu,
  commitLiuju,
  openNextHand,
  settleCycle,
} = require('./domain')

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

function assertScorer(doc, openid) {
  if (!openid) throw new Error('missing openid')
  if (doc.scorerOpenId && doc.scorerOpenId !== openid) {
    throw new Error('only the scorer can write this session')
  }
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

function settleCurrent(doc) {
  if (!doc.currentCycle) throw new Error('no active cycle to settle')
  const settlements = settleCycle(doc.seats, doc.chipValueYuan)
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
  const { chipValueYuan, nicknames } = event
  if (!Array.isArray(nicknames) || nicknames.length !== 4) {
    throw new Error('nicknames must be 4 strings')
  }
  const col = sessionsCol()
  const roomCode = genRoomCode()
  const seats = nicknames.map((nickname, i) => ({
    playerId: `p${i}`,
    nickname,
    chips: 0,
    hasHu: false,
  }))
  const createdAt = Date.now()
  const addRes = await col.add({
    data: {
      roomCode,
      chipValueYuan,
      scorerOpenId: openid || '',
      scorerId: openid || 'unknown',
      seats,
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
  const next = openNextHand({
    ...table,
    dealer: commitLiuju(table.dealer),
    firstHuId: null,
  })
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
        })
      }
    }
  }
  return rows
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
