# 牌局跟局（session live）

**日期：** 2026-08-26  
**状态：** 已确认  
**范围：** 四台设备跟同一份牌局文档：阶段跳页、牌数/名册刷新、传输（`watch` 主、轮询垫）。  
**形态：** 微信小程序（现有麻将局记）  
**用户文案：** Session 对用户叫「牌局」。代码标识符保持 `session` / `SessionDoc` / `endSession` / `pages/session`。

## 1. 目标与非目标

### 目标

- 记分员与 BCD **共用一张跟局表**。写库仍只有 `sessionWrite`；页面不各自轮询、不各自写跳页。
- 桌上其他人能立刻看到阶段变化和牌数变化（产品成功标准）。开局、结清、再开一轮、结束、录胡、占座，都走同一条订阅。
- 「再开一轮」是云上的一步（`settling → open`），不是记分员本地跳选庄。
- 结束牌局后，记分员和 BCD 都进牌局详情看流水，不回首页。
- `watch` 订不上时，现有 2 秒 `getSession` 轮询仍能跟局（延迟更大，行为相同）。

### 非目标（本期不做）

- 在线心跳、离线灰掉、主动出房、踢出房间。
- 事件流、自建 WebSocket、第二份「session 事件」集合。
- 首页最近牌局实时刷新（仍只在 `onShow` 拉一次）。
- 把停在首页 / 角色卡 / 年度榜的人远程拉进牌局。
- 客户端直接写 `sessions`，或按房间码从客户端扫集合。
- 改算分引擎、录胡规则、角色卡。
- 在 CI / Vitest 里打真微信 `database.watch`。

## 2. 阶段与正页

`SessionStatus` 仍是 `'open' | 'playing' | 'settling' | 'ended'`。含义钉死：

| `status` | 意思 | 正页 |
|---|---|---|
| `open` | 未开局，或本轮已结清并已「再开一轮」；可占座、可选庄 | 选庄 `pages/dealer-pick/dealer-pick` |
| `playing` | 轮进行中 | 战场 `pages/battle/battle` |
| `settling` | 本轮已结清，正在看结算；座位冻结 | 战场（结算层） |
| `ended` | 牌局结束 | 详情 `pages/session/session` |

写入造成的阶段变化：

| 动作 | 谁 | 前置 | 结果 |
|---|---|---|---|
| `startCycle` | 记分员 | `status === 'open'` 且无 `currentCycle` | `playing` |
| 录胡导致轮结束 / `settleCycleManual` | 记分员 | `playing` | `settling` |
| `advanceToNextCycle`（新） | 记分员 | `settling`（且无 `currentCycle`） | `open` |
| `endSession` | 记分员 | 无 `currentCycle`（`open` 或 `settling`） | `ended` |

`canMutateSeats` **只允许 `open`**。`settling` 是看钱，不占座；回到 `open` 才能再占。云函数 `presence.js` 与 TS 同步改。

今日 `startCycle` 在 `settling` 且无 `currentCycle` 时也能开下一轮。必须改成只接受 `open`，否则记分员会绕过 `advanceToNextCycle`，BCD 收不到「一起回选庄」的阶段变化。

## 3. 跟局决策

纯函数，选庄 / 战场 / 详情 / 首页进房共用，禁止页面再写一套 `if (status)`。

```ts
export type TablePage = 'dealer-pick' | 'battle' | 'session'

export function tablePageFor(status: SessionStatus): TablePage {
  if (status === 'ended') return 'session'
  if (status === 'playing' || status === 'settling') return 'battle'
  return 'dealer-pick'
}

export function tablePathFor(status: SessionStatus, sessionId: string): string {
  const id = encodeURIComponent(sessionId)
  const page = tablePageFor(status)
  if (page === 'battle') return `/pages/battle/battle?sessionId=${id}`
  if (page === 'session') return `/pages/session/session?sessionId=${id}`
  return `/pages/dealer-pick/dealer-pick?sessionId=${id}`
}

export type FollowDecision =
  | { action: 'stay' }
  | { action: 'redirect'; url: string }

export function sessionFollowDecision(
  page: TablePage,
  status: SessionStatus,
  sessionId: string,
): FollowDecision {
  if (page === 'session') return { action: 'stay' }
  const url = tablePathFor(status, sessionId)
  const target = tablePageFor(status)
  if (target === page) return { action: 'stay' }
  return { action: 'redirect', url }
}
```

