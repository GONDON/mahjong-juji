# 角色卡与房间认人 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每人一张绑在微信 `openId` 上的局记角色卡（牌桌名 + Noto 简笔画头像）；进房进名册；选庄页占座；结算行带上 `openId`；用户文案用「牌局」不用「夜局」。

**Architecture:** 角色校验与占座是纯函数（`miniprogram/domain/character.ts`、`presence.ts`），Vitest 覆盖。`sessionApi` mock 与云函数 `sessionWrite` 实现同一套 action。页面只读名册/座位并调用 API。人头像是打进包的 SVG（与现有 `miniprogram/assets/swords.svg` 相同用法）。

**Tech Stack:** 微信小程序 TypeScript、微信云开发、Vitest。`npm test` 保持 `USE_MOCK=true`。

**Spec:** `docs/superpowers/specs/2026-08-25-character-and-room-presence-design.md`

## Global Constraints

- 用户可见文案用「牌局」（牌局详情、结束牌局、创建牌局）。禁止「夜局」。代码标识符保持 `session` / `SessionDoc` / `endSession` / `pages/session`。
- 人 = 微信 `openId`；角色卡 = `nickname` + `avatarId`，可改，不产生新人。
- 角色卡已设：`nickname.trim().length >= 1` 且 `avatarId` 为 `avatar_01`–`avatar_12`。`avatar_00` 不算已设。
- 占座只发生在选庄页（`open` / `settling`）。战场点座位只录胡。
- 占座不改 `playerId`。未占座结算行 `openId: null`。
- 不请求外部头像 API。不做人在线心跳、出房、年度报告新页。
- 历史文档 `docs/superpowers/specs/2026-08-06-mahjong-score-miniprogram-design.md` 与 `docs/superpowers/plans/2026-08-06-mahjong-score-miniprogram.md` 当作档案，不必改「夜局」字样。

---

## File Structure

```
miniprogram/
  domain/
    character.ts          # 角色卡校验、头像 id、路径
    presence.ts           # 名册 upsert、占座/退座/请离/代填名
  services/
    sessionApi.ts         # + members/seats 字段与新 action
  assets/avatars/         # avatar_00 … avatar_12.svg + README
  pages/profile/          # 角色卡页
  pages/index/            # 人物入口、进房 enterSession
  pages/dealer-pick/      # 名册 + 占座（与选庄手势拆开）
  pages/battle/           # 座位头像 + 在场带
  pages/session/          # 文案「牌局」
cloudfunctions/sessionWrite/
  character.js            # 与 TS 校验同步的纯 JS
  presence.js
  index.js                # 新 action
tests/
  character.test.ts
  presence.test.ts
  sessionPresence.test.ts
scripts/
  write-avatars.mjs       # 生成 13 张简笔画 SVG
```

---

### Task 1: 用户文案「夜局」→「牌局」

**Files:**
- Modify: `miniprogram/pages/session/session.json`, `session.wxml`, `session.ts`
- Modify: `miniprogram/pages/battle/battle.wxml`, `battle.ts`
- Modify: `miniprogram/pages/create/create.wxml`
- Modify: `miniprogram/pages/rank/rank.wxml`
- Modify: `DESIGN.md`（Ghost 按钮那一行）
- Modify: `.impeccable/design.json`（ghost 描述）
- Modify: `docs/superpowers/specs/2026-08-25-character-and-room-presence-design.md`（把「当夜流水」「名册整晚保留」改成「当次牌局流水」「名册在牌局结束前保留」）
- Test: 用 ripgrep 确认 `miniprogram/` 内无「夜局」

**Interfaces:**
- Consumes: 无
- Produces: 用户可见中文不再出现「夜局」

- [ ] **Step 1: 替换小程序文案**

精确替换：

| 文件 | 旧 | 新 |
|---|---|---|
| `session.json` `navigationBarTitleText` | 夜局详情 | 牌局详情 |
| `session.wxml` 标题与结束按钮 | 夜局详情 / 结束夜局 | 牌局详情 / 结束牌局 |
| `session.ts` modal `title` | 结束夜局 | 结束牌局 |
| `battle.wxml` | 夜局详情 / 结束夜局 | 牌局详情 / 结束牌局 |
| `battle.ts` toast | 夜局详情稍后开放 | 牌局详情稍后开放 |
| `create.wxml` | 创建夜局 | 创建牌局 |
| `rank.wxml` | 按已结束夜局的人民币结算额统计 | 按已结束牌局的人民币结算额统计 |
| `DESIGN.md` | 结束夜局 | 结束牌局 |
| `.impeccable/design.json` | 结束夜局 | 结束牌局 |

Spec 里「它们只存在于当夜流水」→「它们只存在于当次牌局流水」；「名册整晚保留」→「名册在牌局结束前保留」。

- [ ] **Step 2: 确认 miniprogram 内已无「夜局」**

Run:

```bash
rg '夜局' miniprogram DESIGN.md .impeccable/design.json docs/superpowers/specs/2026-08-25-character-and-room-presence-design.md
```

Expected: 无匹配。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/session/session.json miniprogram/pages/session/session.wxml miniprogram/pages/session/session.ts miniprogram/pages/battle/battle.wxml miniprogram/pages/battle/battle.ts miniprogram/pages/create/create.wxml miniprogram/pages/rank/rank.wxml DESIGN.md .impeccable/design.json docs/superpowers/specs/2026-08-25-character-and-room-presence-design.md
git commit -m "$(cat <<'EOF'
copy: say 牌局 instead of 夜局 in player-facing UI

The afternoon table brand should not call a scoring session a night game.
EOF
)"
```

---

### Task 2: 角色卡与占座纯函数

**Files:**
- Create: `miniprogram/domain/character.ts`
- Create: `miniprogram/domain/presence.ts`
- Test: `tests/character.test.ts`, `tests/presence.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:

```ts
// character.ts
export const CHARACTER_STORAGE_KEY = 'character.card'
export const PLACEHOLDER_AVATAR_ID = 'avatar_00'
export const UNSET_DISPLAY_NICKNAME = '牌友'
export const NICKNAME_MAX_LEN = 12
export const SELECTABLE_AVATAR_IDS = [
  'avatar_01','avatar_02','avatar_03','avatar_04','avatar_05','avatar_06',
  'avatar_07','avatar_08','avatar_09','avatar_10','avatar_11','avatar_12',
] as const
export type SelectableAvatarId = (typeof SELECTABLE_AVATAR_IDS)[number]
export type AvatarId = typeof PLACEHOLDER_AVATAR_ID | SelectableAvatarId
export type CharacterCard = {
  openId: string
  nickname: string
  avatarId: SelectableAvatarId
  updatedAt: number
}
export function avatarSrc(avatarId: string): string
export function isSelectableAvatar(id: string): id is SelectableAvatarId
export function trimNickname(raw: string): string
export function isCharacterComplete(
  card: { nickname?: string; avatarId?: string } | null | undefined,
): boolean
export function validateCharacter(
  nickname: string,
  avatarId: string,
):
  | { ok: true; nickname: string; avatarId: SelectableAvatarId }
  | { ok: false; message: string }
export function memberSnapshot(
  card: CharacterCard | null | undefined,
): { nickname: string; avatarId: AvatarId }

// presence.ts
export const WIND_NICKNAMES = ['东', '南', '西', '北'] as const
export type SessionMember = {
  openId: string
  nickname: string
  avatarId: string
  joinedAt: number
}
export type ClaimableSeat = {
  playerId: string
  nickname: string
  claimedOpenId?: string
  avatarId?: string
}
export function upsertMember(
  members: SessionMember[],
  patch: { openId: string; nickname: string; avatarId: string },
  now: number,
): SessionMember[]
export function claimSeat(
  seats: ClaimableSeat[],
  playerId: string,
  actor: { openId: string; nickname: string; avatarId: string },
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'occupied' }
export function unclaimSeat(
  seats: ClaimableSeat[],
  playerId: string,
  openId: string,
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'not_owner' }
export function scorerUnclaimSeat(
  seats: ClaimableSeat[],
  playerId: string,
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'empty' }
export function renameUnclaimedSeat(
  seats: ClaimableSeat[],
  playerId: string,
  nickname: string,
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'claimed' | 'empty_name' }
export function canMutateSeats(status: string): boolean
```

- [ ] **Step 1: 写失败测试**

创建 `tests/character.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  isCharacterComplete,
  memberSnapshot,
  PLACEHOLDER_AVATAR_ID,
  UNSET_DISPLAY_NICKNAME,
  validateCharacter,
} from '../miniprogram/domain/character'

describe('character', () => {
  it('rejects empty name and placeholder avatar', () => {
    expect(validateCharacter('  ', 'avatar_01').ok).toBe(false)
    expect(validateCharacter('阿强', PLACEHOLDER_AVATAR_ID).ok).toBe(false)
    expect(validateCharacter('阿强', 'avatar_99').ok).toBe(false)
  })

  it('accepts trimmed name and selectable avatar', () => {
    const r = validateCharacter('  阿强  ', 'avatar_03')
    expect(r).toEqual({ ok: true, nickname: '阿强', avatarId: 'avatar_03' })
    expect(isCharacterComplete({ nickname: '阿强', avatarId: 'avatar_03' })).toBe(true)
    expect(isCharacterComplete(null)).toBe(false)
  })

  it('member snapshot uses 牌友 when unset', () => {
    expect(memberSnapshot(null)).toEqual({
      nickname: UNSET_DISPLAY_NICKNAME,
      avatarId: PLACEHOLDER_AVATAR_ID,
    })
  })
})
```

创建 `tests/presence.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  claimSeat,
  renameUnclaimedSeat,
  scorerUnclaimSeat,
  unclaimSeat,
  upsertMember,
  WIND_NICKNAMES,
} from '../miniprogram/domain/presence'

const seats = () =>
  WIND_NICKNAMES.map((nickname, i) => ({
    playerId: `nid_${nickname}`,
    nickname,
  }))

const actorA = { openId: 'oa', nickname: '阿强', avatarId: 'avatar_01' }
const actorB = { openId: 'ob', nickname: '阿珍', avatarId: 'avatar_02' }

describe('presence', () => {
  it('upserts member without resetting joinedAt', () => {
    const once = upsertMember([], { openId: 'oa', nickname: '牌友', avatarId: 'avatar_00' }, 1)
    const twice = upsertMember(once, { openId: 'oa', nickname: '阿强', avatarId: 'avatar_01' }, 99)
    expect(twice).toHaveLength(1)
    expect(twice[0].joinedAt).toBe(1)
    expect(twice[0].nickname).toBe('阿强')
  })

  it('claims empty seat and moves on second claim', () => {
    const first = claimSeat(seats(), 'nid_东', actorA)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.seats[0].claimedOpenId).toBe('oa')
    expect(first.seats[0].nickname).toBe('阿强')
    const moved = claimSeat(first.seats, 'nid_南', actorA)
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.seats[0].claimedOpenId).toBeUndefined()
    expect(moved.seats[0].nickname).toBe('东')
    expect(moved.seats[1].claimedOpenId).toBe('oa')
  })

  it('rejects occupying another player seat', () => {
    const first = claimSeat(seats(), 'nid_东', actorA)
    if (!first.ok) throw new Error('setup')
    expect(claimSeat(first.seats, 'nid_东', actorB)).toEqual({
      ok: false,
      error: 'occupied',
    })
  })

  it('unclaim restores wind name; scorer can kick; cannot rename claimed', () => {
    const first = claimSeat(seats(), 'nid_东', actorA)
    if (!first.ok) throw new Error('setup')
    const kicked = scorerUnclaimSeat(first.seats, 'nid_东')
    expect(kicked.ok).toBe(true)
    if (!kicked.ok) return
    expect(kicked.seats[0].nickname).toBe('东')
    const named = renameUnclaimedSeat(kicked.seats, 'nid_东', '老王')
    expect(named.ok).toBe(true)
    const again = claimSeat(first.seats, 'nid_东', actorA)
    if (!again.ok) return
    expect(renameUnclaimedSeat(again.seats, 'nid_东', '老王').ok).toBe(false)
    expect(unclaimSeat(again.seats, 'nid_东', 'oa').ok).toBe(true)
    expect(unclaimSeat(again.seats, 'nid_东', 'ob').ok).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `npx vitest run tests/character.test.ts tests/presence.test.ts`

Expected: FAIL，模块找不到。

- [ ] **Step 3: 实现 `character.ts`**

```ts
export const CHARACTER_STORAGE_KEY = 'character.card'
export const PLACEHOLDER_AVATAR_ID = 'avatar_00'
export const UNSET_DISPLAY_NICKNAME = '牌友'
export const NICKNAME_MAX_LEN = 12
export const SELECTABLE_AVATAR_IDS = [
  'avatar_01',
  'avatar_02',
  'avatar_03',
  'avatar_04',
  'avatar_05',
  'avatar_06',
  'avatar_07',
  'avatar_08',
  'avatar_09',
  'avatar_10',
  'avatar_11',
  'avatar_12',
] as const

