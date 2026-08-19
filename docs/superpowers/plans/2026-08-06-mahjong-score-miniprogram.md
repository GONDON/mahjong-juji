# 川麻比分小程序 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可在微信开发者工具里跑通的川麻血战记分小程序：开房选庄、四方桌录胡、自动算分/破产结算、年度之神与最拉王双榜。

**Architecture:** 领域算分做成与微信 API 无关的纯 TypeScript（`miniprogram/domain/`），用 Vitest 单测；页面只负责交互与调用云开发读写。云数据库存 Session/Cycle/Hand/HuEvent；记分员唯一写权限。

**Tech Stack:** 微信小程序（TypeScript）+ 微信云开发（云数据库 / 云函数）+ Vitest + Node 18+

**Spec:** `docs/superpowers/specs/2026-08-06-mahjong-score-miniprogram-design.md`

## Global Constraints

- 不内置骰子；每轮开局由记分员点选首庄。
- 杠：仅胡家结算；明杠 +1 / 暗杠 +2；不乘进番积。
- 庄倍 = `2 + 连庄数`，仅胡家 == 本局冻结庄家时乘；算分用开局冻结值。
- 每人每轮 20 牌；`(牌数-20)×面值` 兑人民币；年度榜按人民币。
- MVP 不做：陌生人匹配、记分员转让、欠账、趣味称号墙、骰子。
- 算分与庄家推演必须有单测覆盖 spec §11 用例。

---

## File Structure

```
tcmsp/
  package.json                 # vitest scripts
  vitest.config.ts
  tsconfig.json
  project.config.json          # 微信小程序 / 云开发
  miniprogram/
    app.ts
    app.json
    app.wxss
    domain/
      types.ts                 # 领域类型
      fans.ts                  # 番表与番积
      scoreHu.ts               # 单次胡 → Transfer[]
      dealer.ts                # 下一局庄 / 连庄
      chips.ts                 # 应用转账、破产检测
      settleCycle.ts           # 轮次兑钱
      leaderboard.ts           # 年度累计/场均
    services/
      sessionApi.ts            # 云开发封装（读/写）
    pages/
      index/                   # 首页：开房 / 进房 / 榜
      create/                  # 开房设置（面值、四人昵称）
      dealer-pick/             # 每轮选首庄
      battle/                  # 四方桌战场
      session/                 # 夜局详情与流水
      rank/                    # 年度榜
    components/
      hu-sheet/                # 录胡弹层
  cloudfunctions/
    login/                     # 可选：换 openId
    sessionWrite/              # 校验记分员后写库
  tests/
    fans.test.ts
    scoreHu.test.ts
    dealer.test.ts
    chips.test.ts
    settleCycle.test.ts
    leaderboard.test.ts
```

---

### Task 1: 仓库脚手架 + Vitest

**Files:**
- Create: `package.json`, `vitest.config.ts`, `tsconfig.json`, `project.config.json`, `miniprogram/app.ts`, `miniprogram/app.json`, `miniprogram/app.wxss`, `miniprogram/pages/index/index.ts`, `miniprogram/pages/index/index.wxml`, `miniprogram/pages/index/index.wxss`, `miniprogram/pages/index/index.json`
- Test: N/A（脚手架）

**Interfaces:**
- Produces: `npm test` 可运行（先放一个占位测试）

- [ ] **Step 1: 初始化 npm 与 Vitest**

创建 `package.json`:

```json
{
  "name": "tcmsp",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["miniprogram/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]
}
```

- [ ] **Step 2: 最小小程序入口**

`miniprogram/app.json`:

```json
{
  "pages": [
    "pages/index/index"
  ],
  "window": {
    "navigationBarTitleText": "麻将局记",
    "navigationBarBackgroundColor": "#1a1a1a",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#111111"
  },
  "style": "v2",
  "sitemapLocation": "sitemap.json"
}
```

`miniprogram/app.ts`:

```ts
App({
  onLaunch() {},
})
```

`project.config.json`（`appid` 留给开发者填写）:

```json
{
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "es6": true,
    "enhance": true,
    "minified": true
  },
  "compileType": "miniprogram",
  "appid": "wx365b46bd16ff8a25",
  "projectname": "tcmsp",
  "libVersion": "3.5.5"
}
```

