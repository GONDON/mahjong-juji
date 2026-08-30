# 入局牌数可配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 开房时可选入局牌数（默认 20，10–50 步进 5），写入该局并用于发牌与轮结兑钱。

**Architecture:** 新增 `startingChips` 领域规则（校验、归一、步进）。`SessionDoc` 与 `SessionSummary` 带上该字段。`startCycle` / `settleCycle` 读它，缺省当 20。首页与创建页共用步进器。云函数 `sessionWrite` 镜像同一规则。

**Tech Stack:** 微信小程序 TypeScript、云函数 CommonJS、Vitest。

## Global Constraints

- 字段名必须是 `startingChips`（整数）。
- 默认 20；范围 10–50；步进 5。
- 开房后不可改；每轮都用同一数字。
- 老局缺字段或非法值当 20。
- 开房传入非法值则拒绝创建。
- 进行中列表文案：`底分 {{chipValueYuan}} · {{startingChips}}牌`。
- 流水页：`面值 {{chipValueYuan}} 元/牌 · 入局 {{startingChips}}`。
- 不改番型、庄倍、房间码、占座。
- 与进行中的川麻番型未提交改动分开，不要把那些文件卷进本功能。

## File map

- Create: `miniprogram/domain/startingChips.ts` — 常量、校验、归一、步进
- Create: `tests/startingChips.test.ts`
- Modify: `miniprogram/domain/settleCycle.ts` — 第三参 `startingChips`
- Modify: `tests/settleCycle.test.ts`
- Modify: `miniprogram/services/sessionApi.ts` — 开房写入、发牌、结算、摘要
- Modify: `tests/sessionApi.mock.test.ts`
- Modify: `miniprogram/pages/index/indexState.ts` — 列表文案、步进给 UI 用
- Modify: `tests/indexState.test.ts`
- Modify: `miniprogram/pages/session/sessionState.ts` — 流水 meta
- Modify: `tests/sessionState.test.ts`
- Modify: `miniprogram/pages/index/index.ts` `index.wxml` `index.wxss`
- Modify: `miniprogram/pages/create/create.ts` `create.wxml` `create.wxss`
- Modify: `miniprogram/pages/session/session.wxml` `session.ts`
- Modify: `cloudfunctions/sessionWrite/domain.js` `index.js`
- Modify: `docs/cloud-setup.md` — sessions 字段补 `startingChips`

---

### Task 1: 入局牌数规则

**Files:**
- Create: `miniprogram/domain/startingChips.ts`
- Test: `tests/startingChips.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `DEFAULT_STARTING_CHIPS = 20`
  - `STARTING_CHIPS_MIN = 10`
  - `STARTING_CHIPS_MAX = 50`
  - `STARTING_CHIPS_STEP = 5`
  - `isValidStartingChips(value: unknown): value is number`
  - `readStartingChips(value: unknown): number` — 缺/非法 → 20
  - `requireStartingChips(value: unknown): number` — 缺则 20；有值但非法则 throw
  - `stepStartingChips(current: number, direction: -1 | 1): number`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STARTING_CHIPS,
  isValidStartingChips,
  readStartingChips,
  requireStartingChips,
  stepStartingChips,
} from '../miniprogram/domain/startingChips'

describe('startingChips', () => {
  it('accepts 10–50 in steps of 5', () => {
    expect(isValidStartingChips(10)).toBe(true)
    expect(isValidStartingChips(20)).toBe(true)
    expect(isValidStartingChips(50)).toBe(true)
    expect(isValidStartingChips(15)).toBe(true)
    expect(isValidStartingChips(11)).toBe(false)
    expect(isValidStartingChips(5)).toBe(false)
    expect(isValidStartingChips(55)).toBe(false)
    expect(isValidStartingChips(20.5)).toBe(false)
    expect(isValidStartingChips('20')).toBe(false)
  })

  it('reads missing or illegal values as 20', () => {
    expect(readStartingChips(undefined)).toBe(DEFAULT_STARTING_CHIPS)
    expect(readStartingChips(null)).toBe(20)
    expect(readStartingChips(11)).toBe(20)
    expect(readStartingChips(30)).toBe(30)
  })

  it('require treats omit as 20 and rejects illegal provided values', () => {
    expect(requireStartingChips(undefined)).toBe(20)
    expect(() => requireStartingChips(11)).toThrow(/startingChips/)
    expect(requireStartingChips(15)).toBe(15)
  })

  it('steps by 5 and clamps at 10 and 50', () => {
    expect(stepStartingChips(20, 1)).toBe(25)
    expect(stepStartingChips(20, -1)).toBe(15)
    expect(stepStartingChips(10, -1)).toBe(10)
    expect(stepStartingChips(50, 1)).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/startingChips.test.ts`
