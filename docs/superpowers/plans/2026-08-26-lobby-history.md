# Lobby Recents and History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Homepage shows at most five cloud-roster 牌局; overflow opens `pages/history/history` with every room the current user has entered.

**Architecture:** `listMySessions` reads `sessions` where `memberOpenIds` contains the caller (`whoami` + client query in cloud, mock store filter in tests). `sliceHomeRecents` caps the lobby at 5 and sets `hasMore`. Local `lobby.recentCampaigns` and swipe-to-delete go away. No new cloud function.

**Tech Stack:** WeChat miniprogram (WXML / WXSS / Page), `wx.cloud.database()` list query, Vitest for `indexState` and mock `sessionApi`.

**Spec:** `docs/superpowers/specs/2026-08-26-lobby-history-design.md`

## Global Constraints

- User copy: 牌局 / 全部牌局 / 查看全部. Code may use `history` / `listMySessions` / `session`.
- `HOME_RECENT_LIMIT = 5`, `HOME_FETCH_LIMIT = 6`, `HISTORY_FETCH_LIMIT = 50`.
- `listMySessions` implementation `Math.min(limit, 50)`. Never client-query by `roomCode`. Never client-write `sessions`.
- No leave-room, no local hide, no session `updatedAt`, no list `watch`, no pagination UI.
- Ended row meta is exactly `已结束` (no relative time).
- `npm test` must stay green. Do not hit real `database.get` in CI.
- This repo may have unrelated dirty files. Each commit lists only that task's paths.

---

## File map

- Modify: `tests/indexState.test.ts` — slice / present; drop storage and swipe cases
- Modify: `miniprogram/pages/index/indexState.ts` — constants, `sliceHomeRecents`, drop cache/swipe
- Modify: `tests/sessionApi.mock.test.ts` — `listMySessions` / `toSessionSummary`
- Modify: `miniprogram/services/sessionApi.ts` — `SessionSummary`, `toSessionSummary`, `listMySessions`
- Modify: `docs/cloud-setup.md` — member list query + composite index
- Modify: `miniprogram/pages/index/index.ts` / `.wxml` / `.wxss` — cloud list, 查看全部, no swipe
- Create: `miniprogram/pages/history/history.{js? no}` `history.ts` / `.wxml` / `.wxss` / `.json`
- Modify: `miniprogram/app.json` — register history page

---

### Task 1: Lobby list helpers (tests first)

**Files:**
- Modify: `tests/indexState.test.ts`
- Modify: `miniprogram/pages/index/indexState.ts`

**Interfaces:**
- Consumes: `SessionStatus` from `miniprogram/services/sessionApi.ts` (already imported)
- Produces: `HOME_RECENT_LIMIT = 5`, `HOME_FETCH_LIMIT = 6`, `HISTORY_FETCH_LIMIT = 50`; `RecentCampaign` without `updatedAt`; `sliceHomeRecents(list: RecentCampaign[]): { recents: RecentCampaign[]; hasMore: boolean }`; `presentRecentCampaign(campaign: RecentCampaign)` (no `now`)

- [ ] **Step 1: Replace recents tests**

In `tests/indexState.test.ts`:

1. Update the import list: drop `RECENT_DELETE_WIDTH`, `clampRecentSwipe`, `formatEndedAgo`, `parseStoredCampaigns`, `removeRecentCampaign`, `snapRecentSwipe`, `upsertRecentCampaign`. Add `HOME_FETCH_LIMIT`, `HOME_RECENT_LIMIT`, `HISTORY_FETCH_LIMIT`, `sliceHomeRecents`.
2. Remove `updatedAt` from the `playing` and `ended` fixtures. Add `createdAt: 1_000` on `playing` and `createdAt: 500` on `ended`.
3. Replace the whole `describe('lobby recent campaigns', …)` `describe('recent swipe', …)` `describe('ended-ago copy', …)` `describe('stored campaigns', …)` blocks with:

