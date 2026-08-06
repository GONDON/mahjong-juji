import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetMockSessions,
  appendHu,
  createSession,
  endSession,
  getSession,
  liuju,
  listYearSettlements,
  settleCycleManual,
  startCycle,
} from '../miniprogram/services/sessionApi'
import type { HuInput } from '../miniprogram/domain/types'

const pinghuDianpao = (
  winnerId: string,
  dianpaoId: string,
): HuInput => ({
  winnerId,
  winType: 'dianpao',
  dianpaoId,
  basicFan: 'pinghu',
  extras: [],
  genCount: 0,
  mingGang: 0,
  anGang: 0,
})

const bigZimo = (winnerId: string): HuInput => ({
  winnerId,
  winType: 'zimo',
  basicFan: 'qingqidui',
  extras: [],
  genCount: 0,
  mingGang: 0,
  anGang: 0,
})

describe('MVP acceptance (design spec §4–§8)', () => {
  beforeEach(() => {
    __resetMockSessions()
  })

  it('manual script: open → hu → liuju → bankrupt settle → re-pick dealer → year board', async () => {
    // 1. 开房面值 1 元，四人 A/B/C/D，选庄 A
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    let doc = await getSession(sessionId)
    const [idA, idB, idC] = doc.seats.map((s) => s.playerId)
    expect(doc.seats.map((s) => s.nickname)).toEqual(['A', 'B', 'C', 'D'])

    await startCycle(sessionId, idA)

    doc = await getSession(sessionId)
    expect(doc.chipValueYuan).toBe(1)
    expect(doc.currentCycle?.index).toBe(1)
    expect(doc.currentCycle?.dealer).toEqual({ dealerId: idA, streak: 0 })

    // 2. A(庄) 平胡点炮 B → 庄倍×2，B -2 / A +2（§11 非庄平胡才是 ±1）
    await appendHu(sessionId, pinghuDianpao(idA, idB))
    doc = await getSession(sessionId)
    expect(doc.seats[0].chips).toBe(22)
    expect(doc.seats[1].chips).toBe(18)
    expect(doc.currentCycle?.firstHuId).toBe(idA)

    // 3. 流局开下一局：首胡=庄 A → 连庄 +1，庄仍为 A
    await liuju(sessionId)
    doc = await getSession(sessionId)
    expect(doc.currentCycle?.dealer.dealerId).toBe(idA)
    expect(doc.currentCycle?.dealer.streak).toBe(1)
    expect(doc.currentCycle?.firstHuId).toBeNull()

    // 4. 打到有人 0 → 结算 (chips-20)*1，四家 yuan 合计 ≈ 0
    let result = await appendHu(sessionId, bigZimo(idA))
    // If one zimo is not enough (unlikely with 清七对×庄倍), keep draining
    let guard = 0
    while (!result.cycleOver && guard < 40) {
      doc = await getSession(sessionId)
      const alive = doc.seats.filter((s) => !s.hasHu && s.chips > 0)
      const winner = alive[0] ?? doc.seats.find((s) => s.chips > 0)!
      result = await appendHu(sessionId, bigZimo(winner.playerId))
      guard += 1
    }
    expect(result.cycleOver).toBe(true)
    expect(result.settlements).toBeDefined()
    expect(result.settlements!.length).toBe(4)
    const yuanSum = result.settlements!.reduce((a, r) => a + r.yuan, 0)
    expect(yuanSum).toBe(0)

    doc = await getSession(sessionId)
    expect(doc.status).toBe('settling')
    expect(doc.cycles).toHaveLength(1)
    expect(doc.currentCycle).toBeUndefined()

    // 5. 再开一轮 → 手动选庄 C（无骰子），连庄清零
    await startCycle(sessionId, idC)
    doc = await getSession(sessionId)
    expect(doc.currentCycle?.index).toBe(2)
    expect(doc.currentCycle?.dealer).toEqual({ dealerId: idC, streak: 0 })

    // Settle cycle 2 so we can end the night (manual settle of untouched table)
    await settleCycleManual(sessionId)

    // 6. 结束夜局 → 年度榜有数据
    await endSession(sessionId)
    doc = await getSession(sessionId)
    expect(doc.status).toBe('ended')

    const year = new Date(doc.createdAt).getFullYear()
    const rows = await listYearSettlements(year)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.some((r) => r.sessionId === sessionId)).toBe(true)
  })
})
