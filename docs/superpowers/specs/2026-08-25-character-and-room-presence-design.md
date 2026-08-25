# 角色卡与房间认人

**日期：** 2026-08-25  
**状态：** 已确认  
**范围：** 局记角色卡（名称 + 像素简笔画头像）、房间名册、选庄页占座；为后续年度报告落下按人唯一的主键。  
**形态：** 微信小程序（现有麻将局记）

## 1. 目标与非目标

### 目标

- 每人能维护一张**局记角色卡**：牌桌名 + 简笔画头像。大厅不强制先设；点人物或占座时再引导。
- 用房间码进入后，房间能看出**谁在场**（名册），不只是记分员手填的四个昵称。
- 最多四人**占座**：座位显示该人的名字和头像。没进房的人仍可由记分员代填纯文字座。
- **人**与微信账号强绑定（`openId`），角色卡只是这张脸上的名字和头像。改名改头像不产生新人。占过座的成绩按 `openId` 可累加，供以后的年度报告使用。
- 战场点座位仍然只用来录胡，不和占座抢手势。

### 非目标（本期不做）

- 微信昵称 / 微信头像照片、相册上传、自定义画头像。
- 在线心跳、离线灰掉、主动出房、踢出房间（请离座位 ≠ 请出房间）。
- 年度报告新页面、按 `openId` 重算现有榜的展示逻辑（现有 `pages/rank` 仍按座位 `playerId` + 昵称工作）。
- 陌生人匹配、俱乐部、多记分员、记分员转让。
- 对局进行中占座 / 换座。
- 运行时请求外部头像 API（DiceBear 等）。头像是打进小程序包的固定资源。

## 2. 身份模型

两层，不要混：

| 层 | 是什么 | 能否改 | 用途 |
|---|---|---|---|
| **人** | 微信小程序 `openId` | 不能改 | 用户表主键；座位 `claimedOpenId`；结算行上的人；未来年度报告分组键 |
| **角色卡** | `nickname` + `avatarId` | 随时可改 | 名册、座位、首页人物入口上的脸 |

约束：

- 不另做账号体系。登录仍是微信登录。
- 角色卡外观不来自微信资料。`wx.getUserProfile` / 微信头像昵称组件本期不用。
- 同一 `openId` 只有一张角色卡。换手机、重装后，云端用户表仍是同一个人。
- 多人可选用同一张简笔画；牌桌名允许重复。区分人只靠 `openId`。
- 记分员代填、从未占座的座位**没有** `claimedOpenId`。它们只存在于当夜流水，**不**进入「某个人」的年度报告。
- 当夜记分引擎继续用座位 `playerId`（开房时由默认方位名生成，如 `nid_东`）。占座**不**改 `playerId`，只写 `claimedOpenId`、`avatarId`，并把展示用 `nickname` 换成角色卡名。

## 3. 数据

### 3.1 用户表 `users`

云开发集合，文档 `_id` = `openId`。

```
{
  openId: string
  nickname: string          // trim 后 1–12 字
  avatarId: string          // 见 §5，必须是头像库中的 id
  updatedAt: number
}
```

本机缓存键：`character.card`（JSON，字段与上表展示字段相同）。首页与角色卡页 `onShow`：先画缓存，再 `getCharacter` 覆盖。云写入失败时保留本机副本，下次启动再 `upsertCharacter`；不得为失败路径再生成一个本地身份 id。

**角色卡已设：** `nickname.trim().length >= 1` 且 `avatarId` 为 `avatar_01`–`avatar_12` 之一。`avatar_00` 不算已设。未设时本机可以没有这份缓存；首页人物入口显示空木框。

Mock / 单测：测试注入 `openId`。`USE_MOCK=true` 且无云上下文时，本机用户固定为 `mock-local-user`（仅 mock，不上云）。

### 3.2 夜局 `sessions` 增补

在现有 session 文档上增加：

```
members: Array<{
  openId: string
  nickname: string      // 进房或最近一次同步时的角色卡快照
  avatarId: string
  joinedAt: number
}>
```

每个座位在现有 `playerId, nickname, chips, hasHu` 上增加：

```
claimedOpenId?: string    // 已占才有
avatarId?: string         // 已占才有；未占不展示头像文件
```

未占座位的 `nickname` 为代填名。开房默认 `['东','南','西','北']`（已有 `DEFAULT_SEAT_NICKNAMES`），`playerId` 仍由现有 `playerIdsFromNicknames` 生成。

### 3.3 结算行上的人

`settleCycle` 的算分输入输出**不改**（仍只认 `playerId` / 牌数）。在 `sessionWrite` / mock `sessionApi` **落库** `SettledCycle.settlements` 时，为每一行补：

```
openId: string | null     // seat.claimedOpenId ?? null
nickname: string          // 结算当时座位上的展示名
```