Expected: FAIL — cannot find module `startingChips`

- [ ] **Step 3: Write minimal implementation**

```ts
export const DEFAULT_STARTING_CHIPS = 20
export const STARTING_CHIPS_MIN = 10
export const STARTING_CHIPS_MAX = 50
export const STARTING_CHIPS_STEP = 5

export function isValidStartingChips(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= STARTING_CHIPS_MIN &&
    value <= STARTING_CHIPS_MAX &&
    value % STARTING_CHIPS_STEP === 0
  )
}

export function readStartingChips(value: unknown): number {
  return isValidStartingChips(value) ? value : DEFAULT_STARTING_CHIPS
}

export function requireStartingChips(value: unknown): number {
  if (value == null) return DEFAULT_STARTING_CHIPS
  if (!isValidStartingChips(value)) {
    throw new Error('startingChips must be 10–50 in steps of 5')
  }
  return value
}

export function stepStartingChips(current: number, direction: -1 | 1): number {
  const base = readStartingChips(current)
  const next = base + direction * STARTING_CHIPS_STEP
  if (next < STARTING_CHIPS_MIN) return STARTING_CHIPS_MIN
  if (next > STARTING_CHIPS_MAX) return STARTING_CHIPS_MAX
  return next
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/startingChips.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/startingChips.ts tests/startingChips.test.ts
git commit -m "feat: add startingChips validation and stepper"
```

（仅在用户明确要求提交时执行。）

---

### Task 2: 结算读入局牌数

**Files:**
- Modify: `miniprogram/domain/settleCycle.ts`
- Test: `tests/settleCycle.test.ts`

**Interfaces:**
- Consumes: 无（第三参默认 20，不依赖 Task 1 也能编译）
- Produces: `settleCycle(seats, chipValueYuan, startingChips = 20)`

- [ ] **Step 1: Extend the existing test and add a non-20 case**

现有用例保持：起始默认 20，25/0/20/35、底分 2 → a `chipDelta 5` / `yuan 10`，b `yuan -40`。

再加：

```ts
  it('uses startingChips instead of a hardcoded 20', () => {
    const r = settleCycle(
      [
        { playerId: 'a', nickname: 'A', chips: 15, hasHu: false },
        { playerId: 'b', nickname: 'B', chips: 0, hasHu: false },
        { playerId: 'c', nickname: 'C', chips: 10, hasHu: false },
        { playerId: 'd', nickname: 'D', chips: 25, hasHu: false },
      ],
      2,
      10,
    )
    expect(r.find((x) => x.playerId === 'a')).toEqual({
      playerId: 'a',
      chipDelta: 5,
      yuan: 10,
    })
    expect(r.find((x) => x.playerId === 'b')!.yuan).toBe(-20)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/settleCycle.test.ts`
Expected: FAIL — b.yuan 仍是按 20 算出来的 -40

- [ ] **Step 3: Write minimal implementation**

```ts
export function settleCycle(
  seats: Seat[],
  chipValueYuan: number,
  startingChips = 20,
): CycleSettlementRow[] {
  return seats.map((s) => {
    const chipDelta = s.chips - startingChips
    return {
      playerId: s.playerId,
      chipDelta,
      yuan: chipDelta * chipValueYuan,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/settleCycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/settleCycle.ts tests/settleCycle.test.ts
git commit -m "feat: settleCycle uses configurable startingChips"
```

---

### Task 3: 开房写入、发牌、摘要

**Files:**
- Modify: `miniprogram/services/sessionApi.ts`
- Test: `tests/sessionApi.mock.test.ts`

**Interfaces:**
- Consumes: `requireStartingChips`, `readStartingChips` from Task 1；`settleCycle` 第三参 from Task 2
- Produces:
  - `SessionDoc.startingChips: number`
  - `SessionSummary.startingChips: number`
  - `createSession({ chipValueYuan, startingChips?, nicknames })`
  - `startCycle` 发 `doc.startingChips`
  - `settleCurrent` 调 `settleCycle(seats, chipValueYuan, startingChips)`