首页四文件先放「麻将局记」标题占位。

- [ ] **Step 3: 占位测试 + 安装**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm install && npm test`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.json project.config.json miniprogram tests/smoke.test.ts
git commit -m "chore: scaffold miniprogram and vitest"
```

---

### Task 2: 领域类型

**Files:**
- Create: `miniprogram/domain/types.ts`
- Test: `tests/types-smoke.test.ts`（仅 import 编译检查，可并入后续测试）

**Interfaces:**
- Produces: `PlayerId`, `Seat`, `WinType`, `BasicFan`, `ExtraFan`, `TableState`, `HuInput`, `Transfer`, `DealerState`

- [ ] **Step 1: 写入类型**

```ts
export type PlayerId = string

export type WinType = 'zimo' | 'dianpao'

export type BasicFan =
  | 'pinghu'
  | 'duidui'
  | 'qingyise'
  | 'qidui'
  | 'jingougou'
  | 'qingdui'
  | 'qingqidui'
  | 'qingjingougou'

export type ExtraFan =
  | 'gangshanghua'
  | 'gangshangpao'
  | 'qianggang'
  | 'haidi'
  | 'gen'
  | 'menqing'
  | 'zhongzhang'
  | 'daiyaojiu'
  | 'jiangdui'
  | 'tianhu'
  | 'dihu'

export interface Seat {
  playerId: PlayerId
  nickname: string
  chips: number
  hasHu: boolean
}

export interface DealerState {
  dealerId: PlayerId
  streak: number // 连庄数；0 = 首庄，庄倍 = 2 + streak
}

export interface TableState {
  seats: Seat[] // length 4
  dealer: DealerState
  firstHuId: PlayerId | null
}

export interface HuInput {
  winnerId: PlayerId
  winType: WinType
  dianpaoId?: PlayerId
  basicFan: BasicFan
  extras: ExtraFan[]
  genCount: number // 根的个数，每个 ×2
  mingGang: number
  anGang: number
}

export interface Transfer {
  fromId: PlayerId
  toId: PlayerId
  chips: number
  reason: 'fan' | 'gang' | 'truncated'
}

export interface ScoreHuResult {
  transfers: Transfer[]
  perPayer: number // 每人应付（截断前）
  fanPart: number
  gangPart: number
  dealerMult: number
  bankruptTriggered: boolean
}
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/domain/types.ts
git commit -m "feat: add domain types for scoring"
```

---

### Task 3: 番表与番积

**Files:**
- Create: `miniprogram/domain/fans.ts`
- Test: `tests/fans.test.ts`

**Interfaces:**
- Consumes: `BasicFan`, `ExtraFan` from `types.ts`
- Produces: `basicFanMult(fan)`, `extraMult(extras, genCount)`, `fanProduct(basic, extras, genCount)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { fanProduct } from '../miniprogram/domain/fans'

describe('fanProduct', () => {
  it('pinghu alone is 1', () => {
    expect(fanProduct('pinghu', [], 0)).toBe(1)
  })

  it('duidui * gangshanghua * one gen = 8', () => {
    expect(fanProduct('duidui', ['gangshanghua'], 1)).toBe(8)
  })

  it('qingyise is 4', () => {
    expect(fanProduct('qingyise', [], 0)).toBe(4)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/fans.test.ts`  
Expected: FAIL cannot find module / fanProduct

- [ ] **Step 3: 实现**

