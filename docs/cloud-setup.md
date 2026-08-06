# WeChat cloud setup (TCMSP)

CI and local `npm test` keep **`USE_MOCK=true`** (default). Use this guide when you have a real WeChat cloud environment and want the miniprogram to call `sessionWrite`.

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

## 3. Create the database collection

In the cloud console, create collection **`sessions`** (permissions: only creator / admin write is fine for MVP; the cloud function uses server-side SDK).

## 4. Deploy `sessionWrite`

1. In DevTools, right-click `cloudfunctions/sessionWrite` → **上传并部署：云端安装依赖**.
2. Confirm the function appears under 云函数 and uses the same env as `CLOUD_ENV_ID`.

The function routes on `action` and checks `cloud.getWXContext().OPENID` against `scorerOpenId` for write actions (`startCycle`, `appendHu`, `liuju`, `undoLastHu`, `settleCycleManual`, `endSession`).

## 5. Smoke on device / DevTools

1. Rebuild the miniprogram with `USE_MOCK=false`.
2. Open a room → pick dealer → record one hu → confirm chips update.
3. If you see *Cloud database not configured…*, re-check env id, collection name, and deploy status.

## 6. Switch back to mock

Set `USE_MOCK = true` in `miniprogram/config.ts`. Unit tests and offline UI do not need a cloud env.
