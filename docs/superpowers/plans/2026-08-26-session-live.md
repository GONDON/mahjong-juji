# Session Live Follow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All devices follow one session document: shared phase routing, `watch` with poll fallback, and a cloud `advanceToNextCycle` so open/close/score stay in sync.

**Architecture:** Pure `sessionFollowDecision` owns where to be. `sessionLive` is the only subscriber (watch first, 2s `getSession` poll if watch fails). Pages render `onDoc` and `redirectTo` on navigate. Writes still go only through `sessionApi` / `sessionWrite`.

**Tech Stack:** WeChat miniprogram TypeScript, cloud function JS, Vitest. `npm test` stays on the in-memory mock.

**Spec:** `docs/superpowers/specs/2026-08-26-session-live-design.md`

## Global Constraints

- Player-facing copy uses 「牌局」, never 「夜局」. Identifiers stay `session` / `SessionDoc` / `endSession` / `pages/session`.
- Client never writes `sessions` and never `where`-lists the collection. Join is still `enterSession` then subscribe.
- `canMutateSeats` is `open` only. `startCycle` accepts `open` only. `advanceToNextCycle` is the only `settling → open` write.
- After `endSession`, everyone `redirectTo` session detail — never `reLaunch` the lobby.
- Vitest does not call real `wx.cloud.database().watch`. Inject fakes.
- Existing uncommitted `presencePoll` on dealer-pick/battle is replaced by `sessionLive`; do not leave page-level `startPresencePoll`.

---

## File map

- Create: `miniprogram/domain/sessionRoute.ts` — `tablePageFor`, `tablePathFor`, `sessionFollowDecision`
- Create: `tests/sessionRoute.test.ts`
- Create: `miniprogram/services/sessionLive.ts` — `toPublicSessionDoc`, `subscribeSession`
- Create: `tests/sessionLive.test.ts`
- Modify: `miniprogram/pages/index/indexState.ts` — `sessionRoute` delegates to `tablePathFor`
- Modify: `tests/indexState.test.ts` — `settling` → battle
- Modify: `miniprogram/domain/presence.ts` + `cloudfunctions/sessionWrite/presence.js` — `canMutateSeats`
- Modify: `tests/presence.test.ts`
- Modify: `miniprogram/services/sessionApi.ts` — `advanceToNextCycle`, `startCycle` gate, `memberOpenIds`
- Modify: `cloudfunctions/sessionWrite/index.js` — same writes + save backfill
- Modify: `tests/sessionApi.mock.test.ts`, `tests/acceptance.mvp.test.ts`
- Modify: `miniprogram/pages/dealer-pick/dealer-pick.ts`
- Modify: `miniprogram/pages/battle/battle.ts`, `battle.wxml`
- Modify: `miniprogram/pages/session/session.ts`
- Modify: `miniprogram/pages/index/index.ts` — join uses `tablePathFor`
- Modify: `docs/cloud-setup.md`

`miniprogram/services/presencePoll.ts` already exists (may be untracked). `sessionLive` calls it; pages must not.

---

### Task 1: Follow decision + lobby route

**Files:**
- Create: `miniprogram/domain/sessionRoute.ts`
- Create: `tests/sessionRoute.test.ts`
- Modify: `miniprogram/pages/index/indexState.ts`
- Modify: `tests/indexState.test.ts`

**Interfaces:**
- Consumes: `SessionStatus` from `miniprogram/services/sessionApi.ts` (`'open' | 'playing' | 'settling' | 'ended'`)
- Produces: `TablePage`, `FollowDecision`, `tablePageFor(status)`, `tablePathFor(status, sessionId)`, `sessionFollowDecision(page, status, sessionId)`

- [ ] **Step 1: Write failing follow tests**