```ts
describe('lobby recent campaigns', () => {
  it('uses wind nicknames as default seats', () => {
    expect(DEFAULT_SEAT_NICKNAMES).toEqual(['东', '南', '西', '北'])
  })

  it('caps fetch/display constants', () => {
    expect(HOME_RECENT_LIMIT).toBe(5)
    expect(HOME_FETCH_LIMIT).toBe(6)
    expect(HISTORY_FETCH_LIMIT).toBe(50)
  })

  it('slices six rows to five and flags hasMore', () => {
    const six = [0, 1, 2, 3, 4, 5].map((i) => ({
      ...playing,
      sessionId: `sess_${i}`,
      createdAt: 1000 - i,
    }))
    expect(sliceHomeRecents([])).toEqual({ recents: [], hasMore: false })
    expect(sliceHomeRecents(six.slice(0, 5))).toEqual({
      recents: six.slice(0, 5),
      hasMore: false,
    })
    expect(sliceHomeRecents(six)).toEqual({
      recents: six.slice(0, 5),
      hasMore: true,
    })
  })

  it('presents active and finished rows for the lobby list', () => {
    expect(presentRecentCampaign(playing)).toMatchObject({
      title: '房间 8K2P',
      meta: '底分 2',
      actionLabel: '再入局',
      active: true,
    })
    expect(presentRecentCampaign(ended)).toMatchObject({
      title: '房间 4A9B',
      meta: '已结束',
      actionLabel: '已结束',
      active: false,
    })
  })

  it('routes re-entry by session status', () => {
    expect(sessionRoute(playing)).toBe('/pages/battle/battle?sessionId=sess_1')
    expect(sessionRoute({ ...playing, status: 'open' })).toBe(
      '/pages/dealer-pick/dealer-pick?sessionId=sess_1',
    )
    expect(sessionRoute(ended)).toBe('/pages/session/session?sessionId=sess_2')
    expect(sessionRoute({ ...playing, status: 'settling' })).toBe(
      '/pages/battle/battle?sessionId=sess_1',
    )
  })

  it('routes a row tap to session detail', () => {
    expect(sessionDetailRoute(playing)).toBe(
      '/pages/session/session?sessionId=sess_1',
    )
    expect(sessionDetailRoute(ended)).toBe(
      '/pages/session/session?sessionId=sess_2',
    )
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run tests/indexState.test.ts`

Expected: FAIL (`sliceHomeRecents` is not exported / `updatedAt` still required / `presentRecentCampaign` still wants `now`).

- [ ] **Step 3: Implement helpers and delete dead API**

In `miniprogram/pages/index/indexState.ts`:

Replace storage/swipe/recent constants and types with:

```ts
export const HOME_RECENT_LIMIT = 5
export const HOME_FETCH_LIMIT = 6
export const HISTORY_FETCH_LIMIT = 50

export type RecentCampaign = {
  sessionId: string
  roomCode: string
  chipValueYuan: number
  status: SessionStatus
  createdAt: number
}
```

Delete `RECENT_STORAGE_KEY`, `MAX_RECENT`, `RECENT_DELETE_WIDTH`, `upsertRecentCampaign`, `removeRecentCampaign`, `clampRecentSwipe`, `snapRecentSwipe`, `formatEndedAgo`, `parseStoredCampaigns`, `isRecentCampaign`.

Add:

```ts
export function sliceHomeRecents(
  list: RecentCampaign[],
): { recents: RecentCampaign[]; hasMore: boolean } {
  return {
    recents: list.slice(0, HOME_RECENT_LIMIT),
    hasMore: list.length > HOME_RECENT_LIMIT,
  }
}
```

Change `presentRecentCampaign` to take only `campaign` (drop `now`). Ended `meta` is `'已结束'`.

Keep `CHIP_OPTIONS`, join-code helpers, `sessionRoute`, `sessionDetailRoute`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/indexState.test.ts`

Expected: PASS.

`index.ts` still imports deleted symbols; do not run the full suite until Task 4, or temporarily leave re-exports — **do not** leave stubs. If `npx vitest run` (full) fails on `index.ts` type-check, that is OK until Task 4 because `index.ts` is `// @ts-nocheck`. Vitest should still collect `indexState.test.ts` only in this step.

