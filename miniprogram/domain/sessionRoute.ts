import type { SessionStatus } from '../services/sessionApi'

export type TablePage = 'dealer-pick' | 'battle' | 'session'

export function tablePageFor(status: SessionStatus): TablePage {
  if (status === 'ended') return 'session'
  if (status === 'playing' || status === 'settling') return 'battle'
  return 'dealer-pick'
}

export function tablePathFor(status: SessionStatus, sessionId: string): string {
  const id = encodeURIComponent(sessionId)
  const page = tablePageFor(status)
  if (page === 'battle') return `/pages/battle/battle?sessionId=${id}`
  if (page === 'session') return `/pages/session/session?sessionId=${id}`
  return `/pages/dealer-pick/dealer-pick?sessionId=${id}`
}

export type FollowDecision =
  | { action: 'stay' }
  | { action: 'redirect'; url: string }

export function sessionFollowDecision(
  page: TablePage,
  status: SessionStatus,
  sessionId: string,
): FollowDecision {
  if (page === 'session') return { action: 'stay' }
  const url = tablePathFor(status, sessionId)
  const target = tablePageFor(status)
  if (target === page) return { action: 'stay' }
  return { action: 'redirect', url }
}