```ts
import type { BasicFan, ExtraFan } from './types'

const BASIC: Record<BasicFan, number> = {
  pinghu: 1,
  duidui: 2,
  qingyise: 4,
  qidui: 4,
  jingougou: 4,
  qingdui: 8,
  qingqidui: 16,
  qingjingougou: 16,
}

const EXTRA: Partial<Record<ExtraFan, number>> = {
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

export function basicFanMult(fan: BasicFan): number {
  return BASIC[fan]
}

export function extraMult(extras: ExtraFan[], genCount: number): number {
  let m = 1
  for (const e of extras) {
    if (e === 'gen') continue
    const v = EXTRA[e]
    if (v) m *= v
  }
  for (let i = 0; i < genCount; i++) m *= 2
  return m
}

export function fanProduct(
  basic: BasicFan,
  extras: ExtraFan[],
  genCount: number,
): number {
  return basicFanMult(basic) * extraMult(extras, genCount)
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/fans.test.ts`

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/fans.ts tests/fans.test.ts
git commit -m "feat: add sichuan fan product calculator"
```

---

### Task 4: 单次胡算分 `scoreHu`

**Files:**
- Create: `miniprogram/domain/scoreHu.ts`
- Test: `tests/scoreHu.test.ts`

**Interfaces:**
- Consumes: `fanProduct`, `TableState`, `HuInput`
- Produces: `scoreHu(table, input): ScoreHuResult`（截断前应付；截断在 Task 5）

规则：
- `dealerMult = winnerId === dealer.dealerId ? 2 + dealer.streak : 1`
- `fanPart = fanProduct * dealerMult`
- `gangPart = mingGang * 1 + anGang * 2`（仅胡家）
- `perPayer = fanPart + gangPart`
- 自摸：每个 `!hasHu && playerId !== winner` 且 chips>0 的人付 `perPayer`
- 点炮：仅 `dianpaoId` 付 `perPayer`
- 先输出未截断 transfers（reason 可先全部 `'fee'`，或拆 fan/gang 两笔——MVP 用单笔 `'fee'`）

- [ ] **Step 1: 写失败测试（覆盖 spec §11.1–4）**

```ts
import { describe, it, expect } from 'vitest'
import { scoreHu } from '../miniprogram/domain/scoreHu'
import type { TableState } from '../miniprogram/domain/types'

function table(partial?: Partial<TableState>): TableState {
  return {
    seats: [
      { playerId: 'a', nickname: 'A', chips: 20, hasHu: false },
      { playerId: 'b', nickname: 'B', chips: 20, hasHu: false },
      { playerId: 'c', nickname: 'C', chips: 20, hasHu: false },
      { playerId: 'd', nickname: 'D', chips: 20, hasHu: false },
    ],
    dealer: { dealerId: 'a', streak: 0 },
    firstHuId: null,
    ...partial,
  }
}

describe('scoreHu', () => {
  it('non-dealer pinghu dianpao: payer pays 1', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.perPayer).toBe(1)
    expect(r.transfers).toEqual([
      { fromId: 'c', toId: 'b', chips: 1, reason: 'fee' },
    ])
  })

  it('dealer first-seat zimo duidui: each of 3 pays 4', () => {
    const r = scoreHu(table(), {
      winnerId: 'a',
      winType: 'zimo',
      basicFan: 'duidui',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.dealerMult).toBe(2)
    expect(r.perPayer).toBe(4)
    expect(r.transfers).toHaveLength(3)
    expect(r.transfers.every((t) => t.chips === 4)).toBe(true)
  })

  it('streak makes mult 4; qingyise zimo +1 ming gang => 17 each', () => {
    const r = scoreHu(table({ dealer: { dealerId: 'a', streak: 2 } }), {
      winnerId: 'a',
      winType: 'zimo',
      basicFan: 'qingyise',
      extras: [],
      genCount: 0,
      mingGang: 1,
      anGang: 0,
    })
    expect(r.dealerMult).toBe(4)
    expect(r.fanPart).toBe(16)
    expect(r.gangPart).toBe(1)
    expect(r.perPayer).toBe(17)
  })

  it('dianpao +1 anGang adds 2', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 1,
    })
    expect(r.perPayer).toBe(3)
    expect(r.transfers[0].chips).toBe(3)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: 实现 `scoreHu`**

