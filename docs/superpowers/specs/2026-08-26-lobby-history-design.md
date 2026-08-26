# 大厅最近牌局与全部牌局

**日期：** 2026-08-26
**状态：** 已确认
**范围：** 首页「最近牌局」截成 5 条；超出则进新页看自己名册里的全部牌局。数据源改为云端 `memberOpenIds`，去掉本机缓存与左滑删除。
**形态：** 微信小程序（现有麻将局记）
**用户文案：** Session 对用户叫「牌局」。新页标题「全部牌局」。代码标识符可用 `history` / `listMySessions`。

## 1. 目标与非目标

### 目标

- 首页「最近牌局」默认最多 5 条，按开局时间新→旧。
- 超过 5 条时，列表下提供「查看全部」，进入新页看该用户进过房间的所有牌局（受查询上限约束）。
- 列表以云端名册为准：`sessions.memberOpenIds` 包含当前 `openId`。换设备可见。
- 去掉左滑删除。行只用于查看详情与再入局。

### 非目标

- 不出房、不从名册删除、不本机隐藏某局。
- 不给 session 补 `updatedAt`，不做结束时间相对文案。
- 列表不 `watch`、不翻页。
- 不改开局、进房、选庄、录胡、结清、角色卡。
- 不按房间码从客户端扫集合；客户端仍不得写 `sessions`。

## 2. 决策

现有大厅「最近牌局」写在本机 `lobby.recentCampaigns`，上限 6 条。换机、清缓存会丢；超过 6 条的参与记录也不存在。名册和 `memberOpenIds` 已经按人记下进房，和「参与过的所有牌局」对齐。

左滑删除只改本机列表，云端名册不变，换机仍会出现。本期不做主动出房，因此删除手势一并去掉。

## 3. 界面

### 3.1 首页

「最近牌局」区块：

- 展示 `listMySessions({ limit: 6 })` 结果的前 5 条。
- 返回 6 条时，第 6 条不展示，其下出现「查看全部」，点 → `/pages/history/history`。
- 返回 ≤5 条时不出现「查看全部」。
- 空状态文案保持：「开一局或输入房间码，牌局会出现在这里。」
- 去掉 swipe 容器、删除钮、`lockingScroll`、相关 touch 处理。

行交互不变：

| 动作 | 结果 |
|---|---|
| 点整行 | 牌局详情 `pages/session/session` |
| 进行中点「再入局」 | 现有 `sessionRoute`（选庄或战场） |
| 已结束 | 右侧文案「已结束」，无再入局钮 |

进行中副文案：`底分 {{chipValueYuan}}`。已结束副文案：`已结束`（不再用本机 `updatedAt` 写「x 小时前」）。

### 3.2 全部牌局页 `pages/history/history`

- `app.json` 注册。原生顶栏标题「全部牌局」，纸底黑字，与榜页一致。
- `wx.navigateTo` 进入，系统返回回首页。
- `onShow` 调 `listMySessions({ limit: 50 })`，整表展示，不截 5 条，无「查看全部」。
- 行样式与交互同首页（无左滑）。
- 空状态：「你参加过的牌局会出现在这里。」
- 无开局、进房、身份条。

## 4. 数据

### 4.1 `listMySessions`

`miniprogram/services/sessionApi.ts` 新增：

```
listMySessions(opts?: { limit?: number }): Promise<SessionSummary[]>
```

```
SessionSummary {
  sessionId: string
  roomCode: string
  chipValueYuan: number
  status: SessionStatus
  createdAt: number
}
```

默认 `limit` 对调用方显式传入：首页 6、全部页 50。实现里再 `Math.min(limit, 50)`，防止误传过大。

**云端（`USE_MOCK === false`）：**

1. `whoami()` 得 `openId`。
2. `wx.cloud.database().collection('sessions')`：
   - `where({ memberOpenIds: openId })`（数组包含）
   - `.field({ sessionId: true, roomCode: true, chipValueYuan: true, status: true, createdAt: true })`
   - `.orderBy('createdAt', 'desc')`
   - `.limit(limit)`
   - `.get()`