- [ ] **Step 1: Write the failing tests**

在 `tests/sessionApi.mock.test.ts` 增加：

```ts
  it('stores startingChips, deals them, and settles against them', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 2,
      startingChips: 15,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    const opened = await getSession(sessionId)
    expect(opened.startingChips).toBe(15)
    const idA = opened.seats[0].playerId
    await startCycle(sessionId, idA)
    const playing = await getSession(sessionId)
    expect(playing.seats.every((s) => s.chips === 15)).toBe(true)
    const rows = await settleCycleManual(sessionId)
    expect(rows.every((r) => r.chipDelta === 0 && r.yuan === 0)).toBe(true)
  })

  it('rejects illegal startingChips on create', async () => {
    await expect(
      createSession({
        chipValueYuan: 1,
        startingChips: 11,
        nicknames: ['A', 'B', 'C', 'D'],
      }),
    ).rejects.toThrow(/startingChips/)
  })
```

把 `toSessionSummary` 两个期望补上 `startingChips: 20`（缺字段归一）。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sessionApi.mock.test.ts`
Expected: FAIL — `startingChips` undefined / 发 20 / 摘要缺字段

- [ ] **Step 3: Write minimal implementation**

`sessionApi.ts`：

1. import `readStartingChips`, `requireStartingChips`
2. `SessionSummary` 与 `SessionDoc` 加 `startingChips: number`
3. `toSessionSummary` 返回 `startingChips: readStartingChips(raw.startingChips)`
4. `createSession` 入参加 `startingChips?: number`；`const startingChips = requireStartingChips(input.startingChips)` 写入 doc
5. `startCycle`：`chips: readStartingChips(doc.startingChips)`
6. `settleCurrent`：`settleCycle(doc.seats, doc.chipValueYuan, readStartingChips(doc.startingChips))`

现有 `createSession({ chipValueYuan, nicknames })` 不传牌数时仍是 20。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sessionApi.mock.test.ts tests/acceptance.mvp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/services/sessionApi.ts tests/sessionApi.mock.test.ts
git commit -m "feat: persist startingChips on create, deal, and settle"
```

---

### Task 4: 大厅文案与步进

**Files:**
- Modify: `miniprogram/pages/index/indexState.ts`
- Test: `tests/indexState.test.ts`

**Interfaces:**
- Consumes: `stepStartingChips`, `readStartingChips` from Task 1；`SessionSummary.startingChips` from Task 3
- Produces:
  - `RecentCampaign.startingChips: number`
  - `presentRecentCampaign` 进行中 meta：`底分 ${chipValueYuan} · ${startingChips}牌`
  - 再导出 `stepStartingChips`（或 UI 直接从 domain import，二选一：本任务让 UI 从 domain import，indexState 只改列表）

- [ ] **Step 1: Update lobby present tests**

`playing` / `ended` fixture 加 `startingChips: 20`。进行中期望改为 `meta: '底分 2 · 20牌'`。再加一条 `startingChips: 15` → `底分 2 · 15牌`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/indexState.test.ts`
Expected: FAIL — meta 仍是 `底分 2`

- [ ] **Step 3: Write minimal implementation**

`RecentCampaign` 加 `startingChips`。`presentRecentCampaign`：

```ts
meta: active
  ? `底分 ${campaign.chipValueYuan} · ${campaign.startingChips}牌`
  : '已结束',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/indexState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index/indexState.ts tests/indexState.test.ts
git commit -m "feat: show starting chips on lobby session rows"
```

---

### Task 5: 流水页 meta

**Files:**
- Modify: `miniprogram/pages/session/sessionState.ts`
- Test: `tests/sessionState.test.ts`

**Interfaces:**
- Consumes: `readStartingChips`；`SessionDoc.startingChips`
- Produces: `SessionDetailView.startingChips: number`（给 wxml 拼「入局」）

- [ ] **Step 1: Extend presentSession test**

```ts
expect(view.startingChips).toBe(20)
```

再加：`doc({ startingChips: 30 })` → `startingChips === 30`。缺字段的现有 `doc()` 为 20。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sessionState.test.ts`
Expected: FAIL — `startingChips` undefined

- [ ] **Step 3: Write minimal implementation**

`SessionDetailView` 加 `startingChips`。`presentSession`：