现有 `CycleSettlementRow` 的 `playerId, chipDelta, yuan` 保持。展示层（战场结清 sheet、夜局详情）继续用昵称；`openId` 供以后年报读取，本期 rank 页不改分组键。

`listYearSettlements` 云返回应带上这些字段（有则给，无则 `openId: null`），避免以后再扫历史文档补字段。本期 rank UI 可忽略 `openId`。

## 4. 规则

### 4.1 进房与名册

- **创建夜局：** 创建者写入 `members`（用当前角色卡；未设则 `nickname` 为「牌友」、`avatarId` 为库中占位 `avatar_00`，见 §5）。创建者是记分员，不自动占座。
- **房间码进入：** 在读到房间后必须走写操作 `enterSession`（不能只 `getSessionByRoomCode`）。幂等：已在名册则更新 `nickname` / `avatarId` 快照，不新增行、不改 `joinedAt`。
- 名册整晚保留。关闭小程序、去别的页面，都不从名册删除。本期无出房。
- 同一人可出现在多个夜局的名册里（不同 `sessionId`）。

### 4.2 占座（仅选庄页）

可占座的页面：`dealer-pick`（夜局 `open` 或 `settling`，下一轮开始前）。  
战场页、录胡 sheet、夜局详情、首页：**不能**占座。

| 动作 | 谁 | 行为 |
|---|---|---|
| 点未占座位 | 已进房且角色卡已设的任何人 | 写入该座 `claimedOpenId`、`avatarId`、把 `nickname` 换成角色卡名 |
| 点未占座位 | 角色卡未设 | 先去角色卡页，保存成功后回到选庄页，**不**自动占（用户再点一次） |
| 点自己已占的座 | 占座者 | 退座：清 `claimedOpenId` / `avatarId`，座位 `nickname` 恢复为该方位默认（东/南/西/北） |
| 点另一未占座（自己已占别处） | 占座者 | `claimSeat` 按调用者 `openId` 找到已占座，同一写里先退再占；失败则两座都不变。客户端不传旧座 id |
| 点别人已占的座 | 非记分员 | toast「座位已被占」，无变化 |
| 点别人已占的座 | 记分员 | 请离：效果同退座，被请离者仍留在名册 |
| 改代填名 | 仅记分员，且该座未占 | 改 `nickname`（1–12 字）；不写 `claimedOpenId` |
| 点座位录胡 | 战场上的记分员 | 现有行为，不变 |

已结束（`ended`）的夜局不可占座、不可改座。

### 4.3 改角色卡

保存成功后：

1. 写 `users` + 本机缓存。
2. 若当前仍在某个打开的夜局页：更新该 session 名册里自己的快照；若已占座，同步该座 `nickname` / `avatarId`。
3. 已落库的历史结算行、已结束夜局：**不回溯**改名字。

`openId` 不变。

## 5. 头像库