3. 每条用与 `toPublicSessionDoc` 相同的 `_id` 回填：缺 `sessionId` 时用 `_id`。缺字段的行丢弃。

**Mock：** 扫内存店，`memberOpenIds` 包含当前 mock actor（`__getMockActor()` / `MOCK_SCORER_ID`），按 `createdAt` 降序，截 `limit`。不走云函数。

没有 `memberOpenIds` 的旧文档不会命中（与现有只读规则、watch 订失败的处理一致）。

### 4.2 大厅存储

删除首页对 `RECENT_STORAGE_KEY` / `lobby.recentCampaigns` 的读写。开房、进房不再 `remember` 本机列表；`enterSession` 仍执行，下次 `onShow` 从云端拉到。

`indexState` 可删：`MAX_RECENT`、`RECENT_STORAGE_KEY`、`upsertRecentCampaign`、`removeRecentCampaign`、`parseStoredCampaigns`、swipe 辅助函数、`formatEndedAgo`。`RecentCampaign` 与 `SessionSummary` 同形（无 `updatedAt`）；`presentRecentCampaign(campaign)` 不再接收 `now`。保留 `sessionRoute`、`sessionDetailRoute`。

新增纯函数：

```
HOME_RECENT_LIMIT = 5
HOME_FETCH_LIMIT = 6
HISTORY_FETCH_LIMIT = 50

sliceHomeRecents(list: SessionSummary[]): { recents: SessionSummary[]; hasMore: boolean }
```

`hasMore === list.length > HOME_RECENT_LIMIT`；`recents` 为前 5 条。调用方负责用 `HOME_FETCH_LIMIT` 去拉。

已结束 `meta` 固定为 `'已结束'`。

### 4.3 云配置

`docs/cloud-setup.md`：

- **允许**客户端 `where({ memberOpenIds: <自己的 openId> })` 列表查询（只读、字段裁剪）。安全规则仍是 `auth.openid in doc.memberOpenIds`。
- **禁止**按 `roomCode` 从客户端扫集合；房间码查找仍走 `sessionWrite`。
- 控制台为 `sessions` 建复合索引：`memberOpenIds` 升序 + `createdAt` 降序。无索引时 `orderBy` 会失败，列表走 §5 错误处理。

不改安全规则字符串（现有已够成员读自己的局）。不新增云函数 action。

## 5. 刷新与错误

- 首页与全部页都只在 `onShow` 拉一次，与「大厅列表不实时」一致。
- 加载中：已有列表则保留；没有则不要先闪空状态。全部页可与榜页一样先「加载中…」。
- 失败：`wx.showToast({ title: '加载失败', icon: 'none' })`。已有列表保留；从来没有则空状态。
- 查询命中 50 条上限时全部页就显示这 50 条，不提示「还有更多」。

## 6. 测试

- `sliceHomeRecents`：0、5、6 条 → 截断与 `hasMore`。
- `presentRecentCampaign`：进行中 `底分 N`；已结束 `已结束`，无相对时间。
- mock `listMySessions`：只返回自己在 `memberOpenIds` 里的局；`createdAt` 降序；遵守 `limit`。
- 删除左滑与本机缓存相关用例。
- 不在 CI 里打真微信 `database.get`。

## 7. 验收

- 参与超过 5 局后，首页只看到最新 5 条和「查看全部」；点进全部页能看到更多（含第 6 条及更早）。
- ≤5 局时首页无「查看全部」。
- 换一个已登录的模拟器，同一 `openId` 能看到同一份列表（`USE_MOCK=false`）。
- 未进过房的 `openId` 看不到别人的局。
- 首页与全部页都不能左滑删除。
- 点行 / 「再入局」路径与改前一致。
- `npm test` 通过。
