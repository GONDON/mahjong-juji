# 纸墨简笔画 UI

**日期：** 2026-08-25
**状态：** 已确认
**范围：** 将麻将局记视觉身份从星露谷木框/草地绿，改为 Notion / Noto 纸墨简笔画。记分流程、角色卡与占座逻辑不动。
**形态：** 微信小程序（现有麻将局记）

## 1. 目标与非目标

### 目标

- 全站（大厅、角色卡、选庄、战场、录胡 sheet、流水、榜、创建）使用同一套纸墨 token。
- 主按钮：墨黑填色、白字、全胶囊。
- 选中 chip：墨底白字。
- 头像：正方形墨框 + 现有 `avatar_01`–`avatar_17` PNG。
- 大厅文案「征程」改为「牌局」。
- 现在仍是 `#1a1a1a` 的页面改为 Paper。

### 非目标

- 不改占座、角色卡校验、算分、云函数。
- 不做头像编辑器，不请求外部头像 API。
- 不引入 Tailwind / Motion / 第二字体。
- 不给每个盒子做手绘浪边或素描滤镜。
- 不把 notion-avatar.app 做成 landing page（不要 hero、四步教程、评价墙）。
- 本期不做暗色主题。

## 2. Token

见 `DESIGN.md` 与 `miniprogram/styles/tokens.wxss`。

| 角色 | Hex | 用途 |
|---|---|---|
| Paper | `#fffefc` | 页面底、导航栏 |
| Panel | `#ffffff` | 输入、chip、座位、sheet |
| Ink | `#1c1917` | 字、描边、主按钮底 |
| Muted | `#5c574f` | 说明、占位 |
| On-fill | `#ffffff` | 墨底上的字 |
| Peach | `#f9c9b6` | 仅插画 |
| Peach wash | `#fde8dc` | 角色卡选中格浅洗 |
| Dealer | `#d4a017` | 仅「庄」角标 |
| Gain | `#2f7d4a` | 赢分 |
| Loss | `#c45c4a` | 输分 |

形状：主按钮全胶囊、高 104rpx、6rpx 墨边。座位/头像格 16rpx 圆角、6rpx 墨边。Chip 选中 = 墨底白字。

## 3. 共享类

落在 `miniprogram/app.wxss`：`.btn-ink`、`.btn-ghost`、`.chip`、`.chip--on`、`.tile`、`.well`、`.face-frame`、`.empty-state`、`.yuan-up`、`.yuan-down`。

页面只改 class / wxss / 少量文案。不改 domain。

## 4. 文案

| 旧 | 新 |
|---|---|
| 开始征程 | 开牌局 |
| 加入征程 | 加入牌局 |
| 最近征程 | 最近牌局 |
| 再入局 | 再入局（保留） |

用户可见文案继续用「牌局」，不用「夜局」。

## 5. 空状态

空列表配 `empty.svg` + 一句可执行说明（开一局、输入房间码、打完再看榜），不用「暂无数据」。