- **来源：** Felix Wong **Noto Avatar**（Notion 简笔画脸），[CC0](https://creativecommons.org/publicdomain/zero/1.0/)。预拼组合，不在运行时打开 notion-avatar.app。
- **数量：** `avatar_00` 占位（空木框 / 未设脸，仅名册「未设角色」与创建者未设时使用）+ **12** 张可选脸 `avatar_01` … `avatar_12`（发型、眼镜、五官组合拉开差异）。
- **外观：** 正方形；描边 `#26190c`（`--ink` / Dark Wood）；底 `#fff8f4` 或透明（底下是座位 `--panel`）。不要圆形、不要彩色贴纸风。
- **格式：** 打进 `miniprogram/assets/avatars/` 的 PNG（微信 `<image>` 对 SVG 支持不稳定）。仓库内注明 CC0 来源。
- **角色卡网格：** 只展示 `avatar_01`–`avatar_12`。保存必须选中其中一张。`avatar_00` 不能当作「已设角色」。

## 6. 页面

遵循现有 `DESIGN.md`：座位头像正方形、3px（~6rpx）深木框；触摸热区 ≥48px。

### 6.1 首页

现有右上角人物入口：已设则显示该简笔画；未设则空木框。点入角色卡页。去掉「角色卡即将开放」toast。

开局 / 进房流程不变；进房成功后走 `enterSession`。

### 6.2 角色卡页 `pages/profile/profile`

- 入口：首页人物；选庄页在「未设就占座」时 `navigateTo`，保存后 `navigateBack`。
- 内容：12 头像网格（选中态用 Sunlight 底 + 深木框，与 chip 选中语言一致）；牌桌名输入 1–12 字；保存（Moss 主按钮）。
- 保存校验：无名字或未选头像 → toast，不写库。
- 文案点明：这张卡绑在当前微信；改脸改名仍是同一个人。

### 6.3 选庄页 `pages/dealer-pick`

认人与占座主场。

- 房间码（已有）。
- **名册：** 横向一排方头像 + 名字。已占座者略降透明度。未设角色卡的成员用 `avatar_00` + 「牌友」。
- **四座：** 已占显示角色头像 + 角色名；未占显示空木框 + 代填名。
- 记分员保留「确认庄家」。非记分员仍只读选庄，但**可以占座 / 退座**。
- 记分员点未占座：不要一上手就占给自己。未占座对记分员提供「入座」与「改代填名」（改名用已有凹陷输入，确认后写库）。点已占且非自己的座：确认后请离。

### 6.4 战场页 `pages/battle`

- 四方座位补方头像（已占）或空木框（未占），名字规则同选庄。
- 点座位 = 录胡（记分员）或不可点（非记分员 / 已胡），与占座无关。
- 顶栏下增加一条矮的在场头像带（名册 `members` 的头像；横向可滑，展示全部成员，不另开名单页）。中途加入者出现在这条带上，入座等到下一轮选庄页。

### 6.5 其它

录胡名单、结清、夜局详情、现有年度榜：继续显示当时昵称。有头像的座位优先用角色名。不在这些页做占座。

## 7. 云函数与客户端 API

在现有 `sessionWrite` 上增加 action（均带 `cloud.getWXContext().OPENID`）：

| action | 谁可调 | 作用 |
|---|---|---|
| `upsertCharacter` | 登录用户 | 写 `users`；校验昵称与 `avatarId` |
| `getCharacter` | 登录用户 | 读自己的 `users` 文档，无则返回 `null` |
| `enterSession` | 任一持房间的人 | 按 `sessionId` 或 `roomCode` 把自己 upsert 进 `members` |
| `claimSeat` | 名册中的人 | 占未占座；若此人已占另一座，同一写里先退再占 |
| `unclaimSeat` | 该座 `claimedOpenId === 自己` | 退座 |
| `scorerUnclaimSeat` | 仅记分员 | 请离任意已占座 |
| `scorerRenameSeat` | 仅记分员 | 改未占座代填名 |

现有 `createSession` 在写 seats 之后把创建者插入 `members`。  
现有 `getSession` / `getSessionByRoomCode` 仍只读；客户端进房路径为：lookup → `enterSession` → 再 `getSession`（或 `enterSession` 直接返回 public doc）。

Mock：`sessionApi.ts` 实现同一套行为；多用户测试用显式 `openId` 参数或 `__setMockOpenId`。

## 8. 错误处理

全部失败用 toast / 现有 `ok: false`，不抛到未捕获。

| 情况 | 行为 |
|---|---|
| 昵称为空或全空白 | 不保存，「请填写牌桌名」 |
| 未选 `avatar_01`–`12` | 不保存，「请选一个头像」 |
| `avatarId` 非法 | 云函数拒绝 |
| `upsertCharacter` 网络失败 | 本机已编辑的值保留在页面/缓存；toast「保存失败，稍后重试」；不以新 id 顶替 `openId` |
| 房间不存在 | 现有「房间不存在」 |
| `enterSession` 失败 | 「加入失败」，不进入选庄/战场 |
| 占已占座 | 「座位已被占」 |
| 未进房就占座 | 先 `enterSession`，失败则停止 |
| 夜局已 `ended` 或非选庄场景占座 | 拒绝 |
| 换座中途失败 | 两座保持原状 |
| 非记分员 `scorer*` | 现有 scorer 校验错误 |

并发：后写覆盖。两人同时占同一空座，以后到云函数、文档版本为准；失败者看到「座位已被占」（用「若 `claimedOpenId` 已存在则 abort」的条件更新，避免静默抢座）。

## 9. 测试

单测（mock `sessionApi` + 纯函数）：

- 角色卡校验：空名、合法保存、非法 `avatarId`。
- `enterSession` 幂等；快照随角色卡更新。
- 占空座；拒占已占；自己退座恢复方位默认名；换座原子性；未设角色不能占。
- 记分员请离、改未占代填名；非记分员不能请离/改名。
- 创建者出现在 `members` 且默认不占座。
- 结算落库：已占座行 `openId` 有值，未占座行 `openId === null`。
- 改角色卡后名册与已占座展示变，`openId` / `playerId` 不变。

不在本期用真机云环境作为 CI 门槛；`USE_MOCK=true` 的现有 `npm test` 必须绿。

## 10. 与旧文档的关系

修订 `docs/superpowers/specs/2026-08-06-mahjong-score-miniprogram-design.md` §2 的含义（不必改那份历史正文）：其余玩家不再只是「以后绑微信」——本期进房即登记 `openId`，占座即绑定到人。记分权限仍仅记分员。

`PRODUCT.md` 的「微信登录即可，不另做账号体系」保持不变。
)
