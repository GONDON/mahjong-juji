# WeChat cloud setup (TCMSP)

This project's cloud env is **`cloud1-d4g7zfv1x770ba8fe`**. Node `npm test` still uses the in-memory mock (`typeof wx === 'undefined'`). DevTools / device call `sessionWrite`.

## 1. Create a cloud environment

1. Open the project in **微信开发者工具**.
2. Enable **云开发** and create an environment (free tier is fine for MVP).
3. Copy the **环境 ID** (env id).

## 2. Point the miniprogram at the env

Edit `miniprogram/config.ts`:

```ts
export const CLOUD_ENV_ID = 'your-real-env-id'  // was YOUR_ENV_ID
export const USE_MOCK = false                   // was true
```

`miniprogram/app.ts` calls `wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })` when `wx.cloud` exists.

`project.config.json` already sets `cloudfunctionRoot` to `cloudfunctions/`.

## 3. Create the database collections

In the cloud console, create:

1. **`sessions`** — denormalized session docs. Cloud function writes with the
   server SDK. Client **must not write**. Custom security rules:

   ```
   {
     "read": "auth.openid != null && doc.memberOpenIds != null && auth.openid in doc.memberOpenIds",
     "write": false
   }
   ```

   `memberOpenIds` is a string array kept in sync with `members[].openId`.
   Old docs without the field cannot be watched; `getSession` poll still works.
   Client **may** list with `where({ memberOpenIds: <caller's openId> })` plus
   `.field` / `.orderBy('createdAt', 'desc')` (homepage and 全部牌局).
   Do **not** query by `roomCode` from the client; room-code lookup stays on
   `sessionWrite`.

   Create a composite index on `sessions`: `memberOpenIds` ascending,
   `createdAt` descending. Without it, `orderBy` fails and the lobby shows
   「加载失败」.

2. **`users`** — character cards keyed by WeChat openId (`_id` = openId). Same
   client-write-false pattern; the cloud function uses the server-side SDK.

## 4. Deploy `sessionWrite`

1. In DevTools, right-click `cloudfunctions/sessionWrite` → **上传并部署：云端安装依赖**.
2. Confirm the function appears under 云函数 and uses the same env as `CLOUD_ENV_ID`.

The function routes on `action` and checks `cloud.getWXContext().OPENID` against `scorerOpenId` for scorer write actions (`startCycle`, `appendHu`, `liuju`, `undoLastHu`, `settleCycleManual`, `advanceToNextCycle`, `endSession`, `scorerUnclaimSeat`, `scorerRenameSeat`). Character / seat-claim actions (`whoami`, `getCharacter`, `upsertCharacter`, `enterSession`, `claimSeat`, `unclaimSeat`) use the caller's openId without requiring scorer.

## 5. Smoke on device / DevTools

1. Rebuild the miniprogram with `USE_MOCK=false`.
2. Open a room → pick dealer → record one hu → confirm chips update.
3. Two simulators: A starts a cycle while B is on dealer-pick — B should move to
   battle within a couple of seconds (watch, or poll if rules are not set yet).
4. If you see *Cloud database not configured…*, re-check env id, collection name, and deploy status.

## 6. Switch back to mock

Set `USE_MOCK = true` in `miniprogram/config.ts`. Unit tests and offline UI do not need a cloud env.
