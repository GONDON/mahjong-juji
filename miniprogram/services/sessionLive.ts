import {
  sessionFollowDecision,
  type TablePage,
} from '../domain/sessionRoute'
import { getSession as defaultGetSession } from './sessionApi'
import type { SessionDoc } from './sessionApi'
import {
  PRESENCE_POLL_MS,
  startPresencePoll,
  type PresencePoll,
} from './presencePoll'

export const FIRST_PACKET_TIMEOUT_MS = 2000
export const WATCH_RETRY_MS = 15000

export function toPublicSessionDoc(raw: Record<string, unknown>): SessionDoc {
  const {
    undoStack: _undoStack,
    dealerPickId: _dealerPickId,
    _id,
    ...rest
  } = raw as SessionDoc & {
    undoStack?: unknown
    dealerPickId?: unknown
    _id?: unknown
  }
  const pub = { ...(rest as SessionDoc) }
  if (!pub.sessionId && typeof _id === 'string') {
    pub.sessionId = _id
  }
  return pub
}

export type SessionWatcher = { close: () => void }

export type WatchFn = (
  sessionId: string,
  handlers: {
    onChange: (raw: Record<string, unknown>) => void
    onError: (err: unknown) => void
  },
) => SessionWatcher | null

function defaultWatch(
  sessionId: string,
  handlers: Parameters<WatchFn>[1],
): SessionWatcher | null {
  try {
    if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.database) {
      return null
    }
    const watcher = wx.cloud.database().collection('sessions').doc(sessionId).watch({
      onChange(snapshot: {
        docs?: Record<string, unknown>[]
        docChanges?: { doc?: Record<string, unknown> }[]
      }) {
        const fromDocs = snapshot.docs && snapshot.docs[0]
        const changes = snapshot.docChanges || []
        const fromChange = changes.length
          ? changes[changes.length - 1].doc
          : undefined
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
}): { stop: () => void } {
  const getSession = opts.getSession ?? defaultGetSession
  const watchFn = opts.watch ?? defaultWatch
  const startPoll = opts.startPoll ?? startPresencePoll
  const setTimeoutFn = opts.setTimeoutFn ?? setTimeout
  const clearTimeoutFn = opts.clearTimeoutFn ?? clearTimeout
  const firstPacketTimeoutMs =
    opts.firstPacketTimeoutMs ?? FIRST_PACKET_TIMEOUT_MS
  const watchRetryMs = opts.watchRetryMs ?? WATCH_RETRY_MS

  let stopped = false
  let gotPacket = false
  let firstErrorSent = false
  let watcher: SessionWatcher | null = null
  let poll: PresencePoll | null = null
  let firstPacketTimer: ReturnType<typeof setTimeout> | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  function apply(raw: Record<string, unknown> | SessionDoc) {
    if (stopped) return
    gotPacket = true
    clearFirstPacketTimer()
    const pub = toPublicSessionDoc(raw as Record<string, unknown>)
    if (!pub.sessionId) pub.sessionId = opts.sessionId
    const decision = sessionFollowDecision(opts.page, pub.status, pub.sessionId)
    if (decision.action === 'redirect') {
      opts.onNavigate(decision.url)
      return
    }
    opts.onDoc(pub)
  }

  function reportFirstError(err: unknown) {
    if (gotPacket || firstErrorSent || stopped) return
    firstErrorSent = true
    opts.onFirstError?.(err)
  }

  function clearFirstPacketTimer() {
    if (firstPacketTimer != null) {
      clearTimeoutFn(firstPacketTimer)
      firstPacketTimer = null
    }
  }

  function clearRetryTimer() {
    if (retryTimer != null) {
      clearTimeoutFn(retryTimer)
      retryTimer = null
    }
  }

  function stopWatch() {
    try {
      watcher?.close()
    } catch {
      // Watcher may already be closed after onError.
    }
    watcher = null
  }

  function stopPoll() {
    poll?.stop()
    poll = null
  }

  async function pollTick() {
    if (stopped) return
    try {
      const next = await getSession(opts.sessionId)
      apply(next as unknown as Record<string, unknown>)
    } catch (err) {
      reportFirstError(err)
    }
  }

  function scheduleWatchRetry() {
    clearRetryTimer()
    if (stopped) return
    retryTimer = setTimeoutFn(() => {
      retryTimer = null
      if (stopped || watcher) return
      attachWatch()
      if (!watcher) scheduleWatchRetry()
    }, watchRetryMs)
  }

  function startPolling() {
    if (stopped || poll) return
    stopWatch()
    clearFirstPacketTimer()
    poll = startPoll({
      tick: pollTick,
      intervalMs: PRESENCE_POLL_MS,
    })
    scheduleWatchRetry()
  }

  function attachWatch() {
    if (stopped || watcher) return
    const handle = watchFn(opts.sessionId, {
      onChange(raw) {
        if (stopped) return
        stopPoll()
        clearRetryTimer()
        apply(raw)
      },
      onError() {
        if (stopped) return
        stopWatch()
        startPolling()
      },
    })
    if (!handle) return
    watcher = handle
    if (poll) {
      stopPoll()
      clearRetryTimer()
    }
    if (!gotPacket) {
      clearFirstPacketTimer()
      firstPacketTimer = setTimeoutFn(() => {
        firstPacketTimer = null
        if (stopped || gotPacket) return
        startPolling()
      }, firstPacketTimeoutMs)
    }
  }

  attachWatch()
  if (!watcher) startPolling()

  return {
    stop() {
      stopped = true
      clearFirstPacketTimer()
      clearRetryTimer()
      stopWatch()
      stopPoll()
    },
  }
}
