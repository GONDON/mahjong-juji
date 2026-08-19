---
name: 麻将局记
description: 鹈鹕镇白天牌桌 — 星露谷式日间像素记分
colors:
  meadow-green: "#3e8343"
  meadow-deep: "#235b28"
  sky-day: "#e5f5fa"
  panel-wood: "#f0e7d6"
  ink-soil: "#1c2e1c"
  muted-ink: "#5b675b"
  wood-frame: "#77562f"
  harvest-gold: "#dbb155"
  clay-loss: "#b54a46"
  chip-gain: "#3a8f42"
  border-soft: "#cdc3af"
  on-fill: "#ffffff"
typography:
  display:
    fontFamily: "PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.04em"
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
  sm: "6px"
  md: "8px"
  lg: "10px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.meadow-green}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "52px"
  button-primary-active:
    backgroundColor: "{colors.meadow-deep}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.md}"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soil}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "48px"
  input-field:
    backgroundColor: "{colors.panel-wood}"
    textColor: "{colors.ink-soil}"
    rounded: "{rounded.sm}"
    padding: "0 14px"
    height: "44px"
  chip-default:
    backgroundColor: "{colors.panel-wood}"
    textColor: "{colors.ink-soil}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  chip-selected:
    backgroundColor: "{colors.meadow-green}"
    textColor: "{colors.on-fill}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
  seat-tile:
    backgroundColor: "{colors.panel-wood}"
    textColor: "{colors.ink-soil}"
    rounded: "{rounded.md}"
    padding: "14px 10px"
  badge-dealer:
    backgroundColor: "{colors.harvest-gold}"
    textColor: "{colors.ink-soil}"
    rounded: "{rounded.sm}"
    padding: "2px 5px"
  sheet-panel:
    backgroundColor: "{colors.panel-wood}"
    textColor: "{colors.ink-soil}"
    rounded: "{rounded.lg}"
    padding: "14px 14px"
---

# Design System: 麻将局记

## 1. Overview

**Creative North Star: "鹈鹕镇白天牌桌"**

界面像星露谷小镇的白天：柔光天空底、浅木色面板、草地绿主行动、粗木色像素边框。记分员在桌上单手操作时，界面应安静可读，俏皮但不喧哗。温暖来自材质与边框，不靠暗色氛围或霓虹。

这是 **product** 工具 UI：熟悉、可点、信息优先。像素风服务于识别与情绪，不做成贴纸墙或过场动画秀。密度跟着任务走——战场页信息紧，首页可稍松。

明确拒绝：过于幼齿的贴纸 / 表情包堆砌风；微信默认灰白表单、无个性后台感；电竞暗黑麻将客户端（霓虹、重金属、竞技 HUD）。也拒绝把当前 MVP 的 `#111` / `#1a1a1a` 暗底当作品牌默认。

**Key Characteristics:**
- 日间天空底 + 木色面板，永不默认暗黑
- 草地绿主 CTA；金琥珀仅用于「庄」等稀有状态
- 扁平：深度靠粗边框与色阶，不靠大阴影
- 厚边可点的像素块，像农庄菜单
- 微信小程序实现：尺寸以 rpx 落地（本文 px ≈ 设计稿 1×，小程序约 ×2 rpx）

## 2. Colors

日间柔和、略带游戏 UI 的命名色：天空、草地、木框、收获金。策略偏 **Restrained**：大面积中性日间色，草地绿与金琥珀合计约占可点击/状态面积的 ≤15%。

### Primary
- **Meadow Green** (`{colors.meadow-green}`): 主行动——开新局、确认录胡、确认选庄、本轮结清。填充按钮上的文字用 `{colors.on-fill}`。按下用 **Meadow Deep** (`{colors.meadow-deep}`)。

### Secondary
- **Harvest Gold** (`{colors.harvest-gold}`): 稀有状态色——「庄」角标、连庄强调。禁止大面积铺底；稀缺才有识别力。

### Tertiary
- **Clay Loss** (`{colors.clay-loss}`) / **Chip Gain** (`{colors.chip-gain}`): 流水与结算里的输/赢数字。不用霓虹红绿。

### Neutral
- **Sky Day** (`{colors.sky-day}`): 页面底色（日间天空），全局 `page` / `window.backgroundColor`。
- **Panel Wood** (`{colors.panel-wood}`): 座位块、sheet、榜单卡片、输入底。
- **Ink Soil** (`{colors.ink-soil}`): 主文字。
- **Muted Ink** (`{colors.muted-ink}`): 次要说明、占位、辅助标签。
- **Wood Frame** (`{colors.wood-frame}`): 粗像素边框、选中描边的默认木色。
- **Border Soft** (`{colors.border-soft}`): 列表分割、轻描边。

### Named Rules
**The Daylight Table Rule.** 默认表面必须是日间色（Sky Day / Panel Wood）。禁止把暗黑 `#111`/`#1a1a1a` 或电竞黑底当作默认主题。

**The One Meadow Rule.** Meadow Green 只用于主行动与明确选中态；装饰性色块、大面积背景禁止刷绿。

**The Scarce Gold Rule.** Harvest Gold 专留给庄家及相关高价值状态；普通按钮、榜单行、装饰条不得用金。

## 3. Typography

**Display Font:** PingFang SC（fallback: Hiragino Sans GB, Microsoft YaHei, sans-serif）  
**Body Font:** 同上（单字体族）  
**Label/Mono Font:** 无独立 mono；房间码可用略宽字距的 label 样式

**Character:** 系统黑体承担全部层级。不引入展示衬线或像素点阵字体文件——像素感交给边框与色块，字体保持可读与微信原生一致。

