# Lobby Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the lobby custom top bar and fake tab dock with WeChat native navigation plus a content identity row (avatar → 角色卡, 「年度榜」→ rank).

**Architecture:** This is a shell change on `pages/index` only. Domain helpers `battleTabTarget` / `historyTabTarget` / `TabTarget` go away; re-entry stays on `sessionRoute` and the recent list. Other pages keep their native bars and the battle action bar.

**Tech Stack:** WeChat miniprogram (WXML / WXSS / Page), Vitest for `indexState`.

**Spec:** `docs/superpowers/specs/2026-08-25-lobby-chrome-design.md`

**Commit note:** The lobby files currently also contain uncommitted 纸墨 UI. Do not commit this plan's code changes unless the user explicitly asks; committing would mix chrome with that redesign.

---

## File map

- Modify: `tests/indexState.test.ts` — drop tab-target cases
- Modify: `miniprogram/pages/index/indexState.ts` — delete `TabTarget`, `battleTabTarget`, `historyTabTarget`
- Modify: `miniprogram/pages/index/index.json` — drop `navigationStyle: custom`
- Modify: `miniprogram/pages/index/index.ts` — drop metrics, tab handlers, `follow`
- Modify: `miniprogram/pages/index/index.wxml` — identity row; no topbar; no dock
- Modify: `miniprogram/pages/index/index.wxss` — identity styles; drop topbar/dock
- Modify: `DESIGN.md` — Navigation
- Modify: `PRODUCT.md` — 一职一面

---

### Task 1: Delete lobby tab helpers (tests first)

**Files:**
- Modify: `tests/indexState.test.ts`
- Modify: `miniprogram/pages/index/indexState.ts`

- [x] **Step 1: Remove tab-target tests and unused imports**

In `tests/indexState.test.ts`, delete `battleTabTarget` and `historyTabTarget` from the import list. Delete the entire `describe('lobby tab targets', …)` block (the two cases that toast or navigate from tabs). Keep `sessionRoute` tests; they remain the lobby re-entry contract.

- [x] **Step 2: Run tests — remaining suite still passes**

Run: `npx vitest run tests/indexState.test.ts`

Expected: PASS. Failures here mean an import or describe block was left half-deleted.

- [x] **Step 3: Delete tab helpers from `indexState.ts`**

Remove:

```ts
export type TabTarget =
  | { type: 'nav'; url: string }
  | { type: 'toast'; title: string }
```

and `battleTabTarget` / `historyTabTarget` (the functions that pick a live session or toast 「先开一局或加入房间」 / 「还没有流水」). Keep `sessionRoute`.

- [x] **Step 4: Re-run tests**

Run: `npx vitest run tests/indexState.test.ts`

Expected: PASS. `sessionRoute` cases still green.

---

### Task 2: Restore native nav and strip tab wiring

**Files:**
- Modify: `miniprogram/pages/index/index.json`
- Modify: `miniprogram/pages/index/index.ts`

- [x] **Step 1: Native window config**

Replace `miniprogram/pages/index/index.json` with:

```json
{
  "navigationBarTextStyle": "black",
  "navigationBarBackgroundColor": "#fffefc",
  "backgroundColor": "#fffefc",
  "backgroundTextStyle": "dark"
}
```

Do not set `navigationStyle: custom`. Do not set `navigationBarTitleText` (inherit 「麻将局记」 from `miniprogram/app.json`).

- [x] **Step 2: Strip metrics and tab handlers from `index.ts`**

Delete imports: `battleTabTarget`, `historyTabTarget`, `TabTarget`.

Delete `windowMetrics` and its `onLoad` `setData`. Delete `data.statusBarHeight` and `data.safeBottom`. If `onLoad` is empty after that, delete `onLoad`.

Delete `onBattleTab`, `onHistoryTab`, and `follow`. Keep `onRankTap` and `onProfileTap`.

---

### Task 3: Identity row UI

**Files:**
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`

- [x] **Step 1: WXML shell**

Root is `<view class="page">` with **no** `padding-top` style.

Delete the `.topbar` block (brand-mark, brand text, profile).

Delete the `.dock` block (大厅 / 战场 / 流水 / 榜).

Inside `.body`, **before** the 快速开局 section, insert:

```xml
    <view class="identity">
      <view class="profile face-frame" hover-class="profile--pressed" bindtap="onProfileTap">
        <image
          class="profile-face"
          src="{{hasProfile ? profileSrc : '/assets/avatars/avatar_00.svg'}}"
          mode="aspectFit"
        />
      </view>
      <text class="identity-rank" hover-class="identity-rank--pressed" bindtap="onRankTap">年度榜</text>
    </view>
```

Keep 快速开局 / 加入牌局 / 最近牌局 unchanged. `onRankTap` / `onProfileTap` stay as `wx.navigateTo` to `/pages/rank/rank` and `/pages/profile/profile`.

- [x] **Step 2: WXSS — identity, drop chrome**

Delete `.topbar`, `.brand-mark`, `.brand`, `.dock`, `.tab`, `.tab--on`, `.tab--pressed`, `.tab-ico`.

Keep `.profile` / `.profile-face` / `.profile--pressed`. Add:

```css
.identity {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28rpx;
}

.identity-rank {
  padding: 8rpx 4rpx;
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink);
}

.identity-rank--pressed {
  opacity: 0.55;
}
```

No bottom border on `.identity`. `.body` padding stays; the page can keep `height: 100vh` + flex column + scroll-view.

---

### Task 4: Product / design copy

**Files:**
- Modify: `PRODUCT.md`
- Modify: `DESIGN.md`

- [x] **Step 1: PRODUCT.md 一职一面**

Replace principle 4 with:

```markdown
4. **一职一面** 首页开局/进房、战场录胡、详情流水、年度榜，各做一件事，不堆仪表盘。角色卡与年度榜从大厅身份条进，战场与流水从最近牌局进。
```

- [x] **Step 2: DESIGN.md Navigation**

Replace the Navigation bullets with:

```markdown
### Navigation
- 微信原生导航栏：背景 Paper，标题 Ink，返回箭头深色。禁止暗色导航栏配白字。首页标题继承全局「麻将局记」，不用 `navigationStyle: custom`。
- 页内无侧栏、无假 tabBar。大厅身份条是内容入口（方框头像 → 角色卡，「年度榜」字 → 榜），不是第二条工具栏，不要底边框。
- 战场 / 流水从最近牌局进入；战场底栏仍是操作（流局 / 结清 / 撤销），不是导航 tab。
```

---

### Task 5: Verify

- [x] **Step 1: Run lobby tests**

Run: `npx vitest run tests/indexState.test.ts`

Expected: PASS, 0 failures. No remaining `battleTabTarget` / `historyTabTarget` references in `miniprogram/` or `tests/` (grep).

- [x] **Step 2: Manual check in WeChat tools (if available)**

- Home shows native title 「麻将局记」 and capsule; no custom top bar; no four tabs.
- Avatar → 角色卡, back → home.
- 「年度榜」 → rank, back → home.
- 再入局 still follows `sessionRoute`.
- Empty recents: existing empty copy, no tab toast.