```ts
import { fanProduct } from './fans'
import type { HuInput, ScoreHuResult, TableState, Transfer } from './types'

export function scoreHu(table: TableState, input: HuInput): ScoreHuResult {
  const { dealer } = table
  const dealerMult =
    input.winnerId === dealer.dealerId ? 2 + dealer.streak : 1
  const fanPart = fanProduct(input.basicFan, input.extras, input.genCount) * dealerMult
  const gangPart = input.mingGang * 1 + input.anGang * 2
  const perPayer = fanPart + gangPart

  const payers =
    input.winType === 'zimo'
      ? table.seats.filter(
          (s) => !s.hasHu && s.playerId !== input.winnerId && s.chips > 0,
        )
      : table.seats.filter((s) => s.playerId === input.dianpaoId)

  if (input.winType === 'dianpao' && !input.dianpaoId) {
    throw new Error('dianpaoId required')
  }

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
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/scoreHu.ts tests/scoreHu.test.ts
git commit -m "feat: score single hu with fan dealer and gang fees"
```

---

### Task 5: 应用转账 + 破产截断

**Files:**
- Create: `miniprogram/domain/chips.ts`
- Test: `tests/chips.test.ts`

**Interfaces:**
- Consumes: `TableState`, `Transfer`, `ScoreHuResult`
- Produces: `applyTransfers(table, transfers): { table, truncated: Transfer[], bankruptIds: PlayerId[] }`

- [ ] **Step 1: 测试**

```ts
import { describe, it, expect } from 'vitest'
import { applyTransfers } from '../miniprogram/domain/chips'
import type { Seat, Transfer } from '../miniprogram/domain/types'

const seats = (): Seat[] => [
  { playerId: 'a', nickname: 'A', chips: 20, hasHu: false },
  { playerId: 'b', nickname: 'B', chips: 2, hasHu: false },
  { playerId: 'c', nickname: 'C', chips: 20, hasHu: false },
  { playerId: 'd', nickname: 'D', chips: 20, hasHu: false },
]

describe('applyTransfers', () => {
  it('truncates when payer cannot full pay and marks bankrupt', () => {
    const transfers: Transfer[] = [
      { fromId: 'b', toId: 'a', chips: 5, reason: 'fee' },
    ]
    const r = applyTransfers(seats(), transfers)
    expect(r.truncated[0].chips).toBe(2)
    expect(r.seats.find((s) => s.playerId === 'b')!.chips).toBe(0)
    expect(r.seats.find((s) => s.playerId === 'a')!.chips).toBe(22)
    expect(r.bankruptIds).toEqual(['b'])
  })
})
```

- [ ] **Step 2–4: 实现使测试通过**

```ts
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
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/chips.ts tests/chips.test.ts
git commit -m "feat: apply chip transfers with bankruptcy truncate"
```

---

### Task 6: 庄家推演 `nextDealer`

**Files:**
- Create: `miniprogram/domain/dealer.ts`
- Test: `tests/dealer.test.ts`

**Interfaces:**
- Produces:
  - `dealerMult(streak: number): number` → `2 + streak`
  - `afterHand(dealer, firstHuId: PlayerId | null): DealerState`  
    - `firstHuId == null`（流局）→ 原样返回  
    - `firstHuId === dealer.dealerId` → `{ dealerId, streak: streak + 1 }`  
    - else → `{ dealerId: firstHuId, streak: 0 }`
  - `freshDealer(dealerId): DealerState` → `{ dealerId, streak: 0 }`（每轮开局）

- [ ] **Step 1: 测试**

```ts
import { describe, it, expect } from 'vitest'
import { afterHand, freshDealer, dealerMult } from '../miniprogram/domain/dealer'

describe('dealer', () => {
  it('mult is 2+streak', () => {
    expect(dealerMult(0)).toBe(2)
    expect(dealerMult(2)).toBe(4)
  })

  it('liuju keeps dealer', () => {
    expect(afterHand({ dealerId: 'a', streak: 2 }, null)).toEqual({
      dealerId: 'a',
      streak: 2,
    })
  })

  it('dealer first hu increases streak', () => {
    expect(afterHand({ dealerId: 'a', streak: 0 }, 'a')).toEqual({
      dealerId: 'a',
      streak: 1,
    })
  })

  it('non-dealer first hu switches and resets', () => {
    expect(afterHand({ dealerId: 'a', streak: 3 }, 'b')).toEqual({
      dealerId: 'b',
      streak: 0,
    })
  })

  it('freshDealer resets streak', () => {
    expect(freshDealer('c')).toEqual({ dealerId: 'c', streak: 0 })
  })
})
```