export type SelectableAvatarId = (typeof SELECTABLE_AVATAR_IDS)[number]
export type AvatarId = typeof PLACEHOLDER_AVATAR_ID | SelectableAvatarId

export type CharacterCard = {
  openId: string
  nickname: string
  avatarId: SelectableAvatarId
  updatedAt: number
}

export function avatarSrc(avatarId: string): string {
  return `/assets/avatars/${avatarId}.svg`
}

export function isSelectableAvatar(id: string): id is SelectableAvatarId {
  return (SELECTABLE_AVATAR_IDS as readonly string[]).includes(id)
}

export function trimNickname(raw: string): string {
  return String(raw || '').trim().replace(/\s+/g, ' ').slice(0, NICKNAME_MAX_LEN)
}

export function isCharacterComplete(
  card: { nickname?: string; avatarId?: string } | null | undefined,
): boolean {
  if (!card) return false
  return trimNickname(card.nickname || '').length >= 1 && isSelectableAvatar(card.avatarId || '')
}

export function validateCharacter(
  nickname: string,
  avatarId: string,
):
  | { ok: true; nickname: string; avatarId: SelectableAvatarId }
  | { ok: false; message: string } {
  const name = trimNickname(nickname)
  if (!name) return { ok: false, message: '请填写牌桌名' }
  if (!isSelectableAvatar(avatarId)) return { ok: false, message: '请选一个头像' }
  return { ok: true, nickname: name, avatarId }
}

export function memberSnapshot(
  card: CharacterCard | null | undefined,
): { nickname: string; avatarId: AvatarId } {
  if (!isCharacterComplete(card) || !card) {
    return { nickname: UNSET_DISPLAY_NICKNAME, avatarId: PLACEHOLDER_AVATAR_ID }
  }
  return { nickname: trimNickname(card.nickname), avatarId: card.avatarId }
}
```

- [ ] **Step 4: 实现 `presence.ts`**

```ts
import { trimNickname } from './character'

export const WIND_NICKNAMES = ['东', '南', '西', '北'] as const

export type SessionMember = {
  openId: string
  nickname: string
  avatarId: string
  joinedAt: number
}

export type ClaimableSeat = {
  playerId: string
  nickname: string
  claimedOpenId?: string
  avatarId?: string
}

export function canMutateSeats(status: string): boolean {
  return status === 'open' || status === 'settling'
}

export function upsertMember(
  members: SessionMember[],
  patch: { openId: string; nickname: string; avatarId: string },
  now: number,
): SessionMember[] {
  const i = members.findIndex((m) => m.openId === patch.openId)
  if (i < 0) {
    return [...members, { ...patch, joinedAt: now }]
  }
  const next = members.slice()
  next[i] = {
    ...next[i],
    nickname: patch.nickname,
    avatarId: patch.avatarId,
  }
  return next
}

function clearClaim(seat: ClaimableSeat, index: number): ClaimableSeat {
  return {
    playerId: seat.playerId,
    nickname: WIND_NICKNAMES[index] || seat.nickname,
  }
}

function applyClaim(
  seat: ClaimableSeat,
  actor: { openId: string; nickname: string; avatarId: string },
): ClaimableSeat {
  return {
    ...seat,
    claimedOpenId: actor.openId,
    avatarId: actor.avatarId,
    nickname: actor.nickname,
  }
}

export function claimSeat(
  seats: ClaimableSeat[],
  playerId: string,
  actor: { openId: string; nickname: string; avatarId: string },
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'occupied' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  const target = seats[idx]
  if (target.claimedOpenId && target.claimedOpenId !== actor.openId) {
    return { ok: false, error: 'occupied' }
  }
  const next = seats.map((s, i) =>
    s.claimedOpenId === actor.openId ? clearClaim(s, i) : { ...s },
  )
  next[idx] = applyClaim(next[idx], actor)
  return { ok: true, seats: next }
}

