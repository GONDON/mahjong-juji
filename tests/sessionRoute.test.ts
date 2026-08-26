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
