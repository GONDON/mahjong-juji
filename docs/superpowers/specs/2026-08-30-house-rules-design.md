# 桌规对象与自摸加番

**日期：** 2026-08-30  
**状态：** 已确认  
**范围：** 开房时选定桌规；这轮只做自摸两种算法。算分、预览、流水都读这块桌规。  
**形态：** 微信小程序（现有麻将局记）

## 1. 目标与非目标

### 目标

- Session 上有一块 `houseRules`，开房写入，之后只读。以后有争议的算法往同一对象加字段。
- 这轮只有 `zimoFan`：`none`（不加番，三家各付当前番分）或 `plusOne`（自摸时番积再 ×2）。
- 新开房默认 **加一番**。
- 没有该字段的老局按 **不加番** 读，进行中的下一胡不改算法。
- 开房人在首页「快速开局」和创建页都能选。
- 录胡预览与入账用同一套 `scoreHu(..., houseRules)`。

### 非目标

- 不在选庄或对局中改桌规。
- 不做本机「上次用过的桌规」记忆。
- 不做查花猪、刮风下雨当场结算、一炮多响、呼叫转移。
- 不改杠分、庄倍公式、谁付钱（自摸未胡者都付，点炮只点炮者付）。
- 最近牌局列表不写桌规。

## 2. 界面

### 2.1 首页「快速开局」

井里在入局牌数下加 **桌规** 一块。这轮一行：

- 标签：自摸
- 两档胶囊（与底分同一套 chip）：`不加番` / `加一番`
- 默认选中 **加一番**

副文案改为：「设好底分、牌数和桌规，邀请牌友用房间码入座」。

### 2.2 创建页 `pages/create`

入局牌数和四人昵称之间同样一块。默认与校验和首页共用。

### 2.3 流水页

`面值 {{chipValueYuan}} 元/牌 · 入局 {{startingChips}} · {{zimoFanLabel}}`

- `plusOne` → `自摸加一番`
- `none` → `自摸不加番`

战场不另写一行，录胡也不让改。

### 2.4 录胡预览

句式不变：`每人 N 牌（番 X + 杠 Y 庄倍×Z …）`。

自摸且桌规为 `plusOne` 时，括号里多写 `自摸×2`。点炮不加这句。

例：非庄普通自摸、加一番 → `每人 2 牌（番 2 + 杠 0 庄倍×1 自摸×2）`。

## 3. 数据

写在 `sessions` 文档上，与 `chipValueYuan`、`startingChips` 同级。开房写入，之后只读。

```ts
type ZimoFan = 'none' | 'plusOne'

type HouseRules = {
  zimoFan: ZimoFan
}
```

两套读法：

| 函数 | 用在 | 缺省 / 坏值 |
|------|------|-------------|
| `requireHouseRules` | 开房 | 没传 → `{ zimoFan: 'plusOne' }`；非法 → 拒绝创建 |
| `readHouseRules` | 读已有局 | 缺字段或坏值 → `{ zimoFan: 'none' }` |

`SessionDoc` 带 `houseRules`。`SessionSummary` / 最近牌局列表这轮不带。

## 4. 领域

`miniprogram/domain/houseRules.ts`：类型、默认值、`requireHouseRules` / `readHouseRules`、短文案。云函数 `sessionWrite/domain.js` 镜像同一套。

`scoreHu(table, input, houseRules)` 第三参必传。

```
番积 = 基本番 × 附加番 × (自摸且 plusOne ? 2 : 1)
单人番分 = 番积 × 庄倍
每人应付 = 单人番分 + 杠分
```

- 点炮永远不乘这 2。
- 杠上花等附加番照旧连乘（平胡杠上花自摸 + plusOne = 1×2×2 = 4）。
- 付款人不变。
- 录胡快照仍存当时算出来的分，不回头重算。

对照（非庄、无附加、无杠）：

| 手 | none | plusOne |
|----|------|---------|
| 平胡自摸 | 每人 1 | 每人 2 |
| 对对胡自摸 | 每人 2 | 每人 4 |
| 平胡点炮 | 点炮者 1 | 点炮者 1 |
| 对对胡点炮 | 点炮者 2 | 点炮者 2 |

`hu-sheet` 增加 `houseRules` 属性，战场从 session 传入。

## 5. 测试

- `houseRules`：没传默认 plusOne；缺字段 / 坏值读成 none；非法创建拒绝。
- `scoreHu`：上表四行；杠上花自摸 plusOne → 每人 4；none 保持现有每人 1。
- 现有点炮、庄倍、杠分、入局牌数用例继续绿（调用处补 `{ zimoFan: 'none' }`，数字与现在相同）。
- 开房写入 plusOne；不传 `houseRules` 的老 fixture 走 `readHouseRules`，仍按 none 算。
- 流水页 meta 含自摸文案；预览在 plusOne 自摸时含 `自摸×2`。

## 6. 部署

改了 `sessionWrite`，需在开发者工具重新上传该云函数后，真机 / 开发者工具才生效。mock 单测不依赖云。