Create `tests/sessionRoute.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  sessionFollowDecision,
  tablePageFor,
  tablePathFor,
} from '../miniprogram/domain/sessionRoute'

describe('tablePageFor', () => {
  it('maps status to the canonical table page', () => {
    expect(tablePageFor('open')).toBe('dealer-pick')
    expect(tablePageFor('playing')).toBe('battle')
    expect(tablePageFor('settling')).toBe('battle')
    expect(tablePageFor('ended')).toBe('session')
  })
})

describe('tablePathFor', () => {
  it('builds encoded miniprogram paths', () => {
    expect(tablePathFor('playing', 'sess 1')).toBe(
      '/pages/battle/battle?sessionId=sess%201',
    )
    expect(tablePathFor('ended', 'sess_2')).toBe(
      '/pages/session/session?sessionId=sess_2',
    )
    expect(tablePathFor('open', 'sess_1')).toBe(
      '/pages/dealer-pick/dealer-pick?sessionId=sess_1',
    )
  })
})

describe('sessionFollowDecision', () => {
  it('keeps session detail on every status', () => {
    for (const status of ['open', 'playing', 'settling', 'ended'] as const) {
      expect(sessionFollowDecision('session', status, 's1')).toEqual({
        action: 'stay',
      })
    }
  })

  it('stays when already on the canonical page', () => {
    expect(sessionFollowDecision('dealer-pick', 'open', 's1')).toEqual({
      action: 'stay',
    })
    expect(sessionFollowDecision('battle', 'playing', 's1')).toEqual({
      action: 'stay',
    })
    expect(sessionFollowDecision('battle', 'settling', 's1')).toEqual({
      action: 'stay',
    })
  })

  it('redirects table pages that are off the canonical page', () => {
    expect(sessionFollowDecision('dealer-pick', 'playing', 's1')).toEqual({
      action: 'redirect',
      url: '/pages/battle/battle?sessionId=s1',
    })
    expect(sessionFollowDecision('dealer-pick', 'settling', 's1')).toEqual({
      action: 'redirect',
      url: '/pages/battle/battle?sessionId=s1',
    })
    expect(sessionFollowDecision('dealer-pick', 'ended', 's1')).toEqual({
      action: 'redirect',
      url: '/pages/session/session?sessionId=s1',
    })
    expect(sessionFollowDecision('battle', 'open', 's1')).toEqual({
      action: 'redirect',
      url: '/pages/dealer-pick/dealer-pick?sessionId=s1',
    })
    expect(sessionFollowDecision('battle', 'ended', 's1')).toEqual({
      action: 'redirect',
      url: '/pages/session/session?sessionId=s1',
    })
  })
})
```

- [ ] **Step 2: Run the new test — it must fail**

Run: `npx vitest run tests/sessionRoute.test.ts`

Expected: FAIL — cannot find `../miniprogram/domain/sessionRoute`.

- [ ] **Step 3: Implement `sessionRoute.ts`**

Create `miniprogram/domain/sessionRoute.ts` with the exact functions from spec §3 (`tablePageFor`, `tablePathFor`, `sessionFollowDecision`). Import `SessionStatus` from `../services/sessionApi`.

- [ ] **Step 4: Re-run — pass**

Run: `npx vitest run tests/sessionRoute.test.ts`

Expected: PASS.

- [ ] **Step 5: Point lobby `sessionRoute` at `tablePathFor` and fail the settling case**

In `tests/indexState.test.ts`, inside `it('routes re-entry by session status')`, add:

```ts
expect(sessionRoute({ ...playing, status: 'settling' })).toBe(
  '/pages/battle/battle?sessionId=sess_1',
)
```

Run: `npx vitest run tests/indexState.test.ts`

Expected: FAIL — settling currently routes to dealer-pick.

- [ ] **Step 6: Delegate `sessionRoute`**

In `miniprogram/pages/index/indexState.ts`, import `tablePathFor` from `../../domain/sessionRoute` and replace `sessionRoute` with:

```ts
export function sessionRoute(campaign: RecentCampaign): string {
  return tablePathFor(campaign.status, campaign.sessionId)
}
```

Run: `npx vitest run tests/indexState.test.ts tests/sessionRoute.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add miniprogram/domain/sessionRoute.ts tests/sessionRoute.test.ts miniprogram/pages/index/indexState.ts tests/indexState.test.ts
git commit -m "$(cat <<'EOF'
feat: share one session follow table across lobby and table pages

Settling now routes to battle so joiners see the settlement sheet
instead of the dealer-pick lobby.
EOF
)"
```

---

### Task 2: Freeze seats while settling

**Files:**
- Modify: `miniprogram/domain/presence.ts`
- Modify: `cloudfunctions/sessionWrite/presence.js`
- Modify: `tests/presence.test.ts`

**Interfaces:**
- Consumes: existing `canMutateSeats(status: string): boolean`
- Produces: `canMutateSeats` true only for `'open'`