### Hierarchy
- **Display** (700, 28px / ~56rpx, 1.25): 首页品牌名「麻将局记」等少数标题。
- **Headline** (700, 22px / ~44rpx, 1.3): 选庄页、榜单页主标题。
- **Title** (600, 17px / ~34rpx, 1.35): Sheet 标题、区块标题、顶栏主句。
- **Body** (400, 16px / ~32rpx, 1.45): 昵称、说明、表单内容。
- **Label** (500, 13px / ~26rpx, 1.3): 辅助说明、座位方位、chip 文案、流水次要信息。牌数可用更大数字（接近 Display）但字重保持清晰。

### Named Rules
**The System Type Rule.** 不引入第二字体族做「更可爱」。可爱来自色与框，不来自花字。

**The Thumb Label Rule.** 战场与录胡路径上的可点标签 ≥13px（~26rpx）；关键确认按钮字号 ≥16px（~32rpx）。

## 4. Elevation

系统默认 **扁平**。深度来自：木色粗边框、面板与天空底的色阶差、选中时边框加粗或变绿——不是投影。

几乎不使用 `box-shadow`。若平台强依赖阴影（如 sheet 与遮罩分层），遮罩用半透明 Ink Soil（约 45% 不透明），sheet 本身仍靠 Panel Wood + 顶边圆角，不加模糊大阴影。

### Shadow Vocabulary
- **None by default:** 按钮、座位、卡片、chip 均无阴影。
- **Mask only:** 底部 sheet / 录胡层使用半透明遮罩分隔上下文，不算「抬起」阴影。

### Named Rules
**The Pixel Frame Rule.** 可交互块用 2–3px（~4–6rpx）实色边框（Wood Frame 或 Meadow Green）。边框即深度；禁止用宽模糊阴影冒充层次。

**The Flat-By-Default Rule.** 休息态表面扁平。状态变化用边框色、填充色、字色，不用位移阴影。

## 5. Components

组件气质：**厚边可点的像素块，像农庄菜单。** 圆角克制（6–10px），宁可方一点也不要 16px+ 的软胶囊堆砌。

### Buttons
- **Shape:** 轻圆角 (`{rounded.md}` = 8px / ~16rpx)，高度主按钮约 52px（~104rpx）。
- **Primary:** Meadow Green 底 + 白字；按下 Meadow Deep。边框可省略或同色更深 1px，避免灰边。
- **Ghost:** 透明底 + Ink Soil 字 + Wood Frame / Border Soft 粗边；用于「年度榜」、次要操作。
- **Bar actions（战场底栏）:** 同 Ghost 密度；危险/破坏性操作不另造红底大按钮，文案说清楚即可，必要时用 Clay Loss 字色。

### Chips
- **Style:** Panel Wood 底 + 细/中 Wood 边 + Ink 字；选中 = Meadow 底 + 白字 + 深绿边。
- **State:** 番型多选、自摸/点炮切换；未选不灰死，保持可点对比。

### Cards / Containers
- **Corner Style:** `{rounded.md}`–`{rounded.lg}`（8–10px）。
- **Background:** Panel Wood。
- **Shadow Strategy:** 无；见 Elevation。
- **Border:** Wood Frame 2–3px（座位等主交互用粗边）。
- **Internal Padding:** `{spacing.md}`–`{spacing.lg}`。

### Inputs / Fields
- **Style:** Panel Wood 底、Wood Frame 边、Ink 字；占位用 Muted Ink（对比仍清晰，不用浅灰糊掉）。
- **Focus:** 边框切 Meadow Green，不加外发光。
- **Error / Disabled:** 错误边框 Clay Loss；禁用降低不透明度，不改成微信灰死白。

### Navigation
- 微信原生导航栏：背景 Sky Day 或 Panel Wood，标题 Ink Soil，返回箭头深色。禁止继续用暗色导航栏配白字作为品牌默认。
- 页内无侧栏；入口靠首页主按钮 + ghost 次入口。

### Seat Tile（签名组件）
- 四方桌座位：Panel Wood 底 + 粗 Wood Frame；牌数用大号数字。
- **庄:** Harvest Gold 角标 + 可选金边。
- **已胡:** 降低饱和/虚边或角标「已胡」，不只靠变灰。
- **可点:** 整块热区；中心提示「点座位录胡」用 Muted Ink。

### Hu Sheet / Settle Sheet
- 底部升起 Panel Wood 面板；遮罩半透明；标题 Title；确认按钮同 Primary。
- 内部 chip 与步进器遵循同一边框语言，禁止突然变成系统默认灰控件堆。

## 6. Do's and Don'ts

### Do:
- **Do** 用 Sky Day 作页面底、Panel Wood 作块面，保持「鹈鹕镇白天」。
- **Do** 主行动只用 Meadow Green，并保证填充上的白字清晰。
- **Do** 用粗木色/草绿边框表达可点与选中，而不是阴影。
- **Do** 庄状态用 Harvest Gold 且保持稀缺。
- **Do** 战场与录胡路径优先大热区、短路径（桌上优先）。

### Don't:
- **Don't** 使用过于幼齿的贴纸 / 表情包堆砌风。
- **Don't** 退回微信默认灰白表单、无个性后台感（灰底灰按钮灰边）。
- **Don't** 做成电竞暗黑麻将客户端（霓虹、重金属、竞技 HUD）。
- **Don't** 把 MVP 暗底 `#111` / `#1a1a1a` 当作成品主题。
- **Don't** 给按钮/卡片加宽模糊大阴影，或 16px+ 过度圆角胶囊阵。
- **Don't** 大面积铺 Harvest Gold 或把 Meadow Green 当背景漆满屏。
- **Don't** 用渐变字、侧边彩条、玻璃拟态作为「像素可爱」的替代品。
