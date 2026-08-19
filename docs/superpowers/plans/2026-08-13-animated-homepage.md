# Animated Mahjong Table Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static homepage stack with a short, one-time animated mahjong-table hero while keeping new-session creation, read-only room joining, and rankings available.

**Architecture:** The index page owns the visual composition and CSS keyframes. A small pure state helper makes the join-panel open/close behaviour testable; the existing page methods continue to own navigation and room lookup. The hero uses WXML primitives and WXSS only, so it works in the configured WeChat Mini Program runtime without an animation dependency or external asset.

**Tech Stack:** WeChat Mini Program (WXML/WXSS/TypeScript), Vitest.

## Global Constraints

- Keep `onCreateTap`, `onJoinTap`, and `onRankTap` routes and error handling intact.
- Animate only on first page render; no continuous decorative animation after the 0.8–1.2 second entrance.
- Preserve the daylight sky, wood frame, meadow green, and harvest-gold design tokens in `DESIGN.md`.
- Use CSS transforms and opacity for animation; do not delay navigation or require a generated image asset.

---

### Task 1: Test and add join-panel state helper

**Files:**
- Create: `miniprogram/pages/index/indexState.ts`
- Create: `tests/indexState.test.ts`

**Interfaces:**
- Produces: `toggleJoinPanel(open: boolean): boolean`, which returns the next visible state.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { toggleJoinPanel } from '../miniprogram/pages/index/indexState'

describe('index home state', () => {
  it('toggles the room-code panel visibility', () => {
    expect(toggleJoinPanel(false)).toBe(true)
    expect(toggleJoinPanel(true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/indexState.test.ts`
Expected: FAIL because `indexState` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
export function toggleJoinPanel(open: boolean): boolean {
  return !open
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/indexState.test.ts`
Expected: PASS with one test.

### Task 2: Build the animated table hero and expandable join action

**Files:**
- Modify: `miniprogram/pages/index/index.ts`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`

**Interfaces:**
- Consumes: `toggleJoinPanel(open: boolean): boolean`.
- Produces: `joinPanelOpen` page data and `onJoinPanelToggle()` handler for WXML.

- [ ] **Step 1: Add `joinPanelOpen: false` and toggle handler**

```ts
onJoinPanelToggle() {
  this.setData({ joinPanelOpen: toggleJoinPanel(this.data.joinPanelOpen) })
}
```

- [ ] **Step 2: Replace the static brand stack with a mahjong-table hero**

```xml
<view class="hero" aria-label="一张四人麻将桌">
  <view class="table">
    <view class="seat seat--north">北</view>
    <view class="seat seat--west">西</view>
    <view class="seat seat--east">东</view>
    <view class="seat seat--south">南</view>
    <view class="tile tile--one">一万</view>
    <view class="tile tile--two">发</view>
    <view class="tile tile--three">九筒</view>
  </view>
</view>
```

- [ ] **Step 3: Implement the 1-second entrance with transform and opacity keyframes**

```css
.table { animation: table-arrive 360ms ease-out both; }
.seat { animation: seat-arrive 360ms ease-out both; }
.tile { animation: tile-deal 320ms ease-out both; }
```

- [ ] **Step 4: Make the room-code form conditionally visible behind a secondary “加入房间” action**

```xml
<button bindtap="onJoinPanelToggle">加入房间</button>
<view wx:if="{{joinPanelOpen}}">…existing input and join button…</view>
```

- [ ] **Step 5: Run the complete test suite**

Run: `npm test`
Expected: PASS.

### Task 3: Verify the Mini Program source

**Files:**
- Verify: `miniprogram/pages/index/index.ts`
- Verify: `miniprogram/pages/index/index.wxml`
- Verify: `miniprogram/pages/index/index.wxss`

- [ ] **Step 1: Run TypeScript compilation if project configuration exposes it**

Run: `npx tsc --noEmit`
Expected: no new errors attributable to index-page changes.

- [ ] **Step 2: Review the diff**

Run: `git diff -- miniprogram/pages/index tests/indexState.test.ts docs/superpowers/plans/2026-08-13-animated-homepage.md`
Expected: only animation-homepage, join-panel state, and related test/plan changes.