- [ ] **Step 1: Write failing seat-window tests**

Add to `tests/presence.test.ts` (import `canMutateSeats`):

```ts
describe('canMutateSeats', () => {
  it('allows claims only while the table is open', () => {
    expect(canMutateSeats('open')).toBe(true)
    expect(canMutateSeats('settling')).toBe(false)
    expect(canMutateSeats('playing')).toBe(false)
    expect(canMutateSeats('ended')).toBe(false)
  })
})
```

Run: `npx vitest run tests/presence.test.ts`

Expected: FAIL — `settling` is still true.

- [ ] **Step 2: Implement**

`miniprogram/domain/presence.ts`:

```ts
export function canMutateSeats(status: string): boolean {
  return status === 'open'
}
```

`cloudfunctions/sessionWrite/presence.js`:

```js
function canMutateSeats(status) {
  return status === 'open'
}
```

Run: `npx vitest run tests/presence.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add miniprogram/domain/presence.ts cloudfunctions/sessionWrite/presence.js tests/presence.test.ts
git commit -m "$(cat <<'EOF'
fix: freeze seat claims while a cycle is settling

Players look at money on battle; claiming waits until 再开一轮
returns the table to open.
EOF
)"
```

---

### Task 3: Mock `advanceToNextCycle`, startCycle gate, `memberOpenIds`

**Files:**
- Modify: `miniprogram/services/sessionApi.ts`
- Modify: `tests/sessionApi.mock.test.ts`
- Modify: `tests/acceptance.mvp.test.ts`

**Interfaces:**
- Consumes: existing mock store, `assertMockScorer`, `SessionStatus`
- Produces: `advanceToNextCycle(sessionId: string): Promise<void>`; `startCycle` throws unless `status === 'open'`; `SessionDoc.memberOpenIds: string[]`; `syncMemberOpenIds` on create/enter/member writes

- [ ] **Step 1: Write failing mock tests**

Add to `tests/sessionApi.mock.test.ts` imports: `advanceToNextCycle`, `endSession`, `__setMockOpenId`, `settleCycleManual`.

Append:

```ts
  it('sets memberOpenIds on create', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    const doc = await getSession(sessionId)
    expect(doc.memberOpenIds).toEqual([MOCK_SCORER_ID])
  })

  it('rejects startCycle until the table is open again', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    const idA = (await getSession(sessionId)).seats[0].playerId
    await startCycle(sessionId, idA)
    await settleCycleManual(sessionId)
    await expect(startCycle(sessionId, idA)).rejects.toThrow(/open/i)
    await advanceToNextCycle(sessionId)
    const after = await getSession(sessionId)
    expect(after.status).toBe('open')
    expect(after.cycles).toHaveLength(1)
    expect(after.seats).toHaveLength(4)
    await startCycle(sessionId, idA)
    expect((await getSession(sessionId)).status).toBe('playing')
  })

  it('gates advanceToNextCycle to the scorer and settling', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['A', 'B', 'C', 'D'],
    })
    await expect(advanceToNextCycle(sessionId)).rejects.toThrow(/settling/i)
    const idA = (await getSession(sessionId)).seats[0].playerId
    await startCycle(sessionId, idA)
    await expect(advanceToNextCycle(sessionId)).rejects.toThrow(/settling/i)
    await settleCycleManual(sessionId)
    __setMockOpenId('not-scorer')
    await expect(advanceToNextCycle(sessionId)).rejects.toThrow(/scorer/i)
    __setMockOpenId(null)
    await advanceToNextCycle(sessionId)
    expect((await getSession(sessionId)).status).toBe('open')
  })
```

`assertMockScorer` throws `'only the scorer can write this session'` when `mockOpenId` is set. The `/scorer/i` assertion matches that.

Run: `npx vitest run tests/sessionApi.mock.test.ts`

Expected: FAIL — `advanceToNextCycle` is not exported / `memberOpenIds` missing / `startCycle` still allowed in settling.

- [ ] **Step 2: Implement mock writes**

In `SessionDoc` add `memberOpenIds: string[]`.

Add helper next to mock store:

```ts
function syncMemberOpenIds(doc: SessionDoc): void {
  doc.memberOpenIds = (doc.members || []).map((m) => m.openId)
}
```