- [ ] **Step 2–4: 实现并通过**

```ts
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
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/dealer.ts tests/dealer.test.ts
git commit -m "feat: dealer streak and hand transition rules"
```

---

### Task 7: 轮次结算 + 年度榜聚合

**Files:**
- Create: `miniprogram/domain/settleCycle.ts`, `miniprogram/domain/leaderboard.ts`
- Test: `tests/settleCycle.test.ts`, `tests/leaderboard.test.ts`

**Interfaces:**
- `settleCycle(seats, chipValueYuan): { playerId, chipDelta, yuan }[]`  
  `chipDelta = chips - 20`, `yuan = chipDelta * chipValueYuan`
- `aggregateYear(results, minSessions = 3): { godTotal, godAvg, worstTotal, worstAvg }`  
  每场夜局对每个参与者累加 yuan；场均 = total/sessions；场均榜过滤 `sessions < minSessions`

- [ ] **Step 1: 测试 settle**

```ts
import { describe, it, expect } from 'vitest'
import { settleCycle } from '../miniprogram/domain/settleCycle'

describe('settleCycle', () => {
  it('converts chip delta to yuan', () => {
    const r = settleCycle(
      [
        { playerId: 'a', nickname: 'A', chips: 25, hasHu: false },
        { playerId: 'b', nickname: 'B', chips: 0, hasHu: false },
        { playerId: 'c', nickname: 'C', chips: 20, hasHu: false },
        { playerId: 'd', nickname: 'D', chips: 35, hasHu: false },
      ],
      2,
    )
    expect(r.find((x) => x.playerId === 'a')).toEqual({
      playerId: 'a',
      chipDelta: 5,
      yuan: 10,
    })
    expect(r.find((x) => x.playerId === 'b')!.yuan).toBe(-40)
  })
})
```

- [ ] **Step 2–4: 实现 settle + leaderboard 测试与实现**

`settleCycle.ts`:

```ts
import type { PlayerId, Seat } from './types'

export interface CycleSettlementRow {
  playerId: PlayerId
  chipDelta: number
  yuan: number
}

export function settleCycle(
  seats: Seat[],
  chipValueYuan: number,
): CycleSettlementRow[] {
  return seats.map((s) => {
    const chipDelta = s.chips - 20
    return {
      playerId: s.playerId,
      chipDelta,
      yuan: chipDelta * chipValueYuan,
    }
  })
}
```

`leaderboard.ts`（测试：两人多场，场均门槛过滤）:

```ts
import type { PlayerId } from './types'

export interface SessionPlayerYuan {
  sessionId: string
  playerId: PlayerId
  yuan: number
}

export interface PlayerYearStat {
  playerId: PlayerId
  totalYuan: number
  sessions: number
  avgYuan: number
}

export function buildYearStats(
  rows: SessionPlayerYuan[],
): PlayerYearStat[] {
  const map = new Map<PlayerId, { total: number; sessions: Set<string> }>()
  for (const r of rows) {
    let g = map.get(r.playerId)
    if (!g) {
      g = { total: 0, sessions: new Set() }
      map.set(r.playerId, g)
    }
    g.total += r.yuan
    g.sessions.add(r.sessionId)
  }
  return [...map.entries()].map(([playerId, g]) => ({
    playerId,
    totalYuan: g.total,
    sessions: g.sessions.size,
    avgYuan: g.total / g.sessions.size,
  }))
}

export function rankGodWorst(
  stats: PlayerYearStat[],
  minSessions = 3,
): {
  godByTotal: PlayerYearStat[]
  godByAvg: PlayerYearStat[]
  worstByTotal: PlayerYearStat[]
  worstByAvg: PlayerYearStat[]
} {
  const byTotal = [...stats].sort((a, b) => b.totalYuan - a.totalYuan)
  const avgEligible = stats.filter((s) => s.sessions >= minSessions)
  const byAvg = [...avgEligible].sort((a, b) => b.avgYuan - a.avgYuan)
  return {
    godByTotal: byTotal,
    godByAvg: byAvg,
    worstByTotal: [...byTotal].reverse(),
    worstByAvg: [...byAvg].reverse(),
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/settleCycle.ts miniprogram/domain/leaderboard.ts tests/settleCycle.test.ts tests/leaderboard.test.ts
git commit -m "feat: cycle cash settle and year leaderboard aggregates"
```

