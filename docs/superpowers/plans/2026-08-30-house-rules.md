# 桌规对象与自摸加番 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 开房时选定桌规对象；这轮只有自摸 `none` / `plusOne`。新房默认加一番，老局缺字段不加番。算分、预览、流水都读这块桌规。

**Architecture:** 新增 `houseRules` 领域模块（校验、缺省、文案）。`scoreHu` / `commitHu` 第三参必传。Session 开房写入、之后只读。首页与创建页共用「桌规」一栏。云函数 `sessionWrite` 镜像同一规则。

**Tech Stack:** 微信小程序 TypeScript、云函数 CommonJS、Vitest。

## Global Constraints

- 字段名必须是 `houseRules`，其内这轮只有 `zimoFan: 'none' | 'plusOne'`。
- 开房没传 → `{ zimoFan: 'plusOne' }`；非法值拒绝创建。
- 读已有局缺字段或坏值 → `{ zimoFan: 'none' }`。
- 开房后不可改。
- 自摸且 `plusOne` 时番积再 ×2，再乘庄倍、再加杠分。点炮不乘。
- 杠上花等附加番照旧连乘。
- 流水页：`面值 {{chipValueYuan}} 元/牌 · 入局 {{startingChips}} · {{zimoFanLabel}}`。
- 最近牌局列表不写桌规。
- 不改杠分、庄倍公式、谁付钱。
- 工作区里已有未提交的入局牌数 / 番型改动：本功能提交只暂存桌规相关文件，不要把那些改动卷进来。

## File map

- Create: `miniprogram/domain/houseRules.ts` — 类型、默认、require/read、文案
- Create: `tests/houseRules.test.ts`
- Modify: `miniprogram/domain/scoreHu.ts` — 第三参
- Modify: `tests/scoreHu.test.ts`
- Modify: `miniprogram/domain/handFlow.ts` — `commitHu` 第三参
- Modify: `tests/handFlow.test.ts`
- Modify: `miniprogram/services/sessionApi.ts` — 开房写入、appendHu 读桌规
- Modify: `tests/sessionApi.mock.test.ts`
- Modify: `miniprogram/pages/session/sessionState.ts` — `zimoFanLabel`
- Modify: `tests/sessionState.test.ts`
- Modify: `miniprogram/pages/session/session.wxml` `session.ts`
- Modify: `miniprogram/pages/index/index.ts` `index.wxml`
- Modify: `miniprogram/pages/create/create.ts` `create.wxml`
- Modify: `miniprogram/components/hu-sheet/hu-sheet.ts` `hu-sheet.wxml`
- Modify: `miniprogram/pages/battle/battle.ts` `battle.wxml`
- Modify: `cloudfunctions/sessionWrite/domain.js` `index.js`
- Modify: `docs/cloud-setup.md`

---

### Task 1: 桌规规则

**Files:**
- Create: `miniprogram/domain/houseRules.ts`
- Test: `tests/houseRules.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `ZimoFan = 'none' | 'plusOne'`
  - `HouseRules = { zimoFan: ZimoFan }`
  - `DEFAULT_HOUSE_RULES: HouseRules` — `{ zimoFan: 'plusOne' }`
  - `isValidZimoFan(value: unknown): value is ZimoFan`
  - `readHouseRules(value: unknown): HouseRules` — 缺/坏 → `{ zimoFan: 'none' }`
  - `requireHouseRules(value: unknown): HouseRules` — 缺则默认 plusOne；有值但非法则 throw
  - `zimoFanLabel(zimoFan: ZimoFan): string` — `自摸加一番` / `自摸不加番`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_HOUSE_RULES,
  readHouseRules,
  requireHouseRules,
  zimoFanLabel,
} from '../miniprogram/domain/houseRules'

describe('houseRules', () => {
  it('defaults new rooms to plusOne', () => {
    expect(DEFAULT_HOUSE_RULES).toEqual({ zimoFan: 'plusOne' })
    expect(requireHouseRules(undefined)).toEqual({ zimoFan: 'plusOne' })
    expect(requireHouseRules(null)).toEqual({ zimoFan: 'plusOne' })
  })

  it('reads missing or bad values as none', () => {
    expect(readHouseRules(undefined)).toEqual({ zimoFan: 'none' })
    expect(readHouseRules({})).toEqual({ zimoFan: 'none' })
    expect(readHouseRules({ zimoFan: 'timesThree' })).toEqual({ zimoFan: 'none' })
    expect(readHouseRules({ zimoFan: 'plusOne' })).toEqual({ zimoFan: 'plusOne' })
    expect(readHouseRules({ zimoFan: 'none' })).toEqual({ zimoFan: 'none' })
  })

  it('rejects illegal create payloads', () => {
    expect(() => requireHouseRules({ zimoFan: 'timesThree' })).toThrow(
      /houseRules/,
    )
    expect(() => requireHouseRules({ zimoFan: 'plusOne' })).not.toThrow()
  })

  it('labels zimo fan modes', () => {
    expect(zimoFanLabel('plusOne')).toBe('自摸加一番')
    expect(zimoFanLabel('none')).toBe('自摸不加番')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/houseRules.test.ts`  