Call `syncMemberOpenIds(doc)` in `createSession`, `enterSession`, `upsertCharacter` (when `sessionId` is set), and `claimSeat` if it upserts a member.

In `createSession` after building `members`, call `syncMemberOpenIds(doc)` before `mockStore.set`.

Tighten mock `startCycle` after `assertMockScorer`:

```ts
  if (doc.status !== 'open') throw new Error('session not open')
  if (doc.currentCycle) throw new Error('cycle already in progress')
```

(Remove the old `if (doc.status === 'ended')` branch; `'ended'` is covered by `!== 'open'`.)

Add:

```ts
export async function advanceToNextCycle(sessionId: string): Promise<void> {
  if (!USE_MOCK) {
    await callSessionWrite('advanceToNextCycle', { sessionId })
    return
  }
  const entry = requireMock(sessionId)
  assertMockScorer(entry.doc)
  if (entry.doc.status !== 'settling' || entry.doc.currentCycle) {
    throw new Error('session not settling')
  }
  entry.doc.status = 'open'
}
```

- [ ] **Step 3: Fix acceptance next-round**

In `tests/acceptance.mvp.test.ts`, import `advanceToNextCycle`. Replace the block that does `startCycle` immediately after the first cycle settles with:

```ts
    doc = await getSession(sessionId)
    expect(doc.status).toBe('settling')
    expect(doc.cycles).toHaveLength(1)
    expect(doc.currentCycle).toBeUndefined()

    await expect(startCycle(sessionId, idC)).rejects.toThrow(/open/i)
    await advanceToNextCycle(sessionId)
    await startCycle(sessionId, idC)
```

Run: `npx vitest run tests/sessionApi.mock.test.ts tests/acceptance.mvp.test.ts tests/sessionPresence.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add miniprogram/services/sessionApi.ts tests/sessionApi.mock.test.ts tests/acceptance.mvp.test.ts
git commit -m "$(cat <<'EOF'
feat: require advanceToNextCycle before opening the next round

Scorer-only settling → open keeps every device on the same phase
instead of a local jump to dealer-pick.
EOF
)"
```

---

### Task 4: Cloud `sessionWrite` parity

**Files:**
- Modify: `cloudfunctions/sessionWrite/index.js`
- Modify: `docs/cloud-setup.md`

**Interfaces:**
- Consumes: Task 3 action name `advanceToNextCycle`, `memberOpenIds`
- Produces: same gates on the cloud function; `save` always backfills `memberOpenIds`; `createSession` / `enterSession` / `upsertCharacter` / `claimSeat` keep the array in sync

- [ ] **Step 1: Sync `memberOpenIds` on every save**

In `cloudfunctions/sessionWrite/index.js`, before `sessionsCol().doc(id).set` in `save`:

```js
function syncMemberOpenIds(doc) {
  doc.memberOpenIds = (doc.members || []).map((m) => m.openId)
}

async function save(id, doc) {
  const { _id, ...payload } = doc
  syncMemberOpenIds(payload)
  await sessionsCol().doc(id).set({ data: payload })
}
```

Also call `syncMemberOpenIds` on the `createSession` add payload (members exist before `_id` is known) and inside the `claimSeat` transaction before `set`.

- [ ] **Step 2: Gate `startCycle` and add `advanceToNextCycle`**

Replace the start of `startCycle` after `assertScorer`:

```js
  if (doc.status !== 'open') throw new Error('session not open')
  if (doc.currentCycle) throw new Error('cycle already in progress')
```

Add:

```js
async function advanceToNextCycle(event, openid) {
  const { sessionId } = event
  const { doc, id } = await loadById(sessionId)
  assertScorer(doc, openid)
  if (doc.status !== 'settling' || doc.currentCycle) {
    throw new Error('session not settling')
  }
  doc.status = 'open'
  await save(id, doc)
  return null
}
```

In `exports.main` switch, add `case 'advanceToNextCycle': return ok(await advanceToNextCycle(event, OPENID))` next to `endSession`. Update the file header comment action list to include `advanceToNextCycle`.

- [ ] **Step 3: Document watch rules**

In `docs/cloud-setup.md` §3, replace the sessions permission sentence with:

```
1. **`sessions`** — denormalized session docs. Cloud function writes with the
   server SDK. Client **must not write**. Custom security rules:

   {
     "read": "auth.openid != null && doc.memberOpenIds != null && auth.openid in doc.memberOpenIds",
     "write": false
   }

   `memberOpenIds` is a string array kept in sync with `members[].openId`.
   Old docs without the field cannot be watched; `getSession` poll still works.
   Do not allow client `where` listing. Room-code lookup stays on `sessionWrite`.
```

In §4, add `advanceToNextCycle` to the scorer-gated action list. Add a smoke line: after deploy, two simulators — A starts a cycle, B on dealer-pick should move to battle within a couple of seconds (watch or poll).

There is no cloud-function Vitest. Do not invent one.

- [ ] **Step 4: Commit**

```bash
git add cloudfunctions/sessionWrite/index.js docs/cloud-setup.md
git commit -m "$(cat <<'EOF'
feat: expose advanceToNextCycle and memberOpenIds on sessionWrite

Cloud writes match the mock phase gates so watchers can subscribe
to member-only session docs.
EOF
)"
```

---

### Task 5: `sessionLive` subscribe (watch then poll)

**Files:**
- Create: `miniprogram/services/sessionLive.ts`
- Create: `tests/sessionLive.test.ts`

**Interfaces:**
- Consumes: `sessionFollowDecision`, `tablePathFor` from Task 1; `startPresencePoll` / `PRESENCE_POLL_MS` from `presencePoll.ts`; `getSession` from `sessionApi`
- Produces:

```ts
export function toPublicSessionDoc(raw: Record<string, unknown>): SessionDoc

export type SessionWatcher = { close: () => void }
export type WatchFn = (
  sessionId: string,
  handlers: {
    onChange: (raw: Record<string, unknown>) => void
    onError: (err: unknown) => void
  },
) => SessionWatcher | null

export function subscribeSession(opts: {
  sessionId: string
  page: TablePage
  onDoc: (doc: SessionDoc) => void
  onNavigate: (url: string) => void
  onFirstError?: (err: unknown) => void
  getSession?: (sessionId: string) => Promise<SessionDoc>
  watch?: WatchFn
  startPoll?: typeof startPresencePoll
  setTimeoutFn?: typeof setTimeout
  clearTimeoutFn?: typeof clearTimeout
  firstPacketTimeoutMs?: number
  watchRetryMs?: number
}): { stop: () => void }
```

Constants: `FIRST_PACKET_TIMEOUT_MS = 2000`, `WATCH_RETRY_MS = 15000`.

Apply rule: `pub = toPublicSessionDoc(raw)`; `decision = sessionFollowDecision(page, pub.status, pub.sessionId)`; redirect → `onNavigate(url)` and do not `onDoc`; stay → `onDoc(pub)`.

- [ ] **Step 1: Write failing live tests**

Create `tests/sessionLive.test.ts` covering spec §9.4. Use fake timers. Do not import real `wx`.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startPresencePoll } from '../miniprogram/services/presencePoll'
import {
  FIRST_PACKET_TIMEOUT_MS,
  subscribeSession,
  toPublicSessionDoc,
} from '../miniprogram/services/sessionLive'
import type { SessionDoc } from '../miniprogram/services/sessionApi'