---

### Task 8: 标记胡后的桌面状态（本局内）

**Files:**
- Create: `miniprogram/domain/handFlow.ts`
- Test: `tests/handFlow.test.ts`

**Interfaces:**
- Produces: `commitHu(table, input): { table, score, bankruptIds, handOver: boolean }`  
  流程：`scoreHu` → `applyTransfers` → 设 winner `hasHu=true` → 若 `firstHuId==null` 则设为 winnerId → 若 `bankruptIds.length` 则 `handOver` 含义改为触发轮结（返回 `cycleOver: true`）

```ts
export function commitHu(table: TableState, input: HuInput): {
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
```

测试：非庄首胡后 `openNextHand` 庄变为该人 streak 0；流局 `afterHand` 不变。

- [ ] **Step 1–5: TDD 实现并 commit**

```bash
git commit -m "feat: hand commit flow with liuju and next hand"
```

---

### Task 9: 云数据库集合约定 + sessionApi 骨架

**Files:**
- Create: `miniprogram/services/sessionApi.ts`, `docs/superpowers/plans/notes-cloud-schema.md`（短说明，或写在本 plan 附录即可——**直接写在 `sessionApi.ts` 顶部注释**）
- Create: `cloudfunctions/sessionWrite/index.js`

**Collections:**

| Collection | 关键字段 |
|------------|----------|
| `sessions` | `_id`, `roomCode`, `chipValueYuan`, `scorerOpenId`, `seats[{playerId,nickname,openId?}]`, `status`, `circleId`, `createdAt` |
| `cycles` | `sessionId`, `index`, `dealerPickId`, `settlements[]`, `status` |
| `hands` | `cycleId`, `index`, `dealerId`, `streak`, `firstHuId`, `liuju` |
| `huEvents` | `handId`, `payload`（HuInput + score snapshot + transfers） |

- [ ] **Step 1: `sessionApi.ts` 用 `wx.cloud` 封装**

```ts
// 开发阶段可先用本地 memory mock，用 flag USE_MOCK=true
export async function createSession(input: {
  chipValueYuan: number
  nicknames: [string, string, string, string]
}): Promise<{ sessionId: string; roomCode: string }> {
  // cloud call
}

export async function getSession(sessionId: string): Promise<SessionDoc> {}
export async function startCycle(sessionId: string, dealerId: string): Promise<void> {}
export async function appendHu(sessionId: string, input: HuInput): Promise<CommitResult> {}
```