Expected: FAIL — cannot find module `houseRules`

- [ ] **Step 3: Write minimal implementation**

```ts
export type ZimoFan = 'none' | 'plusOne'

export type HouseRules = {
  zimoFan: ZimoFan
}

export const DEFAULT_HOUSE_RULES: HouseRules = { zimoFan: 'plusOne' }

export function isValidZimoFan(value: unknown): value is ZimoFan {
  return value === 'none' || value === 'plusOne'
}

export function readHouseRules(value: unknown): HouseRules {
  if (value && typeof value === 'object' && isValidZimoFan((value as HouseRules).zimoFan)) {
    return { zimoFan: (value as HouseRules).zimoFan }
  }
  return { zimoFan: 'none' }
}

export function requireHouseRules(value: unknown): HouseRules {
  if (value == null) return { ...DEFAULT_HOUSE_RULES }
  if (value && typeof value === 'object' && isValidZimoFan((value as HouseRules).zimoFan)) {
    return { zimoFan: (value as HouseRules).zimoFan }
  }
  throw new Error('houseRules.zimoFan must be none or plusOne')
}

export function zimoFanLabel(zimoFan: ZimoFan): string {
  return zimoFan === 'plusOne' ? '自摸加一番' : '自摸不加番'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/houseRules.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/houseRules.ts tests/houseRules.test.ts
git commit -m "feat: add houseRules validation and zimo fan labels"
```

---

### Task 2: scoreHu 读桌规

**Files:**
- Modify: `miniprogram/domain/scoreHu.ts`
- Modify: `tests/scoreHu.test.ts`

**Interfaces:**
- Consumes: `HouseRules` from Task 1
- Produces: `scoreHu(table, input, houseRules: HouseRules)`

- [ ] **Step 1: Write the failing tests**

在 `tests/scoreHu.test.ts` 顶部增加：

```ts
import type { HouseRules } from '../miniprogram/domain/houseRules'

const none: HouseRules = { zimoFan: 'none' }
const plus: HouseRules = { zimoFan: 'plusOne' }
```

现有每处 `scoreHu(table(...), {` 改成第三参 `none`（数字不变）。

再加：

```ts
  it('non-dealer pinghu zimo plusOne: each pays 2', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'zimo',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.fanPart).toBe(2)
    expect(r.perPayer).toBe(2)
    expect(r.transfers).toHaveLength(3)
  })

  it('non-dealer duidui zimo plusOne: each pays 4', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'zimo',
      basicFan: 'duidui',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.fanPart).toBe(4)
    expect(r.perPayer).toBe(4)
  })

  it('duidui dianpao plusOne still pays 2', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'dianpao',
      dianpaoId: 'c',
      basicFan: 'duidui',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.perPayer).toBe(2)
    expect(r.transfers).toHaveLength(1)
  })

  it('pinghu gangshanghua zimo plusOne is 4', () => {
    const r = scoreHu(table(), {
      winnerId: 'b',
      winType: 'zimo',
      basicFan: 'pinghu',
      extras: ['gangshanghua'],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    }, plus)
    expect(r.fanPart).toBe(4)
    expect(r.perPayer).toBe(4)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/scoreHu.test.ts`  
Expected: FAIL — `scoreHu` 仍只要 2 个参数 / plusOne 仍是 1