export function unclaimSeat(
  seats: ClaimableSeat[],
  playerId: string,
  openId: string,
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'not_owner' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (seats[idx].claimedOpenId !== openId) return { ok: false, error: 'not_owner' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = clearClaim(next[idx], idx)
  return { ok: true, seats: next }
}

export function scorerUnclaimSeat(
  seats: ClaimableSeat[],
  playerId: string,
): { ok: true; seats: ClaimableSeat[] } | { ok: false; error: 'not_found' | 'empty' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (!seats[idx].claimedOpenId) return { ok: false, error: 'empty' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = clearClaim(next[idx], idx)
  return { ok: true, seats: next }
}

export function renameUnclaimedSeat(
  seats: ClaimableSeat[],
  playerId: string,
  nickname: string,
):
  | { ok: true; seats: ClaimableSeat[] }
  | { ok: false; error: 'not_found' | 'claimed' | 'empty_name' } {
  const idx = seats.findIndex((s) => s.playerId === playerId)
  if (idx < 0) return { ok: false, error: 'not_found' }
  if (seats[idx].claimedOpenId) return { ok: false, error: 'claimed' }
  const name = trimNickname(nickname)
  if (!name) return { ok: false, error: 'empty_name' }
  const next = seats.map((s) => ({ ...s }))
  next[idx] = { ...next[idx], nickname: name }
  return { ok: true, seats: next }
}
```

- [ ] **Step 5: 跑测试，确认通过**

Run: `npx vitest run tests/character.test.ts tests/presence.test.ts`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add miniprogram/domain/character.ts miniprogram/domain/presence.ts tests/character.test.ts tests/presence.test.ts
git commit -m "$(cat <<'EOF'
feat: add character and seat-claim domain helpers

Keep openId identity and table faces as testable pure functions before wiring storage.
EOF
)"
```

---

### Task 3: Noto 风格简笔画头像资源

**Files:**
- Create: `scripts/write-avatars.mjs`
- Create: `miniprogram/assets/avatars/README.md`
- Create: `miniprogram/assets/avatars/avatar_00.svg` … `avatar_12.svg`（由脚本写出）

**Interfaces:**
- Consumes: `avatarSrc('avatar_03')` → `/assets/avatars/avatar_03.svg`
- Produces: 13 张深木色线条 SVG，正方形 viewBox，透明底

头像是**原创线稿**，气质对齐 Felix Wong Noto/Notion 简笔画（稀疏黑线五官 + 发型），许可按本仓库资源处理；README 注明灵感来源与 CC0 的 Noto Avatar，避免运行时拉 notion-avatar.app。

- [ ] **Step 1: 写生成脚本 `scripts/write-avatars.mjs`**

脚本必须写出 13 个文件。共用：`viewBox="0 0 128 128"`，描边 `#26190c`，`fill="none"`，`stroke-linecap="round"`。把下面脚本原样落地（12 张 `inner` 已互不相同）：

```js
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '../miniprogram/assets/avatars')
mkdirSync(dir, { recursive: true })

function svg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none" stroke="#26190c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>\n`
}

const head = '<ellipse cx="64" cy="70" rx="28" ry="32"/>'

const faces = [
  { id: 'avatar_00', inner: '<rect x="18" y="18" width="92" height="92" stroke-width="5"/>' },
  { id: 'avatar_01', inner: `${head}<path d="M40 52c8-22 40-22 48 0"/><circle cx="54" cy="68" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="68" r="2" fill="#26190c" stroke="none"/><path d="M56 86c6 8 12 8 16 0"/>` },
  { id: 'avatar_02', inner: `${head}<path d="M38 70c0-28 16-40 26-40v40"/><path d="M64 30c10 0 26 12 26 40"/><circle cx="54" cy="70" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="70" r="2" fill="#26190c" stroke="none"/><path d="M58 88h12"/>` },
  { id: 'avatar_03', inner: `${head}<path d="M42 48c4-18 40-18 44 0"/><path d="M86 56c10 18 8 36-2 44"/><circle cx="54" cy="68" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="68" r="2" fill="#26190c" stroke="none"/><path d="M60 84c4 6 8 6 10 0"/>` },
  { id: 'avatar_04', inner: `${head}<path d="M40 60c6-24 20-32 24-32 8 10 6 20 0 24"/><path d="M88 60c-6-24-20-32-24-32"/><circle cx="54" cy="70" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="70" r="2" fill="#26190c" stroke="none"/><path d="M54 86c8 10 16 10 20 0"/>` },
  { id: 'avatar_05', inner: `${head}<circle cx="64" cy="44" r="6"/><path d="M46 68h12"/><path d="M70 68h12"/><circle cx="54" cy="72" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="72" r="2" fill="#26190c" stroke="none"/><path d="M58 88c4 4 8 4 12 0"/>` },
  { id: 'avatar_06', inner: `${head}<path d="M36 58c16-28 40-20 52-6"/><path d="M44 50h40"/><circle cx="54" cy="70" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="70" r="2" fill="#26190c" stroke="none"/><path d="M62 86v6"/>` },
  { id: 'avatar_07', inner: `${head}<path d="M48 40c-4-12 8-16 16-8"/><path d="M80 40c4-12-8-16-16-8"/><circle cx="54" cy="68" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="68" r="2" fill="#26190c" stroke="none"/><path d="M56 84c6 10 12 10 16 0"/>` },
  { id: 'avatar_08', inner: `${head}<path d="M36 58h56"/><path d="M40 58c0-16 12-28 24-28s24 12 24 28"/><circle cx="54" cy="72" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="72" r="2" fill="#26190c" stroke="none"/><path d="M58 88h12"/>` },
  { id: 'avatar_09', inner: `${head}<path d="M86 48c12 8 14 28 4 40"/><path d="M40 52c10-20 38-20 48 0"/><circle cx="54" cy="68" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="68" r="2" fill="#26190c" stroke="none"/><path d="M55 86c6 6 14 6 18 0"/>` },
  { id: 'avatar_10', inner: `${head}<path d="M38 50c6-8 14-6 18 2M52 44c6-10 16-8 20 4M72 46c6-8 14-4 16 8"/><circle cx="54" cy="70" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="70" r="2" fill="#26190c" stroke="none"/><path d="M60 84c4 8 10 8 12 0"/>` },
  { id: 'avatar_11', inner: `${head}<path d="M44 40c-2 20 0 30 0 40"/><path d="M84 40c2 20 0 30 0 40"/><path d="M44 40h40"/><circle cx="54" cy="68" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="68" r="2" fill="#26190c" stroke="none"/><path d="M58 88c4 2 8 2 12 0"/>` },
  { id: 'avatar_12', inner: `${head}<path d="M40 56c4-16 12-22 24-22s20 6 24 22"/><circle cx="54" cy="70" r="2" fill="#26190c" stroke="none"/><circle cx="74" cy="70" r="2" fill="#26190c" stroke="none"/><path d="M52 86c8 8 16 8 24 0"/>` },
]

for (const face of faces) {
  writeFileSync(join(dir, `${face.id}.svg`), svg(face.inner))
}
```

- [ ] **Step 2: 跑脚本并确认文件**

Run:

```bash
node scripts/write-avatars.mjs
ls miniprogram/assets/avatars | wc -l
```

Expected: 含 README 的话 ≥14；至少 13 个 `.svg`。

- [ ] **Step 3: 写 `miniprogram/assets/avatars/README.md`**

```md
# Avatars

局记角色卡简笔画。描边 `#26190c`，正方形。

Inspired by Felix Wong Noto Avatar (CC0). These files are original line drawings generated for 麻将局记; they are not copies of the Noto component pack.

`avatar_00` = empty frame (not selectable). `avatar_01`–`avatar_12` = faces.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/write-avatars.mjs miniprogram/assets/avatars
git commit -m "$(cat <<'EOF'
feat: add line-drawing avatar set for character cards

Ship twelve distinct ink faces plus an empty frame so seats can show who sat down.
EOF
)"
```

---

### Task 4: mock `sessionApi` 名册 / 角色 / 占座

**Files:**
- Modify: `miniprogram/services/sessionApi.ts`
- Modify: `miniprogram/domain/leaderboard.ts`（`SessionPlayerYuan` 增加可选 `openId`）
- Test: `tests/sessionPresence.test.ts`
- Modify: `tests/sessionApi.mock.test.ts` 仅在需要时断言 `members` 存在且默认不占座（不要破坏现有胡分测试）

**Interfaces:**
- Consumes: Task 2 函数
- Produces:

```ts
export type SessionSeat = {
  playerId: PlayerId
  nickname: string
  chips: number
  hasHu: boolean
  claimedOpenId?: string
  avatarId?: string
}
export type SessionMember = { openId: string; nickname: string; avatarId: string; joinedAt: number }
// SessionDoc.members: SessionMember[]
// SettledCycle.settlements 每行额外: openId: string | null; nickname: string