规则：

- **详情**任何 `status` 都 `stay`，只刷新数据。流水是用户自己点进来的，不把人拽回牌桌。
- **选庄 / 战场**不在正页则 `wx.redirectTo`。已经在正页、或 `url` 等于当前页，当作 no-op。
- 正在离开的页不再 `setData`。
- 首页「再入局」和房间码进入使用 `tablePathFor`。因此 `settling` 进战场看结算，不再进选庄。`sessionDetailRoute` 仍是详情，行点击进流水不变。
- 首页 / 角色卡 / 榜 **不订阅**，不会被远程拉开。

换页一律 `redirectTo`，结束牌局也不再 `reLaunch` 首页。

## 4. 模块

| 单元 | 路径 | 职责 |
|---|---|---|
| 跟局纯函数 | `miniprogram/domain/sessionRoute.ts` | `tablePageFor` / `tablePathFor` / `sessionFollowDecision` |
| 订阅 | `miniprogram/services/sessionLive.ts` | 对页面暴露 `subscribeSession`；内部 `watch` 主、轮询垫 |
| 轮询垫 | 现有 `miniprogram/services/presencePoll.ts` | 被 `sessionLive` 调用；页面不再直接 `startPresencePoll` |
| 读剥私有字段 | `toPublicSessionDoc`（写在 `sessionLive.ts`） | 去掉 `undoStack`、`dealerPickId`、`_id` 再交给页面 |
| 写入 | `sessionApi` + `sessionWrite` | 唯一写入口；新 action `advanceToNextCycle` |

页面（选庄、战场、详情）只做：

1. `onShow`：`subscribeSession({ sessionId, page, onDoc, onNavigate })`
2. `onHide` / `onUnload`：`stop()`
3. `onDoc`：把 `SessionDoc` 画到 `data`（名册、座位、结算层、`isScorer`）
4. 改阶段的写成功后，用**已知下一状态**立刻调用 `sessionFollowDecision`（记分员不等 `watch`）

`whoami` 在一次订阅里缓存，不每 tick 打。

## 5. 传输

```
记分员写 ──► sessionWrite ──► sessions/{sessionId}
                                  │
                         watch（主） / getSession 轮询（垫）
                                  │
                            sessionLive
                                  │
              sessionFollowDecision → stay 则 onDoc，否则 onNavigate
```

### 5.1 watch

进房成功后（`enterSession` 已把调用者写入名册），客户端：

```
wx.cloud.database().collection('sessions').doc(sessionId).watch({ onChange, onError })
```

用 snapshot 里该文档的当前内容（`docs[0]` 或最后一条 `docChanges[].doc`），经 `publicDoc` 再 `onDoc` / 跟局。

### 5.2 退回轮询

出现任一条则停 watch、改 2 秒 `getSession` 轮询（`PRESENCE_POLL_MS`）：

- `onError`
- 订阅后 2 秒仍无首包
- 运行环境没有 `wx.cloud.database().collection().doc().watch`（含 mock / 单测注入）

轮询期间每 15 秒再试一次 `watch`；成功则停轮询。`stop()` 必须同时拆掉 watch 与 interval。

Mock：`subscribeSession` 立刻用 `getSession` 给首包；测试注入假 `watch` / 假 `poll`，不碰真云。

### 5.3 失败表现

- 首包失败：toast「加载失败」，保留空/旧界面，不假装在局。
- 后续 watch / 轮询失败：保持最后一帧，不清空牌桌。
- `busy` **不暂停**订阅。远端开局、关局必须能打断本地占座。

## 6. 权限与 `memberOpenIds`

客户端对 `sessions`：**不可写、不可 `where` 列举**。读单文档仅限名册中的人。

文档增加平行字段，供安全规则使用：

```
memberOpenIds: string[]   // 与 members[].openId 同序或同集合，create / enter 时维护
```

`createSession`、`enterSession`，以及任何改 `members` 的写入，都必须同步 `memberOpenIds`。每次 `sessionWrite` 存盘时若缺该字段，从 `members` 回填。旧牌局没有该字段时 watch 会订失败，轮询仍可用。

建议安全规则（写入 `docs/cloud-setup.md`，控制台手工配）：