- [ ] **Step 3: Implement**

`scoreHu.ts`：

```ts
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
  // ... 其余付款人逻辑不变
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/scoreHu.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/scoreHu.ts tests/scoreHu.test.ts
git commit -m "feat: scoreHu multiplies zimo fan from houseRules"
```

---

### Task 3: commitHu / 开房 / 入账

**Files:**
- Modify: `miniprogram/domain/handFlow.ts`
- Modify: `tests/handFlow.test.ts`
- Modify: `miniprogram/services/sessionApi.ts`
- Modify: `tests/sessionApi.mock.test.ts`
- Modify: `tests/acceptance.mvp.test.ts`（若 `commitHu` / `scoreHu` 签名导致红）

**Interfaces:**
- Consumes: `scoreHu(..., houseRules)`；`requireHouseRules` / `readHouseRules`
- Produces:
  - `commitHu(table, input, houseRules)`
  - `createSession({ ..., houseRules? })` 写入 `requireHouseRules`
  - `appendHu` 用 `readHouseRules(doc.houseRules)`
  - `SessionDoc.houseRules: HouseRules`

- [ ] **Step 1: Write the failing tests**

`tests/handFlow.test.ts` 现有 `commitHu(table(), {` 补第三参 `{ zimoFan: 'none' }`。

`tests/sessionApi.mock.test.ts` 在 `startingChips on session` 旁加：

```ts
describe('houseRules on session', () => {
  it('stores plusOne by default and scores zimo with it', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    const opened = await getSession(sessionId)
    expect(opened.houseRules).toEqual({ zimoFan: 'plusOne' })
    await startCycle(sessionId, opened.seats[0].playerId)
    const r = await appendHu(sessionId, {
      winnerId: opened.seats[1].playerId,
      winType: 'zimo',
      basicFan: 'pinghu',
      extras: [],
      genCount: 0,
      mingGang: 0,
      anGang: 0,
    })
    expect(r.score.perPayer).toBe(2)
  })

  it('rejects illegal houseRules on create', async () => {
    await expect(
      createSession({
        chipValueYuan: 1,
        nicknames: ['东', '南', '西', '北'],
        houseRules: { zimoFan: 'timesThree' } as never,
      }),
    ).rejects.toThrow(/houseRules/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/handFlow.test.ts tests/sessionApi.mock.test.ts`  
Expected: FAIL — `houseRules` undefined / 自摸仍是 1

- [ ] **Step 3: Implement**

`handFlow.ts` 的 `commitHu`：

```ts
import type { HouseRules } from './houseRules'

export function commitHu(
  table: TableState,
  input: HuInput,
  houseRules: HouseRules,
) {
  const score = scoreHu(table, input, houseRules)
  // ...其余不变
}
```

`sessionApi.ts`：

- `import { requireHouseRules, readHouseRules, type HouseRules } from '../domain/houseRules'`
- `SessionDoc` 加 `houseRules?: HouseRules`
- `createSession` 入参加 `houseRules?: HouseRules`；`const houseRules = requireHouseRules(input.houseRules)` 写入 doc
- mock `appendHu`：`const result = commitHu(before, input, readHouseRules(doc.houseRules))`

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/handFlow.test.ts tests/sessionApi.mock.test.ts tests/acceptance.mvp.test.ts`  
Expected: PASS。`acceptance` 里 `commitHu` / `appendHu` 走 mock，新房默认 plusOne；若 acceptance 依赖「自摸每人很大」仍应绿。点炮用例数字不变。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/domain/handFlow.ts tests/handFlow.test.ts \
  miniprogram/services/sessionApi.ts tests/sessionApi.mock.test.ts \
  tests/acceptance.mvp.test.ts
git commit -m "feat: persist houseRules on create and score appendHu with them"
```

---

### Task 4: 流水页文案

**Files:**
- Modify: `miniprogram/pages/session/sessionState.ts`
- Modify: `tests/sessionState.test.ts`
- Modify: `miniprogram/pages/session/session.wxml`
- Modify: `miniprogram/pages/session/session.ts`

**Interfaces:**
- Consumes: `readHouseRules`、`zimoFanLabel`
- Produces: `SessionDetailView.zimoFanLabel: string`