export function __setMockActor(openId: string): void
export function __getMockActor(): string
export async function whoami(): Promise<{ openId: string }>
export async function getCharacter(): Promise<CharacterCard | null>
export async function upsertCharacter(input: {
  nickname: string
  avatarId: string
  sessionId?: string
}): Promise<CharacterCard>
export async function enterSession(input: {
  sessionId?: string
  roomCode?: string
}): Promise<SessionDoc>
export async function claimSeat(sessionId: string, playerId: string): Promise<SessionDoc>
export async function unclaimSeat(sessionId: string, playerId: string): Promise<SessionDoc>
export async function scorerUnclaimSeat(sessionId: string, playerId: string): Promise<SessionDoc>
export async function scorerRenameSeat(
  sessionId: string,
  playerId: string,
  nickname: string,
): Promise<SessionDoc>
```

Mock 规则：

- `let mockActorOpenId = MOCK_SCORER_ID`；`__setMockOpenId` 若仍存在，写路径 scorer 校验继续用它；**占座/进房/角色卡用 `mockActorOpenId`**。`__resetMockSessions` 同时 `mockUsers.clear()` 并把 actor 设回 `MOCK_SCORER_ID`。
- `createSession`：`members: [ { openId: MOCK_SCORER_ID, ...memberSnapshot(mockUsers.get(MOCK_SCORER_ID)), joinedAt } ]`，座位仍不占。
- `settleCurrent`：在 `settleCycle(...)` 之后 map：

```ts
const settlements = settleCycle(doc.seats, doc.chipValueYuan).map((row, i) => ({
  ...row,
  openId: doc.seats[i]?.claimedOpenId ?? null,
  nickname: doc.seats[i]?.nickname ?? row.playerId,
}))
```

- `startCycle` 重置 `chips`/`hasHu` 时 **保留** `claimedOpenId` / `avatarId` / 展示 `nickname`。
- `claimSeat`：若 `!canMutateSeats(doc.status)` throw `session not open for seats`；若 `!isCharacterComplete(card)` throw `character incomplete`；若调用者不在 members 先按 snapshot upsert 再占；`occupied` → throw `seat occupied`。
- `upsertCharacter`：校验失败 throw 中文 message；写入 `mockUsers`；若带 `sessionId` 则更新该局 members 快照及 `claimedOpenId === actor` 的座位脸。
- 云路径：`USE_MOCK===false` 时这些函数都走 `callSessionWrite(action, data)`。
- `listYearSettlements` 每行带 `openId: s.openId ?? null`（现有 rank 可忽略）。

- [ ] **Step 1: 写 `tests/sessionPresence.test.ts`（先失败）**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  __resetMockSessions,
  __setMockActor,
  claimSeat,
  createSession,
  enterSession,
  getSession,
  MOCK_SCORER_ID,
  scorerRenameSeat,
  scorerUnclaimSeat,
  settleCycleManual,
  startCycle,
  unclaimSeat,
  upsertCharacter,
} from '../miniprogram/services/sessionApi'

describe('session presence', () => {
  beforeEach(() => {
    __resetMockSessions()
  })

  it('adds creator to members without claiming a seat', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    const doc = await getSession(sessionId)
    expect(doc.members).toHaveLength(1)
    expect(doc.members[0].openId).toBe(MOCK_SCORER_ID)
    expect(doc.seats.every((s) => !s.claimedOpenId)).toBe(true)
  })

  it('lets a second player join, claim, move, and leave a seat', async () => {
    const { sessionId, roomCode } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    __setMockActor('user-b')
    await upsertCharacter({ nickname: '阿珍', avatarId: 'avatar_02' })
    const joined = await enterSession({ roomCode })
    expect(joined.members.map((m) => m.openId).sort()).toEqual(['user-b', MOCK_SCORER_ID].sort())

    const east = joined.seats[0].playerId
    const south = joined.seats[1].playerId
    const claimed = await claimSeat(sessionId, east)
    expect(claimed.seats[0].claimedOpenId).toBe('user-b')
    expect(claimed.seats[0].nickname).toBe('阿珍')

    const moved = await claimSeat(sessionId, south)
    expect(moved.seats[0].claimedOpenId).toBeUndefined()
    expect(moved.seats[1].claimedOpenId).toBe('user-b')

    const left = await unclaimSeat(sessionId, south)
    expect(left.seats[1].nickname).toBe('南')
  })

  it('rejects claiming occupied seats and incomplete characters', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    __setMockActor('user-b')
    await enterSession({ sessionId })
    await expect(claimSeat(sessionId, (await getSession(sessionId)).seats[0].playerId)).rejects.toThrow(
      /character incomplete/,
    )
    await upsertCharacter({ nickname: '阿珍', avatarId: 'avatar_02' })
    await claimSeat(sessionId, (await getSession(sessionId)).seats[0].playerId)
    __setMockActor('user-c')
    await upsertCharacter({ nickname: '阿强', avatarId: 'avatar_01' })
    await enterSession({ sessionId })
    await expect(
      claimSeat(sessionId, (await getSession(sessionId)).seats[0].playerId),
    ).rejects.toThrow(/occupied/)
  })

  it('scorer can kick and rename unclaimed seats; settlements carry openId', async () => {
    const { sessionId } = await createSession({
      chipValueYuan: 1,
      nicknames: ['东', '南', '西', '北'],
    })
    __setMockActor('user-b')
    await upsertCharacter({ nickname: '阿珍', avatarId: 'avatar_02' })
    await enterSession({ sessionId })
    const east = (await getSession(sessionId)).seats[0].playerId
    await claimSeat(sessionId, east)

    __setMockActor(MOCK_SCORER_ID)
    const kicked = await scorerUnclaimSeat(sessionId, east)
    expect(kicked.seats[0].claimedOpenId).toBeUndefined()
    const renamed = await scorerRenameSeat(sessionId, east, '老王')
    expect(renamed.seats[0].nickname).toBe('老王')

    __setMockActor('user-b')
    await claimSeat(sessionId, east)
    __setMockActor(MOCK_SCORER_ID)
    const ids = (await getSession(sessionId)).seats.map((s) => s.playerId)
    await startCycle(sessionId, ids[0])
    const rows = await settleCycleManual(sessionId)
    expect(rows[0].openId).toBe('user-b')
    expect(rows[1].openId).toBeNull()
    expect(rows[0].nickname).toBe('阿珍')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run tests/sessionPresence.test.ts`