```
{
  "read": "auth.openid != null && doc.memberOpenIds != null && auth.openid in doc.memberOpenIds",
  "write": false
}
```

`getSession` / `getSessionByRoomCode` / `listYearSettlements` 继续走云函数（服务端 SDK，不受这条客户端规则限制）。

`watch` 到的原始文档可能含 `undoStack`；客户端必须按现有云函数 `publicDoc` 剥掉 `undoStack`、`dealerPickId`、`_id` 后再交给页面。页面类型仍是 `SessionDoc`。

## 7. 页面行为

### 7.1 选庄 `dealer-pick`

订阅 `page: 'dealer-pick'`。收到 `playing` / `settling` 去战场，`ended` 去详情。删掉页面自己的 `startPresencePoll`。

记分员 `startCycle` 成功后：`sessionFollowDecision('dealer-pick', 'playing', sessionId)` → 战场。

### 7.2 战场 `battle`

订阅 `page: 'battle'`。`open` 去选庄，`ended` 去详情，`settling` 留在本页并显示结算层（现有 `showSettle` 逻辑：`status === 'settling'` 且有最近一轮 `settlements`）。

结算层：

- 记分员：按钮「再开一轮」「结束牌局」。
- 非记分员：只看数字，文案「等待记分员再开一轮或结束牌局」，不显示那两个按钮。
- 「再开一轮」调用 `advanceToNextCycle`，成功后跟局到选庄。
- 「结束牌局」调用 `endSession`，成功后 `redirectTo` 详情（不再 `reLaunch` 首页）。仅记分员可调。

录胡导致 `cycleOver`：本页已经是正页，只画结算层。

### 7.3 详情 `session`

订阅 `page: 'session'`，只 `onDoc` 刷新。记分员在此结束牌局后已经在详情，留下刷新即可，不要 `reLaunch` 首页。

### 7.4 进房

`onJoinTap` 与「再入局」都走 `tablePathFor(doc.status, sessionId)`，不要再手写 `open \|\| settling → 选庄`。

## 8. `advanceToNextCycle`

Mock 与云函数同一套：

- 断言记分员。
- `status === 'settling'` 且没有 `currentCycle`，否则扔错。
- `doc.status = 'open'`。
- 不改座位、名册、`cycles`、`hands`、`huEvents`、`chipValueYuan`。
- 返回 `void`，与 `startCycle` / `endSession` 一致。客户端写成功后按 `open` 跟局，不依赖返回体。

## 9. 测试

Vitest，先写失败用例再实现。不测真机 `watch`。

1. **`sessionFollowDecision` / `tablePathFor`**：§3 矩阵；详情始终 stay；已在正页 stay。`indexState.sessionRoute` 改为调用 `tablePathFor`；补 `settling` → 战场。
2. **`advanceToNextCycle`**：记分员从 `settling` 到 `open`；数据保留；非记分员 / 非 `settling` / 仍有 `currentCycle` 扔错。
3. **`canMutateSeats('settling') === false`**，`'open' === true`。占座单测里结清后先 `advanceToNextCycle`（或直接测 `open`）再占。
4. **`sessionLive`（注入假 watch / poll）**：
   - 首包来自 watch → `onDoc`
   - 选庄收到 `playing` → `onNavigate` 战场 url
   - 战场收到 `ended` → 详情 url
   - 详情收到 `playing` → 不 navigate
   - `onError` 或首包超时 → 开始轮询
   - `stop` 后不再 tick、不再 watch
   - watch 载荷含 `undoStack` 时，页面收到的文档没有该字段
5. **`startCycle` 在 `settling` 时扔错**，必须先 `advanceToNextCycle`。
6. 现有开局 / 录胡 / 结清 / `endSession` 验收用例仍过。

手测（DevTools 两台模拟器）：BCD 在选庄时 A 开局 → BCD 进战场；A 录胡 → BCD 牌数变；A 结清 → BCD 见结算层无按钮；A 再开一轮 → 一起回选庄；A 结束 → 一起进详情。

## 10. 云配置

在 `docs/cloud-setup.md` 增加：`sessions` 客户端只读规则（§6）、`memberOpenIds`、重新部署 `sessionWrite`。未配规则时 watch 失败、轮询仍工作，不阻塞开发。