- [ ] **Step 5: Commit**

```bash
git add tests/indexState.test.ts miniprogram/pages/index/indexState.ts
git commit -m "refactor: slice lobby recents to five without local cache helpers"
```

---

### Task 2: Mock `listMySessions`

**Files:**
- Modify: `tests/sessionApi.mock.test.ts`
- Modify: `miniprogram/services/sessionApi.ts`

**Interfaces:**
- Consumes: mock store, `__setMockActor`, `enterSession`, `createSession`, `MOCK_SCORER_ID`
- Produces:

```ts
export const LIST_MY_SESSIONS_MAX = 50

export type SessionSummary = {
  sessionId: string
  roomCode: string
  chipValueYuan: number
  status: SessionStatus
  createdAt: number
}

export function toSessionSummary(
  raw: Record<string, unknown>,
): SessionSummary | null

export async function listMySessions(opts?: {
  limit?: number
}): Promise<SessionSummary[]>
```

`RecentCampaign` in `indexState` is the same shape as `SessionSummary` (do not import in this task; keep them duplicated types).

- [ ] **Step 1: Write failing tests**

Append to `tests/sessionApi.mock.test.ts`. Add imports: `__setMockActor`, `enterSession`, `listMySessions`, `toSessionSummary`, `LIST_MY_SESSIONS_MAX`. Add `vi` to the vitest import. After the existing tests:

```ts
describe('listMySessions', () => {
  it('maps a row and fills sessionId from _id', () => {
    expect(
      toSessionSummary({
        _id: 'sess_x',
        roomCode: '8K2P',
        chipValueYuan: 2,
        status: 'open',
        createdAt: 10,
      }),
    ).toEqual({
      sessionId: 'sess_x',
      roomCode: '8K2P',
      chipValueYuan: 2,
      status: 'open',
      createdAt: 10,
    })
    expect(toSessionSummary({ roomCode: '8K2P' })).toBeNull()
  })

  it('returns only rooms the actor joined, newest first, capped', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1000)
    const a = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    vi.setSystemTime(2000)
    const b = await createSession({
      chipValueYuan: 2,
      nicknames: ['东', '南', '西', '北'],
    })
    vi.useRealTimers()

    __setMockActor('user-b')
    await enterSession({ sessionId: a.sessionId })

    const asGuest = await listMySessions()
    expect(asGuest.map((s) => s.sessionId)).toEqual([a.sessionId])

    __setMockActor(MOCK_SCORER_ID)
    const asScorer = await listMySessions()
    expect(asScorer.map((s) => s.sessionId)).toEqual([b.sessionId, a.sessionId])
    expect(asScorer[0].chipValueYuan).toBe(2)

    const capped = await listMySessions({ limit: 1 })
    expect(capped).toHaveLength(1)
    expect(capped[0].sessionId).toBe(b.sessionId)
    expect(LIST_MY_SESSIONS_MAX).toBe(50)
  })
})
```

`beforeEach` already calls `__resetMockSessions()`, which resets the actor to `MOCK_SCORER_ID`.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/sessionApi.mock.test.ts`

Expected: FAIL (`listMySessions` / `toSessionSummary` not exported).

- [ ] **Step 3: Implement mock path (and shared mapper)**

In `miniprogram/services/sessionApi.ts`, next to `SessionDoc`, add `LIST_MY_SESSIONS_MAX`, `SessionSummary`, `toSessionSummary`, `listMySessions`.

```ts
export const LIST_MY_SESSIONS_MAX = 50

export type SessionSummary = {
  sessionId: string
  roomCode: string
  chipValueYuan: number
  status: SessionStatus
  createdAt: number
}

function isSessionStatus(value: unknown): value is SessionStatus {
  return (
    value === 'open' ||
    value === 'playing' ||
    value === 'settling' ||
    value === 'ended'
  )
}