```ts
startingChips: readStartingChips(doc.startingChips),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sessionState.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/session/sessionState.ts tests/sessionState.test.ts
git commit -m "feat: show starting chips on session recap"
```

---

### Task 6: 首页、创建页、流水页、云函数

**Files:**
- Modify: `miniprogram/pages/index/index.ts` `index.wxml` `index.wxss`
- Modify: `miniprogram/pages/create/create.ts` `create.wxml` `create.wxss`
- Modify: `miniprogram/pages/session/session.ts` `session.wxml`
- Modify: `cloudfunctions/sessionWrite/domain.js` `index.js`
- Modify: `docs/cloud-setup.md`

**Interfaces:**
- Consumes: Tasks 1–5 的字段与函数
- Produces: 可点的步进 UI；云函数开房/发牌/结算/摘要与 mock 一致

- [ ] **Step 1: Homepage UI**

`index.ts` data 加 `startingChips: 20`、`canDecStarting`、`canIncStarting`。`onStartingStep` 用 `stepStartingChips`。`onCreateTap` 把 `startingChips` 传给 `createSession`。副文案改成「设好底分和牌数，邀请牌友用房间码入座」。

`index.wxml` 在底分下行加：

```xml
        <view class="field">
          <text class="field-label">入局牌数</text>
          <view class="stepper">
            <view
              class="stepper-btn {{canDecStarting ? '' : 'stepper-btn--off'}}"
              hover-class="{{canDecStarting ? 'stepper-btn--pressed' : ''}}"
              data-dir="-1"
              bindtap="onStartingStep"
            >−</view>
            <text class="stepper-value">{{startingChips}}</text>
            <view
              class="stepper-btn {{canIncStarting ? '' : 'stepper-btn--off'}}"
              hover-class="{{canIncStarting ? 'stepper-btn--pressed' : ''}}"
              data-dir="1"
              bindtap="onStartingStep"
            >+</view>
          </view>
        </view>
```

`index.wxss`：

```css
.field + .field {
  margin-top: 18rpx;
}

.stepper {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.stepper-btn {
  width: 80rpx;
  height: 80rpx;
  border: var(--stroke-thin) solid var(--ink);
  border-radius: var(--radius-pill);
  background: var(--panel);
  color: var(--ink);
  font-size: 40rpx;
  font-weight: 700;
  line-height: 72rpx;
  text-align: center;
}

.stepper-btn--pressed {
  background: var(--peach-wash);
}

.stepper-btn--off {
  opacity: 0.35;
}

.stepper-value {
  flex: 1;
  text-align: center;
  font-size: 40rpx;
  font-weight: 700;
  color: var(--ink);
}
```

- [ ] **Step 2: Create page + session recap**

创建页同样一行步进，`createSession` 传入 `startingChips`。

流水页 `session.wxml`：

```xml
<text class="meta">面值 {{chipValueYuan}} 元/牌 · 入局 {{startingChips}}</text>
```

`session.ts` data 加 `startingChips: 0`（`applyDoc` 已展开 `presentSession`）。

- [ ] **Step 3: Cloud function mirror**

`domain.js` 的 `settleCycle` 加第三参，默认 20。

`index.js`：

- 复制 `isValidStartingChips` / `readStartingChips` / `requireStartingChips`（或同文件小函数）
- `createSession`：`const startingChips = requireStartingChips(event.startingChips)` 写入
- `startCycle`：`chips: readStartingChips(doc.startingChips)`
- `settleCurrent`：`settleCycle(doc.seats, doc.chipValueYuan, readStartingChips(doc.startingChips))`
- `toSessionSummary` 加 `startingChips: readStartingChips(doc.startingChips)`

`docs/cloud-setup.md` sessions 字段列表补 `startingChips`。

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS。现有 `createSession` 不传牌数的用例仍发 20。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index miniprogram/pages/create miniprogram/pages/session cloudfunctions/sessionWrite docs/cloud-setup.md
git commit -m "feat: starting chips stepper on create and cloud deal/settle"
```

---

## Self-review

1. Spec coverage: 步进 UI、写入、发牌、结算、老局 20、列表/流水文案、创建页、云函数、校验拒绝非法值 — 均有任务。
2. 无 TBD / “加合适错误处理”。
3. 字段名全程 `startingChips`；`requireStartingChips` / `readStartingChips` / `stepStartingChips` 前后一致。