MVP 第一版允许 `USE_MOCK`：内存 Map 存局，保证无云环境也能在开发者工具走通 UI；云函数在 Task 9b 接真。

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: sessionApi skeleton with mock mode"
```

---

### Task 10: 开房页 + 选庄页

**Files:**
- Create: `miniprogram/pages/create/*`, `miniprogram/pages/dealer-pick/*`
- Modify: `miniprogram/app.json`（注册页）, `miniprogram/pages/index/*`

**Interfaces:**
- Consumes: `createSession`, `freshDealer`, `startCycle`

- [ ] **Step 1: 开房表单** — 面值（1/2/5）、四个昵称输入、创建 → 跳转 `dealer-pick?sessionId=`
- [ ] **Step 2: 选庄页** — 四个大按钮（无骰子）→ 确认 → `startCycle` → `battle`
- [ ] **Step 3: 首页** — 「开新局」「输入房间码加入（只读）」「年度榜」
- [ ] **Step 4: 开发者工具手动点通开房→选庄→进战场空桌**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: create session and manual dealer pick pages"
```

---

### Task 11: 战场页（四方桌）+ 流局/撤销

**Files:**
- Create: `miniprogram/pages/battle/*`
- Modify: `sessionApi` 增加 `liuju`, `undoLastHu`

- [ ] **Step 1: WXML 四方布局** — 顶栏庄/连庄/倍率；四座位牌数；底栏流局/撤销
- [ ] **Step 2: 点击未胡座位 → 打开 `hu-sheet`（Task 12）**
- [ ] **Step 3: 流局 → `commitLiuju` / `openNextHand` 等价写库**
- [ ] **Step 4: 撤销上一胡 — 仅本局内；mock 用事件栈 pop 重放**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat: battle table UI with liuju and undo"
```

---

### Task 12: 录胡组件 `hu-sheet`

**Files:**
- Create: `miniprogram/components/hu-sheet/*`

- [ ] **Step 1: UI** — 自摸/点炮；点炮选人；基本番互斥；附加开关；明杠/暗杠 stepper；预览调用 `scoreHu`；确认调用 `appendHu`
- [ ] **Step 2: 校验** — 点炮无点炮者不可确认
- [ ] **Step 3: 确认后若 `cycleOver` → 跳转结算弹层（展示 `settleCycle`）→ 可「再开一轮」回 `dealer-pick` 或「结束夜局」
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: hu-sheet quick fan entry with live preview"
```

---

### Task 13: 夜局详情页

**Files:**
- Create: `miniprogram/pages/session/*`

- [ ] **Step 1: 列出各轮结算 yuan**
- [ ] **Step 2: 展开轮次看 hands / huEvents 摘要**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: session detail and settlement history"
```

---

### Task 14: 年度榜页

**Files:**
- Create: `miniprogram/pages/rank/*`
- Modify: `sessionApi.getYearRows(year)`

- [ ] **Step 1: 拉取已结束 session 的结算行 → `buildYearStats` + `rankGodWorst`**
- [ ] **Step 2: UI 四列：之神累计 / 之神场均 / 最拉累计 / 最拉场均；场均标注「满 3 场」**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: year-end god and worst leaderboards"
```

---

### Task 15: 接通云开发（去 mock）

**Files:**
- Modify: `miniprogram/services/sessionApi.ts`, `cloudfunctions/sessionWrite/*`, `miniprogram/app.ts`（`wx.cloud.init`）

- [ ] **Step 1: 创建云环境，配置 `project.config.json` / `app.js` envId**
- [ ] **Step 2: `sessionWrite` 校验 `openid === scorerOpenId` 才允许 appendHu/startCycle**
- [ ] **Step 3: 关闭 USE_MOCK，真机/开发者工具走通一局**
- [ ] **Step 4: Commit**

```bash
git commit -m "feat: wire wechat cloud DB and scorer-only writes"
```

---

### Task 16: 验收对照 spec

- [ ] **Step 1: 跑全量 `npm test`** — 全部 PASS
- [ ] **Step 2: 手工剧本**
  1. 开房面值 1 元，选庄 A  
  2. A 平胡点炮 B → B -1  
  3. 流局 → 庄仍为当前推演结果  
  4. 打到有人 0 → 结算 `(chips-20)*1`  
  5. 再开一轮 → 再次手动选庄（无骰子）  
  6. 结束夜局 → 年度榜有数据  
- [ ] **Step 3: 修 bug 后最终 commit**

```bash
git commit -m "test: mvp acceptance pass against design spec"
```

---

## Spec coverage self-check

| Spec 区域 | Task |
|-----------|------|
| 四方桌 + 快速选番 | 11, 12 |
| 开局手动选庄、无骰子、破产重选 | 6, 10, 12 |
| 番积 / 庄倍 / 杠分 / 自摸点炮 | 3, 4 |
| 20 牌、破产截断、兑钱 | 5, 7 |
| 庄推演与流局 | 6, 8 |
| 年度双榜 + 场均门槛 | 7, 14 |
| 记分员唯一写 | 9, 15 |
| 云开发 | 9, 15 |
| §11 测试用例 | 4, 5, 6, 8 |

## Placeholder scan

无 TBD；云环境 `appid`/`envId` 由执行者填本地配置，不进业务逻辑占位。

## Type consistency

全程统一：`PlayerId`、`DealerState.streak`、`HuInput`、`Transfer.reason: 'fee' | 'fan' | 'gang'`（实现用 `'fee'`）、`ScoreHuResult`、`freshDealer` / `afterHand` / `scoreHu` / `applyTransfers` / `commitHu` / `settleCycle` / `rankGodWorst`。