Expected: FAIL（没有 `members` / 新函数）。

- [ ] **Step 3: 改 `sessionApi.ts` 使测试通过**

按本 task 的 Interfaces 与 Mock 规则改。注意：

- 现有 `createSession` / `appendHu` 测试必须继续绿。
- `enterSession` 幂等。
- `claimSeat` 内部调用 `claimSeatInDomain`（import 时别和导出函数同名冲突：domain 用 `import { claimSeat as applyClaimSeat } from '../domain/presence'`）。

- [ ] **Step 4: 跑相关测试**

Run:

```bash
npx vitest run tests/sessionPresence.test.ts tests/sessionApi.mock.test.ts tests/acceptance.mvp.test.ts tests/character.test.ts tests/presence.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add miniprogram/services/sessionApi.ts miniprogram/domain/leaderboard.ts tests/sessionPresence.test.ts tests/sessionApi.mock.test.ts
git commit -m "$(cat <<'EOF'
feat: persist room members and claimed seats in mock sessions

Joiners get an openId-backed roster so later year stats can key off a person.
EOF
)"
```

---

### Task 5: 云函数 `sessionWrite` 对齐 mock

**Files:**
- Create: `cloudfunctions/sessionWrite/character.js`（把 `SELECTABLE_AVATAR_IDS`、`trimNickname`、`validateCharacter`、`memberSnapshot`、`PLACEHOLDER_AVATAR_ID`、`UNSET_DISPLAY_NICKNAME` 用纯 JS 复刻，与 TS 保持同一字符串）
- Create: `cloudfunctions/sessionWrite/presence.js`（复刻 Task 2 的 presence 函数）
- Modify: `cloudfunctions/sessionWrite/index.js`
- Modify: `docs/cloud-setup.md`（增加集合 `users`）

**Interfaces:**
- Consumes: 与 Task 4 相同的 action 名与语义
- Produces: `sessionWrite` switch 增加 `whoami` `getCharacter` `upsertCharacter` `enterSession` `claimSeat` `unclaimSeat` `scorerUnclaimSeat` `scorerRenameSeat`

实现要点：