- [ ] **Step 1: Write the failing test**

`tests/sessionState.test.ts` 在 startingChips 那条旁加：

```ts
  it('surfaces zimoFanLabel, defaulting missing houseRules to 不加番', () => {
    expect(presentSession(doc()).zimoFanLabel).toBe('自摸不加番')
    expect(
      presentSession(doc({ houseRules: { zimoFan: 'plusOne' } })).zimoFanLabel,
    ).toBe('自摸加一番')
  })
```

现有 `shows room recap` 不必改数字，只是还没有 `zimoFanLabel`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sessionState.test.ts`  
Expected: FAIL — `zimoFanLabel` undefined

- [ ] **Step 3: Implement**

`SessionDetailView` 加 `zimoFanLabel: string`。`presentSession`：

```ts
import { readHouseRules, zimoFanLabel } from '../../domain/houseRules'

zimoFanLabel: zimoFanLabel(readHouseRules(doc.houseRules).zimoFan),
```

`session.ts` data 加 `zimoFanLabel: ''`（`applyDoc` 已展开 `presentSession`）。

`session.wxml`：

```xml
<text class="meta">面值 {{chipValueYuan}} 元/牌 · 入局 {{startingChips}} · {{zimoFanLabel}}</text>
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/sessionState.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/session/sessionState.ts tests/sessionState.test.ts \
  miniprogram/pages/session/session.wxml miniprogram/pages/session/session.ts
git commit -m "feat: show zimo house rule on session ledger"
```

---

### Task 5: 开房桌规 UI

**Files:**
- Modify: `miniprogram/pages/index/index.ts` `index.wxml`
- Modify: `miniprogram/pages/create/create.ts` `create.wxml`

**Interfaces:**
- Consumes: `DEFAULT_HOUSE_RULES`、`ZimoFan`、`createSession({ houseRules })`

- [ ] **Step 1: 首页井里入局牌数下加桌规**

`index.wxml` 入局牌数 `</view>` 后、well 结束前：

```xml
        <view class="field">
          <text class="field-label">桌规 · 自摸</text>
          <view class="chip-row">
            <view
              class="chip {{zimoFan === 'none' ? 'chip--on' : ''}}"
              hover-class="chip--pressed"
              data-value="none"
              bindtap="onZimoFanTap"
            >不加番</view>
            <view
              class="chip {{zimoFan === 'plusOne' ? 'chip--on' : ''}}"
              hover-class="chip--pressed"
              data-value="plusOne"
              bindtap="onZimoFanTap"
            >加一番</view>
          </view>
        </view>
```

副文案改为：`设好底分、牌数和桌规，邀请牌友用房间码入座`。

`index.ts`：

```ts
import { DEFAULT_HOUSE_RULES, type ZimoFan } from '../../domain/houseRules'

// data:
zimoFan: DEFAULT_HOUSE_RULES.zimoFan,

onZimoFanTap(e) {
  const zimoFan = String(e.currentTarget.dataset.value)
  if (zimoFan !== 'none' && zimoFan !== 'plusOne') return
  this.setData({ zimoFan })
},

// onCreateTap createSession 加：
houseRules: { zimoFan: this.data.zimoFan },
```

创建页同样一块，放在入局牌数和四人昵称之间；`create.ts` 同样默认 `plusOne`，`onSubmit` 传入 `houseRules`。

- [ ] **Step 2: 无单测（页面）。用现有样式，不新开 wxss。**

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/index/index.ts miniprogram/pages/index/index.wxml \
  miniprogram/pages/create/create.ts miniprogram/pages/create/create.wxml
git commit -m "feat: pick zimo house rule on create"
```

---

### Task 6: 录胡预览

**Files:**
- Modify: `miniprogram/components/hu-sheet/hu-sheet.ts` `hu-sheet.wxml`
- Modify: `miniprogram/pages/battle/battle.ts` `battle.wxml`

**Interfaces:**
- Consumes: `scoreHu(..., houseRules)`；`readHouseRules`
- Produces: `hu-sheet` 属性 `houseRules`；预览在自摸 plusOne 时显示 `自摸×2`

- [ ] **Step 1: hu-sheet 接桌规**