function doc(status: SessionDoc['status']): SessionDoc {
  return {
    sessionId: 's1',
    roomCode: 'ABCD',
    chipValueYuan: 1,
    scorerId: 'scorer',
    seats: [],
    members: [],
    memberOpenIds: ['scorer'],
    status,
    cycles: [],
    hands: [],
    huEvents: [],
    createdAt: 1,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('toPublicSessionDoc', () => {
  it('strips undoStack, dealerPickId, and _id', () => {
    const pub = toPublicSessionDoc({
      ...doc('playing'),
      undoStack: [{ x: 1 }],
      dealerPickId: 'p1',
      _id: 'raw',
    } as unknown as Record<string, unknown>)
    expect(pub.status).toBe('playing')
    expect('undoStack' in pub).toBe(false)
    expect('dealerPickId' in pub).toBe(false)
    expect('_id' in pub).toBe(false)
  })
})

describe('subscribeSession', () => {
  it('applies the first watch snapshot as onDoc when staying', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onDoc = vi.fn()
    const onNavigate = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'battle',
      onDoc,
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
      getSession: async () => doc('playing'),
    })
    send({ ...doc('playing'), undoStack: [] })
    expect(onDoc).toHaveBeenCalledTimes(1)
    expect(onNavigate).not.toHaveBeenCalled()
    live.stop()
  })

  it('navigates dealer-pick to battle on playing', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onDoc = vi.fn()
    const onNavigate = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc,
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
    })
    send(doc('playing') as unknown as Record<string, unknown>)
    expect(onNavigate).toHaveBeenCalledWith(
      '/pages/battle/battle?sessionId=s1',
    )
    expect(onDoc).not.toHaveBeenCalled()
    live.stop()
  })

  it('navigates battle to session on ended', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onNavigate = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'battle',
      onDoc: vi.fn(),
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
    })
    send(doc('ended') as unknown as Record<string, unknown>)
    expect(onNavigate).toHaveBeenCalledWith(
      '/pages/session/session?sessionId=s1',
    )
    live.stop()
  })

  it('does not navigate from session detail', () => {
    let send!: (raw: Record<string, unknown>) => void
    const onNavigate = vi.fn()
    const onDoc = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'session',
      onDoc,
      onNavigate,
      watch: (_id, handlers) => {
        send = handlers.onChange
        return { close: vi.fn() }
      },
    })
    send(doc('playing') as unknown as Record<string, unknown>)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onDoc).toHaveBeenCalled()
    live.stop()
  })

  it('falls back to poll on watch error and first-packet timeout', async () => {
    vi.useFakeTimers()
    const getSession = vi.fn(async () => doc('open'))
    const onDoc = vi.fn()
    let fail!: (err: unknown) => void
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc,
      onNavigate: vi.fn(),
      getSession,
      watch: (_id, handlers) => {
        fail = handlers.onError
        return { close: vi.fn() }
      },
      startPoll: startPresencePoll,
    })
    fail(new Error('watch down'))
    await vi.advanceTimersByTimeAsync(2000)
    expect(getSession).toHaveBeenCalled()
    expect(onDoc).toHaveBeenCalled()
    live.stop()
  })

  it('starts poll when the first watch packet never arrives', async () => {
    vi.useFakeTimers()
    const getSession = vi.fn(async () => doc('open'))
    const onDoc = vi.fn()
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc,
      onNavigate: vi.fn(),
      getSession,
      watch: () => ({ close: vi.fn() }),
      startPoll: startPresencePoll,
      firstPacketTimeoutMs: FIRST_PACKET_TIMEOUT_MS,
    })
    await vi.advanceTimersByTimeAsync(FIRST_PACKET_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(2000)
    expect(getSession).toHaveBeenCalled()
    live.stop()
  })

  it('stop() prevents further poll ticks', async () => {
    vi.useFakeTimers()
    const getSession = vi.fn(async () => doc('open'))
    const live = subscribeSession({
      sessionId: 's1',
      page: 'dealer-pick',
      onDoc: vi.fn(),
      onNavigate: vi.fn(),
      getSession,
      watch: () => null,
      startPoll: startPresencePoll,
    })
    live.stop()
    await vi.advanceTimersByTimeAsync(8000)
    expect(getSession).not.toHaveBeenCalled()
  })
})
```

If `watch: () => null` is defined to immediately poll, the last test must `stop()` before the first interval fires. Immediate `getSession` for mock/null-watch is allowed **after** subscribe returns; then `stop` cannot prevent a sync get already in flight. Spec: mock gives first packet via `getSession`. Adjust the null-watch path: schedule poll only (no sync get), and fire one `getSession` on the first poll tick. Then `stop()` before 2s means `getSession` is not called. The timeout test still needs a watch handle that never sends.

Run: `npx vitest run tests/sessionLive.test.ts`

Expected: FAIL — cannot find `sessionLive`.

- [ ] **Step 2: Implement `sessionLive.ts`**

Behavior:

1. `toPublicSessionDoc` destructures away `undoStack`, `dealerPickId`, `_id`.
2. `subscribeSession` tries `opts.watch ?? defaultWatch`. `defaultWatch` returns `null` when `wx.cloud.database` is missing or `watch` throws.
3. If watch handle is non-null: start `firstPacketTimeoutMs` (default 2000). On first `onChange`, clear timeout, `apply(raw)`. On `onError` or timeout with no packet: `close` watch, `startPolling()`.
4. If watch is null: `startPolling()` immediately (no sync get).
5. Poll uses `opts.startPoll ?? startPresencePoll` with `intervalMs: PRESENCE_POLL_MS`, `tick` → `getSession(sessionId)` then `apply`. Poll errors after a successful packet are swallowed. Poll error before any packet calls `onFirstError` once.
6. While polling, `setTimeout` every `watchRetryMs` (15000) to try `watch` again. Success: stop poll, use watch.
7. `apply`: `toPublicSessionDoc` then `sessionFollowDecision`. `sessionId` on the public doc must be `opts.sessionId` if missing.
8. `stop()`: clear first-packet timeout, watch-retry timeout, `watcher.close()`, `poll.stop()`.

`getSession` default import from `./sessionApi`. Default watch:

```ts
function defaultWatch(sessionId: string, handlers: Parameters<WatchFn>[1]): SessionWatcher | null {
  try {
    if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.database) return null
    const watcher = wx.cloud.database().collection('sessions').doc(sessionId).watch({
      onChange(snapshot: { docs?: Record<string, unknown>[]; docChanges?: { doc?: Record<string, unknown> }[] }) {
        const fromDocs = snapshot.docs && snapshot.docs[0]
        const changes = snapshot.docChanges || []
        const fromChange = changes.length ? changes[changes.length - 1].doc : undefined
        const raw = fromDocs || fromChange
        if (raw) handlers.onChange(raw)
      },
      onError(err: unknown) {
        handlers.onError(err)
      },
    })
    return { close: () => watcher.close() }
  } catch {
    return null
  }
}
```

- [ ] **Step 3: Run tests — pass**

Run: `npx vitest run tests/sessionLive.test.ts tests/presencePoll.test.ts`

Expected: PASS. If `presencePoll.test.ts` is still untracked, `git add` it with this task (it is the poll transport).

- [ ] **Step 4: Commit**

```bash
git add miniprogram/services/sessionLive.ts tests/sessionLive.test.ts miniprogram/services/presencePoll.ts tests/presencePoll.test.ts
git commit -m "$(cat <<'EOF'
feat: subscribe to a session with watch and poll fallback

