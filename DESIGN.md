---
name: 麻将局记
description: 纸上的牌友脸 — Notion / Noto 纸墨简笔画记分
colors:
  paper: "#fffefc"
  panel: "#ffffff"
  ink: "#1c1917"
  muted: "#5c574f"
  on-fill: "#ffffff"
  peach: "#f9c9b6"
  peach-wash: "#fde8dc"
  dealer: "#d4a017"
  gain: "#2f7d4a"
  loss: "#c45c4a"
typography:
  display:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.02em"
  headline:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "8px"
  lg: "8px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  button-primary-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.pill}"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  input-field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  chip-default:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "7px 12px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.md}"
    padding: "7px 12px"
  seat-tile:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "14px 10px"
  badge-dealer:
    backgroundColor: "{colors.dealer}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "2px 5px"
  sheet-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "14px 14px"
---

# Design System: 麻将局记

## 1. Overview

**Creative North Star: "纸上的牌友脸"**

界面像摊开的记分本：白纸底、黑墨线、方框里的 Noto 简笔画脸。主按钮是墨黑胶囊、白字。记分员在桌上单手操作时，界面应安静可读。俏皮来自脸和线，不来自贴纸墙或像素农庄菜单。

这是 **product** 工具 UI：熟悉、可点、信息优先。简笔画服务于认人和情绪，不做成头像工坊 landing page。密度跟着任务走。战场页信息紧，首页可稍松。

明确拒绝：过于幼齿的贴纸 / 表情包堆砌风；微信默认灰白表单、无个性后台感；电竞暗黑麻将客户端；已退役的星露谷草地绿 / 木框 / 羊皮纸。也拒绝把 MVP 的 `#111` / `#1a1a1a` 暗底当作品牌默认。

**Key Characteristics:**
- 白纸底 + 白板块，永不默认暗黑
- 墨黑主 CTA；金标仅用于「庄」
- 扁平：深度靠粗墨边与色阶，不靠大阴影
- 方框头像（不圆形）+ 胶囊按钮
- 微信小程序实现：尺寸以 rpx 落地（本文 px ≈ 设计稿 1×，小程序约 ×2 rpx）

## 2. Colors

策略偏 **Restrained**：大面积纸与墨，语义色只占状态面积。Peach 只活在插画里，不当按钮色。

### Primary
- **Ink** (`{colors.ink}`): 主文字、描边、主行动填色。填充按钮上的文字用 `{colors.on-fill}`。按下降低不透明度，不另换色。

### Secondary
- **Dealer** (`{colors.dealer}`): 稀有状态色，「庄」角标。禁止大面积铺底；稀缺才有识别力。

### Tertiary
- **Loss** (`{colors.loss}`) / **Gain** (`{colors.gain}`): 流水与结算里的输/赢数字。不用霓虹红绿，也不用已退役的草地绿。

### Neutral
- **Paper** (`{colors.paper}`): 页面底色，全局 `page` / `window.backgroundColor`。
- **Panel** (`{colors.panel}`): 座位块、sheet、榜单卡片、输入底、chip。
- **Muted** (`{colors.muted}`): 次要说明、占位、辅助标签。
- **Peach** (`{colors.peach}`): 仅插画肤色与点缀。角色卡选中格可用 **Peach Wash** (`{colors.peach-wash}`) + 厚墨边。

### Named Rules
**The Paper Rule.** 默认表面必须是 Paper / Panel。禁止把暗黑 `#111`/`#1a1a1a` 或电竞黑底当作默认主题。本期不做暗色对翻。

**The Ink Button Rule.** 主行动（开牌局、确认录胡、确认选庄、保存角色卡）只用 Ink 填色 + 白字。选中 chip 同语言。禁止草地绿、禁止 Peach 当按钮。

**The Scarce Gold Rule.** Dealer 金标专留给庄家及相关高价值状态；普通按钮、榜单行、装饰条不得用金。

**The Peach Illustration Rule.** Peach 只出现在 SVG/PNG 简笔画内部，或角色卡选中格的浅洗。不得铺页面底、不得填 CTA。

## 3. Typography

**Display Font:** PingFang SC（fallback: Hiragino Sans GB, Microsoft YaHei, sans-serif）
**Body Font:** 同上（单字体族）
**Label/Mono Font:** 无独立 mono；房间码可用略宽字距的 label 样式

**Character:** 系统黑体承担全部层级。不引入展示衬线或手写字体。可爱来自脸与墨线，不来自花字。

### Hierarchy
- **Display** (700, 28px / ~56rpx, 1.25): 首页品牌名「麻将局记」等少数标题。字距不低于 -0.04em，此处用 0.02em。
- **Headline** (700, 22px / ~44rpx, 1.3): 选庄页、榜单页主标题。
- **Title** (600, 17px / ~34rpx, 1.35): Sheet 标题、区块标题、顶栏主句。
- **Body** (400, 16px / ~32rpx, 1.45): 昵称、说明、表单内容。
- **Label** (500, 13px / ~26rpx, 1.3): 辅助说明、座位方位、chip 文案、流水次要信息。牌数可用更大数字（接近 Display）但字重保持清晰。