- `whoami` → `{ openId: OPENID }`（无 OPENID 则 fail `missing openid`）。
- `getCharacter`：`users` 集合 `doc(OPENID).get()`，无数据返回 `null`。
- `upsertCharacter`：校验后 `users.doc(OPENID).set({ data: { openId: OPENID, nickname, avatarId, updatedAt: Date.now() } })`；若 `event.sessionId` 存在则更新该 session 的 member 快照与已占座位脸。
- `enterSession`：用 `sessionId` 或 `roomCode` 找文档；`members = upsertMember(...)`；`save`。
- 占座类：先 `canMutateSeats`；`claimSeat` 若 `claimedOpenId` 已是他人则 `throw new Error('seat occupied')`（在调用 presence 之前也可依赖 presence 的 occupied）。
- `scorerUnclaimSeat` / `scorerRenameSeat` 走 `assertScorer`。
- `createSession` 写入 `members: [{ openId, ...memberSnapshot(userDoc), joinedAt }]`。
- `settleCurrent` 与 mock 一样给 settlements 补 `openId`/`nickname`。
- `startCycle` 保留占座字段。
- `listYearSettlements` 输出 `openId: s.openId ?? null`。
- `docs/cloud-setup.md` 第 3 步：除 `sessions` 外再建 `users`（`_id` = openId）。

本 task 不在 CI 打真云。实现后跑：

```bash
npx vitest run
```

Expected: 仍全部 PASS（云代码不被 vitest import 也没关系；不要弄坏 mock）。

- [ ] **Step 1: 加入 JS 复刻与 action，更新 cloud-setup**
- [ ] **Step 2: `npx vitest run` 必须绿**
- [ ] **Step 3: Commit**

```bash
git add cloudfunctions/sessionWrite docs/cloud-setup.md
git commit -m "$(cat <<'EOF'
feat: expose character and seat-claim actions on sessionWrite

Persist users by openId in cloud so a claimed seat survives reinstall.
EOF
)"
```

---

### Task 6: 角色卡页 + 首页入口 + 进房登记

**Files:**
- Create: `miniprogram/pages/profile/profile.ts`, `profile.wxml`, `profile.wxss`, `profile.json`
- Modify: `miniprogram/app.json`（`pages` 数组在 `pages/index/index` 后插入 `pages/profile/profile`）
- Modify: `miniprogram/pages/index/index.ts`, `index.wxml`, `index.wxss`

**Interfaces:**
- Consumes: `getCharacter`, `upsertCharacter`, `whoami`, `enterSession`, `SELECTABLE_AVATAR_IDS`, `avatarSrc`, `isCharacterComplete`, `CHARACTER_STORAGE_KEY`
- Produces: 可保存角色卡；首页头像；进房走 `enterSession`

本机缓存：

```ts
function readLocalCard(): CharacterCard | null {
  try {
    const raw = wx.getStorageSync(CHARACTER_STORAGE_KEY)
    return raw && raw.avatarId ? raw : null
  } catch {
    return null
  }
}
function writeLocalCard(card: CharacterCard) {
  wx.setStorageSync(CHARACTER_STORAGE_KEY, card)
}
```

`profile.json`:

```json
{
  "navigationBarTitleText": "角色卡",
  "navigationBarBackgroundColor": "#fff8f4",
  "navigationBarTextStyle": "black",
  "backgroundColor": "#fff8f4"
}
```

`profile.wxml` 要点：

- 12 宫格 `wx:for="{{avatarOptions}}"`，选中 class `avatar--on`（Sunlight 底 + 6rpx 深木框）。
- `<image class="avatar-img" src="{{item.src}}" mode="aspectFit" />`
- `<input maxlength="12" ... />` 牌桌名。
- 说明：「这张卡绑在当前微信。改名字或头像，还是你这个人。」
- Moss 按钮「保存」。

`profile.ts`：`onShow` 先 `readLocalCard` 再 `getCharacter` 覆盖。`onSave` 调 `validateCharacter`（失败 toast 中文）→ `upsertCharacter({ nickname, avatarId, sessionId })`（`sessionId` 来自页面 query，可空）→ `writeLocalCard` → toast 成功 → 若有 `sessionId` 则 `navigateBack`，否则留在页上。云失败 toast「保存失败，稍后重试」，**不要**另造 openId；若本地已有编辑值，仍 `writeLocalCard` 仅当云成功之后（失败不把未确认的非法卡写成 complete；合法编辑可先写本地再请求，失败保留本地并 toast，与 spec 一致）。

首页：

- `onShow` 读本地 + `getCharacter`，`profileSrc` / `hasProfile`。
- `index.wxml` 人物入口：`wx:if="{{hasProfile}}"` 显示 `<image class="profile-face" src="{{profileSrc}}" />`，否则保持空木框小人。
- `onProfileTap` → `wx.navigateTo({ url: '/pages/profile/profile' })`，删掉「角色卡即将开放」。
- `onCreateTap`：`createSession` 成功后 `enterSession({ sessionId })`（幂等），再进选庄。
- `onJoinTap`：`getSessionByRoomCode` 成功后 `enterSession({ sessionId: doc.sessionId })`，失败 toast「加入失败」且不跳转。

- [ ] **Step 1: 加 profile 页并注册到 `app.json`**
- [ ] **Step 2: 改首页入口与进房**
- [ ] **Step 3: `npx vitest run` 仍绿**
- [ ] **Step 4: Commit**

```bash
git add miniprogram/pages/profile miniprogram/app.json miniprogram/pages/index/index.ts miniprogram/pages/index/index.wxml miniprogram/pages/index/index.wxss
git commit -m "$(cat <<'EOF'
feat: add character card page and lobby profile entry

Players can name a table face before they claim a seat, without blocking create.
EOF
)"
```

---

### Task 7: 选庄页名册与占座

**Files:**
- Modify: `miniprogram/pages/dealer-pick/dealer-pick.ts`, `dealer-pick.wxml`, `dealer-pick.wxss`

