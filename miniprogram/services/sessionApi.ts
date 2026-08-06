/**
 * sessionApi — persistence facade for night sessions.
 *
 * Cloud collections (Task 9b wires real wx.cloud):
 * - sessions: _id, roomCode, chipValueYuan, scorerOpenId/scorerId,
 *   seats[{playerId,nickname,openId?}], status, circleId?, createdAt
 * - cycles: sessionId, index, dealerPickId, settlements[], status
 * - hands: cycleId, index, dealerId, streak, firstHuId, liuju
 * - huEvents: handId, payload (HuInput + score snapshot + transfers)
 *
 * USE_MOCK=true keeps an in-memory Map so UI can run without WeChat cloud.
 */

import { freshDealer } from '../domain/dealer'
import { commitHu, commitLiuju, openNextHand } from '../domain/handFlow'
import type { SessionPlayerYuan } from '../domain/leaderboard'
import { settleCycle, type CycleSettlementRow } from '../domain/settleCycle'
import type {
  DealerState,
  HuInput,
  PlayerId,
  ScoreHuResult,
  Seat,
  TableState,
  Transfer,
} from '../domain/types'

export const USE_MOCK = true

export type SessionStatus = 'open' | 'playing' | 'settling' | 'ended'

export interface SessionSeat {
  playerId: PlayerId
  nickname: string
  chips: number
  hasHu: boolean
}

export interface CurrentCycle {
  index: number
  dealer: DealerState
  firstHuId: PlayerId | null
}

export interface SettledCycle {
  index: number
  dealerPickId: PlayerId
  settlements: CycleSettlementRow[]
  status: 'settled'
}

export interface HandRecord {
  index: number
  cycleIndex: number
  dealerId: PlayerId
  streak: number
  firstHuId: PlayerId | null
  liuju: boolean
}

export interface HuEventRecord {
  handIndex: number
  input: HuInput
  score: ScoreHuResult
  truncated: Transfer[]
}

export interface SessionDoc {
  sessionId: string
  roomCode: string
  chipValueYuan: number
  scorerId: string
  seats: SessionSeat[]
  status: SessionStatus
  currentCycle?: CurrentCycle
  cycles: SettledCycle[]
  hands: HandRecord[]
  huEvents: HuEventRecord[]
  createdAt: number
}

export interface CommitResult {
  table: TableState
  score: ScoreHuResult
  truncated: Transfer[]
  bankruptIds: PlayerId[]
  cycleOver: boolean
  settlements?: CycleSettlementRow[]
}

interface MockEntry {
  doc: SessionDoc
  /** Table snapshots taken before each hu in the current hand (for undo). */
  undoStack: TableState[]
  dealerPickId?: PlayerId
}

const mockStore = new Map<string, MockEntry>()
const roomIndex = new Map<string, string>()

let seq = 0