`hu-sheet.ts` properties 加：

```ts
houseRules: { type: Object, value: { zimoFan: 'none' } },
```

data 加 `previewZimoMult: 1`。

`refreshPreview` 里：

```ts
import { readHouseRules } from '../../domain/houseRules'

const houseRules = readHouseRules(this.properties.houseRules)
const result = scoreHu(this.buildTable(), input, houseRules)
const previewZimoMult =
  input.winType === 'zimo' && houseRules.zimoFan === 'plusOne' ? 2 : 1
```

`hu-sheet.wxml` 摘要改成：

```xml
<text class="preview-summary">每人 {{previewPerPayer}} 牌（番 {{previewFanPart}} + 杠 {{previewGangPart}}  庄倍×{{previewDealerMult}}<block wx:if="{{previewZimoMult === 2}}"> 自摸×2</block>）</text>
```

`battle.ts` data 加 `houseRules: { zimoFan: 'none' }`。`applyDoc` 写入 `houseRules: readHouseRules(doc.houseRules)`。

`battle.wxml`：

```xml
  <hu-sheet
    visible="{{showHuSheet}}"
    winnerId="{{winnerId}}"
    seats="{{seats}}"
    dealerId="{{dealerId}}"
    streak="{{streak}}"
    houseRules="{{houseRules}}"
    bind:cancel="closeHuSheet"
    bind:confirm="onHuConfirm"
  />
```

- [ ] **Step 2: Commit**

```bash
git add miniprogram/components/hu-sheet/hu-sheet.ts \
  miniprogram/components/hu-sheet/hu-sheet.wxml \
  miniprogram/pages/battle/battle.ts miniprogram/pages/battle/battle.wxml
git commit -m "feat: hu-sheet preview uses session houseRules"
```

---

### Task 7: 云函数镜像

**Files:**
- Modify: `cloudfunctions/sessionWrite/domain.js`
- Modify: `cloudfunctions/sessionWrite/index.js`
- Modify: `docs/cloud-setup.md`

**Interfaces:**
- Consumes: 与 Task 1–3 相同语义
- Produces: 云上 `requireHouseRules` / `readHouseRules` / `scoreHu(table, input, houseRules)` / `commitHu(table, input, houseRules)`

- [ ] **Step 1: domain.js 镜像**

在 `requireStartingChips` 旁加：

```js
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
```

`scoreHu(table, input, houseRules)`：

```js
  const zimoMult =
    input.winType === 'zimo' && houseRules && houseRules.zimoFan === 'plusOne'
      ? 2
      : 1
  const fanPart =
    fanProduct(input.basicFan, input.extras, input.genCount) *
    zimoMult *
    dealerMult
```

`commitHu(table, input, houseRules)` 把 `scoreHu(table, input)` 改成 `scoreHu(table, input, houseRules)`。

`module.exports` 加上 `readHouseRules, requireHouseRules`。

- [ ] **Step 2: index.js**

顶部 destructure 加上 `readHouseRules, requireHouseRules`。

`createSession`：`const houseRules = requireHouseRules(event.houseRules)`，`data` 里写入 `houseRules`。

`appendHu`：`const result = commitHu(before, input, readHouseRules(doc.houseRules))`。

- [ ] **Step 3: cloud-setup**

sessions 字段列表补 `houseRules`。

- [ ] **Step 4: 全量测试**

Run: `npx vitest run`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/sessionWrite/domain.js cloudfunctions/sessionWrite/index.js \
  docs/cloud-setup.md
git commit -m "feat: mirror houseRules scoring in sessionWrite"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| `houseRules` 对象、`zimoFan` 两档 | 1 |
| 开房默认 plusOne、读旧局 none | 1, 3 |
| 非法创建拒绝 | 1, 3 |
| 番积公式、点炮不乘、杠上花连乘 | 2 |
| 开房写入、appendHu 读桌规 | 3 |
| 流水 meta 文案 | 4 |
| 首页 / 创建页桌规栏 | 5 |
| 预览 `自摸×2` | 6 |
| 云函数镜像、部署说明 | 7 |
| 列表不写桌规、不改杠/庄/付款人 | 未改那些路径 |

改了 `sessionWrite`，真机需在开发者工具重新上传该云函数。