### Named Rules
**The System Type Rule.** 不引入第二字体族做「更可爱」。

**The Thumb Label Rule.** 战场与录胡路径上的可点标签 ≥13px（~26rpx）；关键确认按钮字号 ≥16px（~32rpx）。

## 4. Elevation

系统默认 **扁平**。深度来自：墨色粗边框、面板与纸底的色阶差、选中时填墨。不是投影。

几乎不使用 `box-shadow`。底部 sheet 遮罩用 `{colors.ink}` 约 45% 不透明。sheet 本身 Paper/Panel + 顶边圆角，不加模糊大阴影。

不要给每个控件做假手绘浪边。微信 WXSS 的 `border` 是几何的；气质靠厚墨线（4–6rpx）、胶囊按钮、简笔画脸。

### Shadow Vocabulary
- **None by default:** 按钮、座位、卡片、chip 均无阴影。
- **Mask only:** 底部 sheet / 录胡层使用半透明遮罩分隔上下文。

### Named Rules
**The Ink Frame Rule.** 可交互块用 2–3px（~4–6rpx）实色 Ink 边框。边框即深度；禁止用宽模糊阴影冒充层次。

**The Flat-By-Default Rule.** 休息态表面扁平。状态变化用边框色、填充色、字色，不用位移阴影。

## 5. Components

组件气质：**纸上的墨线控件。** 按钮全胶囊；座位与头像格 8px（~16rpx）圆角。头像必须正方形，不圆形。

### Buttons
- **Shape:** 全胶囊 (`{rounded.pill}`)，高度主按钮约 52px（~104rpx）。
- **Primary:** Ink 底 + 白字；按下降低不透明度。6rpx 同色边。
- **Ghost:** 透明底 + Ink 字 + Ink 粗边；用于「加入牌局」、次要操作。
- **Bar actions（战场底栏）:** 同 Ghost 密度；危险/破坏性操作不另造红底大按钮，文案说清楚即可，必要时用 Loss 字色。

### Chips
- **Style:** Panel 底 + Ink 边 + Ink 字；选中 = Ink 底 + 白字。
- **State:** 番型多选、自摸/点炮切换；未选不灰死，保持可点对比。

### Cards / Containers
- **Corner Style:** `{rounded.md}`（8px / ~16rpx）。
- **Background:** Panel。
- **Shadow Strategy:** 无；见 Elevation。
- **Border:** Ink 2–3px（座位等主交互用粗边）。
- **Internal Padding:** `{spacing.md}`–`{spacing.lg}`。

### Inputs / Fields
- **Style:** Panel 底、Ink 边、Ink 字；占位用 Muted（对比仍清晰）。
- **Focus:** 边框保持 Ink，可略加粗；不加外发光。
- **Error / Disabled:** 错误边框 Loss；禁用降低不透明度。

### Navigation
- 微信原生导航栏：背景 Paper，标题 Ink，返回箭头深色。禁止暗色导航栏配白字。首页标题继承全局「麻将局记」，不用 `navigationStyle: custom`。
- 页内无侧栏、无假 tabBar。大厅身份条是内容入口（方框头像 → 角色卡，「年度榜」字 → 榜），不是第二条工具栏，不要底边框。
- 战场 / 流水从最近牌局进入；战场底栏仍是操作（流局 / 结清 / 撤销），不是导航 tab。

### Seat Tile（签名组件）
- 四方桌座位：Panel 底 + 粗 Ink 框；牌数用大号数字；头像正方形 Ink 框。
- **庄:** Dealer 金角标。可选金边，但不改座位填色为大面积金。
- **已胡:** 降低不透明度或角标「已胡」，不只靠变灰。
- **可点:** 整块热区；中心提示「点座位录胡」用 Muted。

### Hu Sheet / Settle Sheet
- 底部升起 Panel 面板；遮罩半透明 Ink；标题 Title；确认按钮同 Primary。
- 内部 chip 与步进器遵循同一边框语言。

## 6. Do's and Don'ts

### Do:
- **Do** 用 Paper 作页面底、Panel 作块面，保持「纸上的牌友脸」。
- **Do** 主行动只用 Ink 填色，并保证白字清晰。
- **Do** 用粗墨边表达可点与选中，而不是阴影。
- **Do** 庄状态用 Dealer 金且保持稀缺。
- **Do** 战场与录胡路径优先大热区、短路径（桌上优先）。
- **Do** 头像用方框里的简笔画 PNG/SVG。

### Don't:
- **Don't** 使用过于幼齿的贴纸 / 表情包堆砌风。
- **Don't** 退回微信默认灰白表单、无个性后台感。
- **Don't** 做成电竞暗黑麻将客户端。
- **Don't** 把 MVP 暗底 `#111` / `#1a1a1a` 当作成品主题。
- **Don't** 给按钮/卡片加宽模糊大阴影。
- **Don't** 大面积铺 Dealer 金，或把 Peach / 旧草地绿当背景或 CTA。
- **Don't** 用渐变字、侧边彩条、玻璃拟态、假手绘浪边。
- **Don't** 把 notion-avatar.app 的 landing 结构（hero、四步教程、评价墙）搬进记分工具。