function nextId(prefix: string): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}_${seq}`
}

function genRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = ''
    for (let i = 0; i < 4; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    if (!roomIndex.has(code)) return code
  }
  throw new Error('failed to allocate roomCode')
}

function cloneSeats(seats: Seat[]): Seat[] {
  return seats.map((s) => ({ ...s }))
}

function cloneDoc(doc: SessionDoc): SessionDoc {
  return structuredClone(doc)
}

function requireMock(sessionId: string): MockEntry {
  const entry = mockStore.get(sessionId)
  if (!entry) throw new Error(`session not found: ${sessionId}`)
  return entry
}

function tableFrom(doc: SessionDoc): TableState {
  if (!doc.currentCycle) throw new Error('no active cycle')
  return {
    seats: cloneSeats(doc.seats),
    dealer: { ...doc.currentCycle.dealer },
    firstHuId: doc.currentCycle.firstHuId,
  }
}

function applyTable(doc: SessionDoc, table: TableState): void {
  doc.seats = cloneSeats(table.seats)
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

function settleCurrent(entry: MockEntry): CycleSettlementRow[] {
  const { doc } = entry
  if (!doc.currentCycle) throw new Error('no active cycle to settle')
  const settlements = settleCycle(doc.seats, doc.chipValueYuan)
  doc.cycles.push({
    index: doc.currentCycle.index,
    dealerPickId: entry.dealerPickId ?? doc.currentCycle.dealer.dealerId,
    settlements,
    status: 'settled',
  })
  doc.currentCycle = undefined
  entry.dealerPickId = undefined
  entry.undoStack = []
  doc.status = 'settling'
  return settlements
}

function notImplemented(): never {
  throw new Error('cloud sessionApi not implemented; set USE_MOCK=true')
}

/** Test helper: clear in-memory mock store. */
export function __resetMockSessions(): void {
  mockStore.clear()
  roomIndex.clear()
  seq = 0
}

export async function createSession(input: {
  chipValueYuan: number
  nicknames: [string, string, string, string]
}): Promise<{ sessionId: string; roomCode: string }> {
  if (!USE_MOCK) notImplemented()

  const sessionId = nextId('sess')
  const roomCode = genRoomCode()
  const seats: SessionSeat[] = input.nicknames.map((nickname, i) => ({
    playerId: `p${i}`,
    nickname,
    chips: 0,
    hasHu: false,
  }))

  const doc: SessionDoc = {
    sessionId,
    roomCode,
    chipValueYuan: input.chipValueYuan,
    scorerId: 'mock-scorer',
    seats,
    status: 'open',
    cycles: [],
    hands: [],
    huEvents: [],
    createdAt: Date.now(),
  }

  mockStore.set(sessionId, { doc, undoStack: [] })
  roomIndex.set(roomCode, sessionId)
  return { sessionId, roomCode }
}

export async function getSession(sessionId: string): Promise<SessionDoc> {
  if (!USE_MOCK) notImplemented()
  return cloneDoc(requireMock(sessionId).doc)
}

export async function getSessionByRoomCode(
  roomCode: string,
): Promise<SessionDoc | null> {
  if (!USE_MOCK) notImplemented()
  const sessionId = roomIndex.get(roomCode.toUpperCase())
  if (!sessionId) return null
  return cloneDoc(requireMock(sessionId).doc)
}

export async function startCycle(
  sessionId: string,
  dealerId: string,
): Promise<void> {
  if (!USE_MOCK) notImplemented()
  const entry = requireMock(sessionId)
  const { doc } = entry
  if (doc.status === 'ended') throw new Error('session ended')
  if (doc.currentCycle) throw new Error('cycle already in progress')

  const dealer = freshDealer(dealerId)
  const seats = doc.seats.map((s) => ({
    ...s,
    chips: 20,
    hasHu: false,
  }))
  const cycleIndex = doc.cycles.length + 1

  doc.seats = seats
  doc.currentCycle = {
    index: cycleIndex,
    dealer,
    firstHuId: null,
  }
  entry.dealerPickId = dealerId
  entry.undoStack = []
  doc.status = 'playing'
  doc.hands.push({
    index: doc.hands.length + 1,
    cycleIndex,
    dealerId: dealer.dealerId,
    streak: dealer.streak,
    firstHuId: null,
    liuju: false,
  })
}

export async function appendHu(
  sessionId: string,
  input: HuInput,
): Promise<CommitResult> {
  if (!USE_MOCK) notImplemented()
  const entry = requireMock(sessionId)
  const { doc } = entry
  if (doc.status !== 'playing' || !doc.currentCycle) {
    throw new Error('no playing cycle')
  }

  const before = tableFrom(doc)
  entry.undoStack.push(before)

  const result = commitHu(before, input)
  applyTable(doc, result.table)

  const hand = doc.hands[doc.hands.length - 1]
  doc.huEvents.push({
    handIndex: hand?.index ?? doc.hands.length,
    input,
    score: result.score,
    truncated: result.truncated,
  })

  let settlements: CycleSettlementRow[] | undefined
  if (result.cycleOver) {
    settlements = settleCurrent(entry)
  }

  return {
    table: result.table,
    score: result.score,
    truncated: result.truncated,
    bankruptIds: result.bankruptIds,
    cycleOver: result.cycleOver,
    settlements,
  }
}

export async function liuju(sessionId: string): Promise<void> {
  if (!USE_MOCK) notImplemented()
  const entry = requireMock(sessionId)
  const { doc } = entry
  if (doc.status !== 'playing' || !doc.currentCycle) {
    throw new Error('no playing cycle')
  }

  const table = tableFrom(doc)
  const hand = doc.hands[doc.hands.length - 1]
  if (hand) {
    hand.liuju = true
    hand.firstHuId = table.firstHuId
  }

  // 流局: dealer/streak unchanged, then open next hand (clear hasHu / firstHuId)
  const next = openNextHand({
    ...table,
    dealer: commitLiuju(table.dealer),
    firstHuId: null,
  })

  applyTable(doc, next)
  entry.undoStack = []
  doc.hands.push({
    index: doc.hands.length + 1,
    cycleIndex: doc.currentCycle!.index,
    dealerId: next.dealer.dealerId,
    streak: next.dealer.streak,
    firstHuId: null,
    liuju: false,
  })
}

export async function undoLastHu(sessionId: string): Promise<SessionDoc> {
  if (!USE_MOCK) notImplemented()
  const entry = requireMock(sessionId)
  const { doc } = entry
  if (entry.undoStack.length === 0 || doc.huEvents.length === 0) {
    throw new Error('nothing to undo')
  }

  const snap = entry.undoStack.pop()!
  const last = doc.huEvents[doc.huEvents.length - 1]
  const hand = doc.hands[doc.hands.length - 1]
  if (!hand || hand.liuju || last.handIndex !== hand.index) {
    entry.undoStack.push(snap)
    throw new Error('undo only within current hand')
  }

  doc.huEvents.pop()
  applyTable(doc, snap)
  return cloneDoc(doc)
}

export async function settleCycleManual(
  sessionId: string,
): Promise<CycleSettlementRow[]> {
  if (!USE_MOCK) notImplemented()
  const entry = requireMock(sessionId)
  if (entry.doc.status !== 'playing' || !entry.doc.currentCycle) {
    throw new Error('no playing cycle')
  }
  return settleCurrent(entry)
}

export async function endSession(sessionId: string): Promise<void> {
  if (!USE_MOCK) notImplemented()
  const entry = requireMock(sessionId)
  if (entry.doc.currentCycle) {
    throw new Error('settle current cycle before ending session')
  }
  entry.doc.status = 'ended'
}

export async function listYearSettlements(
  year: number,
): Promise<SessionPlayerYuan[]> {
  if (!USE_MOCK) notImplemented()
  const rows: SessionPlayerYuan[] = []
  for (const { doc } of mockStore.values()) {
    if (doc.status !== 'ended') continue
    const y = new Date(doc.createdAt).getFullYear()
    if (y !== year) continue
    for (const cycle of doc.cycles) {
      for (const s of cycle.settlements) {
        rows.push({
          sessionId: doc.sessionId,
          playerId: s.playerId,
          yuan: s.yuan,
        })
      }
    }
  }
  return rows
}