**Interfaces:**
- Consumes: `getSession`, `whoami`, `claimSeat`, `unclaimSeat`, `scorerUnclaimSeat`, `scorerRenameSeat`, `isCharacterComplete`, `avatarSrc`, `canMutateSeats`
- Produces: 名册可见；空座可占；选庄手势与占座拆开

手势拆分（避免和「点座选庄」冲突）：

- 点座位**头像/名字区域** `bindtap="onSeatFaceTap"`：占座逻辑。
- 记分员点座位上的「庄」钮 `bindtap="onSelectDealer"` `catchtap`：只设 `selectedId`（现有确认庄家）。
- 非记分员看不到「庄」钮，也不能点确认。

`onSeatFaceTap`：

1. `whoami` + 本地角色卡；未设 → `wx.navigateTo({ url: '/pages/profile/profile?sessionId=' + encodeURIComponent(sessionId) })` 并 return。
2. 未占 → `claimSeat`；已占且是自己 → `unclaimSeat`。
3. 已占且是别人：非记分员 toast「座位已被占」；记分员 `wx.showModal({ title: '请离座位', content: '把这个座位空出来？' })` 确认后 `scorerUnclaimSeat`。
4. 记分员点**未占**座：不要直接占。`wx.showActionSheet({ itemList: ['入座', '改代填名'] })`。入座走 `claimSeat`；改代填名 `wx.showModal` + `editable` 或二次 prompt，确认后 `scorerRenameSeat`。

名册 wxml：

```xml
<scroll-view class="roster" scroll-x>
  <view wx:for="{{members}}" wx:key="openId" class="roster-item {{item.seated ? 'roster-item--seated' : ''}}">
    <image class="roster-face" src="{{item.src}}" mode="aspectFit" />
    <text class="roster-name">{{item.nickname}}</text>
  </view>
</scroll-view>
```

`seated` = 某座 `claimedOpenId === member.openId`。`src = avatarSrc(member.avatarId)`。

座位上加方头像：已占 `avatarSrc(seat.avatarId)`，未占 `avatarSrc('avatar_00')`。头像 css：宽高 88rpx，6rpx 深木框，`border-radius: 8rpx`（禁止圆形）。

`onShow` 重新 `getSession`（从角色卡返回后刷新）。`isScorer = myOpenId === doc.scorerOpenId || myOpenId === doc.scorerId`（不要再写死 `true`，否则请离/改名会对所有人开放）。Mock 默认 actor 仍是记分员，现有开局路径不受影响。

错误 toast 与 spec 一致：「座位已被占」「加入失败」等，claim 抛 `seat occupied` 时显示「座位已被占」。

- [ ] **Step 1: 改 wxml/wxss/ts**
- [ ] **Step 2: `npx vitest run`**
- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/dealer-pick
git commit -m "$(cat <<'EOF'
feat: show room roster and let players claim seats before a round

Keep dealer pick on a separate control so claiming a seat does not start scoring.
EOF
)"
```

---

### Task 8: 战场头像、在场带、验收

**Files:**
- Modify: `miniprogram/pages/battle/battle.ts`, `battle.wxml`, `battle.wxss`
- Modify: `miniprogram/pages/session/session.ts` / `session.wxml` 仅当展示座位名时继续用 `nickname`（不必占座）
- Test: 现有测试全绿；`tests/sessionPresence.test.ts` 结算 `openId` 仍成立

**Interfaces:**
- Consumes: `SessionDoc.members`、`SessionSeat.avatarId`
- Produces: 四方座有方头像；顶栏下成员头像带；点座仍只录胡

`battle.wxml` 每个 `.seat` 在名字前加：

```xml
<image class="seat-face" src="{{item.faceSrc}}" mode="aspectFit" />
```

`buildViewSeats` 增加 `faceSrc: avatarSrc(s.avatarId || 'avatar_00')`。

顶栏下：

```xml
<scroll-view wx:if="{{members.length}}" class="presence" scroll-x>
  <image wx:for="{{members}}" wx:key="openId" class="presence-face" src="{{item.src}}" mode="aspectFit" />
</scroll-view>
```

`applyDoc` 写入 `members: (doc.members || []).map(m => ({ ...m, src: avatarSrc(m.avatarId || 'avatar_00') }))`。

`.seat-face` / `.presence-face`：正方形、深木框、非圆。presence 高约 64rpx，不挡四方桌。

`selectSeat` **禁止**调用 claim。`isScorer` 用 `whoami` 与 `scorerOpenId` 比较（与选庄页相同）；非记分员继续不能录胡。

- [ ] **Step 1: 改战场 UI 与 applyDoc**
- [ ] **Step 2: 全量测试**

Run: `npx vitest run`

Expected: 全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add miniprogram/pages/battle miniprogram/pages/session
git commit -m "$(cat <<'EOF'
feat: render seat and roster avatars on the battle table

Make joiners recognizable during play without letting seat taps claim chairs.
EOF
)"
```

---

## Self-Review (plan vs spec)

| Spec 节 | Task |
|---|---|
| §1 目标 / 非目标 | 全任务；未做年报页、心跳、微信头像 |
| §2 openId 人、角色可改 | 2, 4, 5, 6 |
| §3 users / members / 结算 openId | 4, 5 |
| §4 进房、占座、改卡 | 4, 6, 7 |
| §5 头像库 00–12 | 3 |
| §6 首页 / 角色卡 / 选庄 / 战场 | 6, 7, 8 |
| §7 云 action | 5 |
| §8 错误 toast | 4, 6, 7 |
| §9 单测 | 2, 4, 8 |
| 用户文案牌局 | 1 |

占座与选庄手势冲突在 Task 7 用「脸=占座 / 庄钮=选庄」钉死。
)