Table pages get one live handle so phase and seat updates no longer
depend on each page inventing its own timer.
EOF
)"
```

If `presencePoll.ts` was already committed earlier, omit it from `git add`.

---

### Task 6: Wire dealer-pick, battle, session, index join

**Files:**
- Modify: `miniprogram/pages/dealer-pick/dealer-pick.ts`
- Modify: `miniprogram/pages/battle/battle.ts`
- Modify: `miniprogram/pages/battle/battle.wxml`
- Modify: `miniprogram/pages/session/session.ts`
- Modify: `miniprogram/pages/index/index.ts`

**Interfaces:**
- Consumes: `subscribeSession`, `sessionFollowDecision`, `tablePathFor`, `advanceToNextCycle`
- Produces: pages subscribe on `onShow`, `stop` on `onHide`/`onUnload`; no `startPresencePoll` in pages; settle sheet scorer-only actions; join uses `tablePathFor`

- [ ] **Step 1: Dealer-pick live follow**

Remove `startPresencePoll` import and `_poll`. Keep `_seq` if still used by mutations; live `onDoc` should bump `_seq` or ignore stale mutation applies — simplest: `_live.stop()` is enough; `onDoc` calls `applyDoc`.

```ts
import {
  sessionFollowDecision,
  type TablePage,
} from '../../domain/sessionRoute'
import { subscribeSession } from '../../services/sessionLive'
import { startCycle, /* existing */, type SessionDoc } from '../../services/sessionApi'

// in Page:
  _live: { stop: () => void } | null,
  _page: 'dealer-pick' as TablePage,

  startLive() {
    this.stopLive()
    const sessionId = this.data.sessionId
    if (!sessionId) return
    this._live = subscribeSession({
      sessionId,
      page: this._page,
      onDoc: (doc) => {
        this.applyDoc(doc, this.data.myOpenId)
      },
      onNavigate: (url) => {
        wx.redirectTo({ url })
      },
      onFirstError: () => {
        this.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      },
    })
  },
  stopLive() {
    this._live?.stop()
    this._live = null
  },
