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