export function toSessionSummary(
  raw: Record<string, unknown>,
): SessionSummary | null {
  const sessionId =
    typeof raw.sessionId === 'string' && raw.sessionId
      ? raw.sessionId
      : typeof raw._id === 'string'
        ? raw._id
        : ''
  if (
    !sessionId ||
    typeof raw.roomCode !== 'string' ||
    typeof raw.chipValueYuan !== 'number' ||
    typeof raw.createdAt !== 'number' ||
    !isSessionStatus(raw.status)
  ) {
    return null
  }
  return {
    sessionId,
    roomCode: raw.roomCode,
    chipValueYuan: raw.chipValueYuan,
    status: raw.status,
    createdAt: raw.createdAt,
  }
}

function clampListLimit(limit: number | undefined): number {
  const n = limit == null ? LIST_MY_SESSIONS_MAX : limit
  return Math.max(0, Math.min(n, LIST_MY_SESSIONS_MAX))
}

export async function listMySessions(opts?: {
  limit?: number
}): Promise<SessionSummary[]> {
  const limit = clampListLimit(opts?.limit)
  if (!USE_MOCK) {
    throw new Error('listMySessions cloud path is Task 3')
  }
  return [...mockStore.values()]
    .map((entry) => entry.doc)
    .filter((doc) => (doc.memberOpenIds || []).includes(mockActorOpenId))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((doc) => toSessionSummary(doc as unknown as Record<string, unknown>))
    .filter((row): row is SessionSummary => row !== null)
}
```

Place `listMySessions` **after** `mockStore` / `mockActorOpenId` exist (below `__resetMockSessions` is fine). Do **not** leave the Task-3 throw in the final cloud branch — Task 3 replaces that `if (!USE_MOCK)` body. For this task only, the throw is a temporary guard so Node tests never pretend to query wx. If you prefer, skip the throw and inline the cloud `if (!USE_MOCK)` from Task 3 now; then Task 3 is docs + comment only. **Preferred:** implement the full cloud branch in Task 3 so this task stays mock-green.

This task's `if (!USE_MOCK) throw` is acceptable because `USE_MOCK` is true in Vitest (`typeof wx === 'undefined'`).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run tests/sessionApi.mock.test.ts tests/indexState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/sessionApi.mock.test.ts miniprogram/services/sessionApi.ts
git commit -m "feat: list sessions the current mock actor has joined"
```

---

### Task 3: Cloud query and setup docs

**Files:**
- Modify: `miniprogram/services/sessionApi.ts`
- Modify: `docs/cloud-setup.md`

**Interfaces:**
- Consumes: `whoami()`, `toSessionSummary`, `clampListLimit` / `LIST_MY_SESSIONS_MAX` from Task 2
- Produces: cloud `listMySessions` using `wx.cloud.database()`; updated `cloud-setup.md`

- [ ] **Step 1: Replace the mock-only guard with the client query**

In `listMySessions`, replace `if (!USE_MOCK) { throw … }` with:

```ts
  if (!USE_MOCK) {
    const { openId } = await whoami()
    if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.database) {
      throw new Error('cloud database unavailable')
    }
    const res = await wx.cloud
      .database()
      .collection('sessions')
      .where({ memberOpenIds: openId })
      .field({
        sessionId: true,
        roomCode: true,
        chipValueYuan: true,
        status: true,
        createdAt: true,
      })
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()
    const rows = (res && res.data) || []
    return rows
      .map((raw: Record<string, unknown>) => toSessionSummary(raw))
      .filter((row: SessionSummary | null): row is SessionSummary => row !== null)
  }
```

Keep the mock `return [...mockStore.values()]…` in the `USE_MOCK` branch.

At the top of `sessionApi.ts`, change the header comment so it is no longer “all actions go through sessionWrite”. Add one sentence: `listMySessions` is a client read of `sessions` filtered by `memberOpenIds`; it does not go through `sessionWrite`. Room-code lookup still does.

- [ ] **Step 2: Update `docs/cloud-setup.md` §3 `sessions` bullet**

Replace the sentences:

```
   Old docs without the field cannot be watched; `getSession` poll still works.
   Do not allow client `where` listing. Room-code lookup stays on `sessionWrite`.
```

with:

```
   Old docs without the field cannot be watched; `getSession` poll still works.
   Client **may** list with `where({ memberOpenIds: <caller's openId> })` plus
   `.field` / `.orderBy('createdAt', 'desc')` (homepage and 全部牌局).
   Do **not** query by `roomCode` from the client; room-code lookup stays on
   `sessionWrite`.

   Create a composite index on `sessions`: `memberOpenIds` ascending,
   `createdAt` descending. Without it, `orderBy` fails and the lobby shows
   「加载失败」.
```

Do not change the security-rule JSON string.

- [ ] **Step 3: Re-run mock tests**

Run: `npx vitest run tests/sessionApi.mock.test.ts`

Expected: PASS (`USE_MOCK` still true in Node, cloud branch unexecuted).

- [ ] **Step 4: Commit**

```bash
git add miniprogram/services/sessionApi.ts docs/cloud-setup.md
git commit -m "feat: query member sessions from the cloud database"
```

---

### Task 4: Homepage list, 查看全部, drop swipe

**Files:**
- Modify: `miniprogram/pages/index/index.ts`
- Modify: `miniprogram/pages/index/index.wxml`
- Modify: `miniprogram/pages/index/index.wxss`

**Interfaces:**
- Consumes: `listMySessions`, `HOME_FETCH_LIMIT`, `sliceHomeRecents`, `presentRecentCampaign` (no `now`), `sessionRoute`, `sessionDetailRoute`
- Produces: lobby recents from cloud; `hasMore` → `/pages/history/history` (page itself is Task 5)

- [ ] **Step 1: Strip storage/swipe from `index.ts` and load recents from the API**

Imports: drop `RECENT_STORAGE_KEY`, `canSubmitJoin` keep, drop `clampRecentSwipe`, `parseStoredCampaigns`, `removeRecentCampaign`, `snapRecentSwipe`, `upsertRecentCampaign`. Add `HOME_FETCH_LIMIT`, `sliceHomeRecents`, `listMySessions`.

Delete `campaignFromDoc` if it only served local remember. Delete `_offsets`, `_swipe`, `_ignoreTap`, `lockingScroll` data, `onRecentDelete`, `onRecentTouchStart` / `Move` / `End`, `setSwipeOffset`, `remember`.

`data`: drop `lockingScroll`. Add `hasMore: false`, `recentsReady: false`. `recents` items no longer need `offsetX`. Keep `campaigns` as the displayed (sliced) summaries for `findCampaign`.

`onCreateTap` / `onJoinTap`: still `enterSession` + navigate. Remove `this.remember(...)`.

`onRecentTap` / `onReenterTap`: drop `_ignoreTap` and offset checks. Tap always navigates.

Replace `refreshRecents` / `paintRecents`:

```ts
  onSeeAllTap() {
    wx.navigateTo({ url: '/pages/history/history' })
  },

  async refreshRecents() {
    try {
      const list = await listMySessions({ limit: HOME_FETCH_LIMIT })
      this.paintRecents(list)
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      if (!this.data.recentsReady) {
        this.setData({ recentsReady: true, hasMore: false })
      }
    }
  },

  paintRecents(list: RecentCampaign[]) {
    const { recents, hasMore } = sliceHomeRecents(list)
    this.setData({
      campaigns: recents,
      recents: recents.map((item) => presentRecentCampaign(item)),
      hasMore,
      recentsReady: true,
    })
  },
```

`onShow` still calls `refreshProfile` and `refreshRecents`. Do not clear `recents` before the fetch.

- [ ] **Step 2: WXML**

`scroll-view`: `scroll-y` (drop `lockingScroll` binding).

Empty state: `wx:if="{{recentsReady && recents.length === 0}}"`. Copy stays 「开一局或输入房间码，牌局会出现在这里。」

Replace the swipe `wx:for` with a plain campaign row (no `swipe` / `swipe-under` / `transform` / touch handlers):

```xml
      <view
        wx:for="{{recents}}"
        wx:key="sessionId"
        class="campaign {{item.active ? '' : 'campaign--done'}}"
        data-id="{{item.sessionId}}"
        bindtap="onRecentTap"
      >
        <image
          class="campaign-mark"
          src="{{item.active ? '/assets/ico-table.svg' : '/assets/ico-scroll.svg'}}"
          mode="aspectFit"
        />
        <view class="campaign-copy">
          <text class="campaign-title">{{item.title}}</text>
          <text class="campaign-meta">{{item.meta}}</text>
        </view>
        <view
          wx:if="{{item.active}}"
          class="reenter"
          hover-class="reenter--pressed"
          data-id="{{item.sessionId}}"
          catchtap="onReenterTap"
        >再入局</view>
        <text wx:else class="finished">已结束</text>
      </view>

      <view
        wx:if="{{hasMore}}"
        class="see-all"
        hover-class="see-all--pressed"
        bindtap="onSeeAllTap"
      >查看全部</view>
```

- [ ] **Step 3: WXSS**

Delete `.swipe`, `.swipe-under`, `.swipe-delete`, `.swipe-delete--pressed`. `.campaign` no longer needs `position: relative; z-index: 1` for overlay; keep flex layout, gap, padding, border. Add `margin-bottom: 12rpx` on `.campaign` (that lived on `.swipe`).

```css
.campaign {
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  gap: 16rpx;
  margin-bottom: 12rpx;
  padding: 16rpx 12rpx;
  border: var(--stroke-thin) solid var(--ink);
  border-radius: var(--radius-tile);
  background: var(--panel);
}

.see-all {
  margin-top: 8rpx;
  padding: 16rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink);
}

.see-all--pressed {
  opacity: 0.55;
}
```

- [ ] **Step 4: Tests**

Run: `npx vitest run`

Expected: PASS. `index.ts` is not unit-tested; regressions are import/runtime.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index/index.ts miniprogram/pages/index/index.wxml miniprogram/pages/index/index.wxss
git commit -m "feat: show five cloud recents and a see-all affordance on the lobby"
```

---

### Task 5: 全部牌局 page

**Files:**
- Create: `miniprogram/pages/history/history.json`
- Create: `miniprogram/pages/history/history.ts`
- Create: `miniprogram/pages/history/history.wxml`
- Create: `miniprogram/pages/history/history.wxss`
- Modify: `miniprogram/app.json`

**Interfaces:**
- Consumes: `listMySessions({ limit: HISTORY_FETCH_LIMIT })`, `presentRecentCampaign`, `sessionRoute`, `sessionDetailRoute`
- Produces: native-title page 「全部牌局」

- [ ] **Step 1: Register the page**

In `miniprogram/app.json` `pages`, insert `"pages/history/history"` immediately after `"pages/index/index"`.

`history.json`:

```json
{
  "navigationBarTitleText": "全部牌局",
  "navigationBarBackgroundColor": "#fffefc",
  "navigationBarTextStyle": "black",
  "backgroundColor": "#fffefc"
}
```

- [ ] **Step 2: Page logic**

`history.ts`:

```ts
// @ts-nocheck
import { listMySessions } from '../../services/sessionApi'
import {
  HISTORY_FETCH_LIMIT,
  presentRecentCampaign,
  sessionDetailRoute,
  sessionRoute,
  type RecentCampaign,
} from '../index/indexState'

Page({
  data: {
    loading: true,
    recents: [] as ReturnType<typeof presentRecentCampaign>[],
    campaigns: [] as RecentCampaign[],
  },

  onShow() {
    this.reload()
  },

  findCampaign(sessionId: string): RecentCampaign | undefined {
    return this.data.campaigns.find(
      (item: RecentCampaign) => item.sessionId === sessionId,
    )
  },

  onRecentTap(e: WechatMiniprogram.TouchEvent) {
    const sessionId = String(e.currentTarget.dataset.id || '')
    const campaign = this.findCampaign(sessionId)
    if (!campaign) return
    wx.navigateTo({ url: sessionDetailRoute(campaign) })
  },

  onReenterTap(e: WechatMiniprogram.TouchEvent) {
    const sessionId = String(e.currentTarget.dataset.id || '')
    const campaign = this.findCampaign(sessionId)
    if (!campaign) return
    wx.navigateTo({ url: sessionRoute(campaign) })
  },

  async reload() {
    const hadRows = this.data.recents.length > 0
    if (!hadRows) this.setData({ loading: true })
    try {
      const list = await listMySessions({ limit: HISTORY_FETCH_LIMIT })
      this.setData({
        loading: false,
        campaigns: list,
        recents: list.map((item) => presentRecentCampaign(item)),
      })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '加载失败', icon: 'none' })
      if (!hadRows) this.setData({ loading: false })
    }
  },
})
```

- [ ] **Step 3: WXML + WXSS**

`history.wxml`:

```xml
<view class="page">
  <view wx:if="{{loading && recents.length === 0}}" class="hint">加载中…</view>

  <block wx:else>
    <view wx:if="{{recents.length === 0}}" class="empty-state">
      <image class="empty-state-img" src="/assets/empty.svg" mode="aspectFit" />
      <text>你参加过的牌局会出现在这里。</text>
    </view>

    <view
      wx:for="{{recents}}"
      wx:key="sessionId"
      class="campaign {{item.active ? '' : 'campaign--done'}}"
      data-id="{{item.sessionId}}"
      bindtap="onRecentTap"
    >
      <image
        class="campaign-mark"
        src="{{item.active ? '/assets/ico-table.svg' : '/assets/ico-scroll.svg'}}"
        mode="aspectFit"
      />
      <view class="campaign-copy">
        <text class="campaign-title">{{item.title}}</text>
        <text class="campaign-meta">{{item.meta}}</text>
      </view>
      <view
        wx:if="{{item.active}}"
        class="reenter"
        hover-class="reenter--pressed"
        data-id="{{item.sessionId}}"
        catchtap="onReenterTap"
      >再入局</view>
      <text wx:else class="finished">已结束</text>
    </view>
  </block>
</view>
```

`history.wxss` — page padding like rank; copy campaign / reenter / finished rules from the homepage after Task 4 (same class names). Include:

```css
.page {
  min-height: 100vh;
  padding: 28rpx 28rpx 80rpx;
  box-sizing: border-box;
  background: var(--paper);
  color: var(--ink);
}

.hint {
  margin-top: 120rpx;
  text-align: center;
  color: var(--muted);
  font-size: 30rpx;
}
```

Do not add 快速开局 / 加入牌局 / identity row. Hitting 50 rows is silent (no “还有更多”).

- [ ] **Step 4: Full test run**

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/app.json miniprogram/pages/history
git commit -m "feat: add the full 牌局 history page"
```

---

## Spec coverage

| Spec | Task |
|---|---|
| §3.1 homepage 5 / 查看全部 / no swipe / empty copy / row routes / ended meta | 1, 4 |
| §3.2 history page | 5 |
| §4.1 `listMySessions` mock + cloud + `_id` + field projection + limit cap | 2, 3 |
| §4.2 drop `lobby.recentCampaigns` / swipe helpers / `updatedAt` | 1, 4 |
| §4.3 cloud-setup index + allow member where, forbid roomCode where | 3 |
| §5 onShow only, keep list on error, no empty flash, 50 silent cap | 4, 5 |
| §6 tests listed | 1, 2 |
| §7 acceptance (device index + two simulators) | manual after Task 5; CI is `npx vitest run` |

## Placeholder scan

No TBD. Cloud `listMySessions` is fully specified in Task 3. History WXML is fully specified in Task 5.

## Type consistency

- `SessionSummary` / `RecentCampaign`: same five fields. `presentRecentCampaign(campaign)` no `now`.
- `listMySessions({ limit })` → `Promise<SessionSummary[]>`.
- `sliceHomeRecents` uses `HOME_RECENT_LIMIT`; homepage fetches `HOME_FETCH_LIMIT`; history fetches `HISTORY_FETCH_LIMIT`; API clamps with `LIST_MY_SESSIONS_MAX` (all 50 except home 5/6).