```

`onShow`: `refreshSession` once is optional — live first packet covers it. Keep one `whoami` in `onShow` to set `myOpenId` before/with first doc:

```ts
  async onShow() {
    if (!this.data.sessionId) return
    try {
      const me = await whoami()
      this.setData({ myOpenId: me.openId })
    } catch (err) {
      console.error(err)
    }
    this.startLive()
  },
  onHide() { this.stopLive() },
  onUnload() { this.stopLive() },
```

Delete `startPoll` / `stopPoll` / the silent `refreshSession` interval. Keep `refreshSession` only if something else needs it; otherwise delete and let live own loads.

`onConfirm` after `startCycle`:

```ts
      await startCycle(sessionId, selectedId)
      const next = sessionFollowDecision(this._page, 'playing', sessionId)
      if (next.action === 'redirect') {
        wx.redirectTo({ url: next.url })
      }
```

- [ ] **Step 2: Battle live follow + settle sheet**

Same subscribe pattern with `page: 'battle'`. Delete `_poll`.

`onNextCycle`:

```ts
  async onNextCycle() {
    if (!this.data.isScorer || this.data.busy) return
    this.setData({ busy: true })
    try {
      await advanceToNextCycle(this.data.sessionId)
      const next = sessionFollowDecision('battle', 'open', this.data.sessionId)
      if (next.action === 'redirect') wx.redirectTo({ url: next.url })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '开下一轮失败', icon: 'none' })
    } finally {
      this.setData({ busy: false })
    }
  },
```

`onEndSession` — require `isScorer`; after success:

```ts
      await endSession(this.data.sessionId)
      const next = sessionFollowDecision('battle', 'ended', this.data.sessionId)
      if (next.action === 'redirect') wx.redirectTo({ url: next.url })
```

Do not `reLaunch` index.

In `applyDoc`, keep `showSettle` from `status === 'settling'` and last cycle settlements.

`battle.wxml` settle sheet: wrap the two buttons in `wx:if="{{isScorer}}"`. Add for everyone else:

```xml
      <text wx:else class="hint">等待记分员再开一轮或结束牌局</text>
```

- [ ] **Step 3: Session detail live follow**

Subscribe `page: 'session'`. `onDoc` replaces `reload`'s `setData`. After `endSession`, do not `reLaunch`; live stay + `onDoc` from a manual `getSession` or wait for watch. Immediately:

```ts
      await endSession(this.data.sessionId)
      await this.reload()
```

`reload` can remain for the first paint if live has not fired; prefer `startLive` in `onShow` and drop duplicate `reload` except after local `endSession`.

- [ ] **Step 4: Index join**

Replace the `if (doc.status === 'playing' …)` chain in `onJoinTap` with:

```ts
      this.remember(campaignFromDoc(doc))
      wx.navigateTo({
        url: tablePathFor(doc.status, doc.sessionId),
      })
```

Import `tablePathFor` from `../../domain/sessionRoute`. `onReenterTap` already uses `sessionRoute(campaign)` which now delegates to `tablePathFor`.

- [ ] **Step 5: Full test run**

Run: `npx vitest run`

Expected: PASS, including acceptance (Task 3 already updated next-round).

- [ ] **Step 6: Commit**

```bash
git add miniprogram/pages/dealer-pick/dealer-pick.ts miniprogram/pages/battle/battle.ts miniprogram/pages/battle/battle.wxml miniprogram/pages/session/session.ts miniprogram/pages/index/index.ts
git commit -m "$(cat <<'EOF'
feat: follow live session status on table pages

Scorer and others share subscribeSession, so start, next round, and
end all land on the same screen.
EOF
)"
```

---

## Self-review (spec coverage)

| Spec | Task |
|---|---|
| §2 phase table / `canMutateSeats` / `startCycle` only `open` | 1, 2, 3, 4 |
| §3 follow functions / lobby `settling` → battle | 1, 6 |
| §4 `sessionLive` + pages subscribe | 5, 6 |
| §5 watch / poll / first error / busy does not pause | 5, 6 |
| §6 `memberOpenIds` + cloud-setup rules | 3, 4 |
| §7 page behavior / scorer-only settle actions / no `reLaunch` | 6 |
| §8 `advanceToNextCycle` | 3, 4, 6 |
| §9 tests | 1–5 |
| §10 cloud-setup | 4 |

No placeholders. Names match: `advanceToNextCycle`, `toPublicSessionDoc`, `subscribeSession`, `tablePathFor`, `sessionFollowDecision`.
