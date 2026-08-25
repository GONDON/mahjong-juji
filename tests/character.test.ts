import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  avatarSrc,
  isCharacterComplete,
  memberSnapshot,
  PLACEHOLDER_AVATAR_ID,
  preferLocalCharacter,
  SELECTABLE_AVATAR_IDS,
  UNSET_DISPLAY_NICKNAME,
  validateCharacter,
  type CharacterCard,
} from '../miniprogram/domain/character'

function card(partial: Partial<CharacterCard> & Pick<CharacterCard, 'updatedAt'>): CharacterCard {
  return {
    openId: 'o1',
    nickname: '阿强',
    avatarId: 'avatar_01',
    ...partial,
  }
}

describe('character', () => {
  it('rejects empty name and placeholder avatar', () => {
    expect(validateCharacter('  ', 'avatar_01').ok).toBe(false)
    expect(validateCharacter('阿强', PLACEHOLDER_AVATAR_ID).ok).toBe(false)
    expect(validateCharacter('阿强', 'avatar_99').ok).toBe(false)
    expect(validateCharacter('阿强', 'avatar_18').ok).toBe(false)
  })

  it('accepts trimmed name and selectable avatar', () => {
    const r = validateCharacter('  阿强  ', 'avatar_03')
    expect(r).toEqual({ ok: true, nickname: '阿强', avatarId: 'avatar_03' })
    expect(isCharacterComplete({ nickname: '阿强', avatarId: 'avatar_03' })).toBe(true)
    expect(isCharacterComplete(null)).toBe(false)
  })

  it('offers seventeen selectable notion faces', () => {
    expect(SELECTABLE_AVATAR_IDS).toHaveLength(17)
    expect(validateCharacter('阿强', 'avatar_05').ok).toBe(true)
    expect(validateCharacter('阿珍', 'avatar_17').ok).toBe(true)
  })

  it('ships a png for every selectable face', () => {
    for (const id of SELECTABLE_AVATAR_IDS) {
      expect(existsSync(`miniprogram/assets/avatars/${id}.png`), id).toBe(true)
    }
  })

  it('member snapshot uses 牌友 when unset', () => {
    expect(memberSnapshot(null)).toEqual({
      nickname: UNSET_DISPLAY_NICKNAME,
      avatarId: PLACEHOLDER_AVATAR_ID,
    })
  })

  it('points selectable faces at png and the empty frame at svg', () => {
    expect(avatarSrc('avatar_01')).toBe('/assets/avatars/avatar_01.png')
    expect(avatarSrc('avatar_17')).toBe('/assets/avatars/avatar_17.png')
    expect(avatarSrc(PLACEHOLDER_AVATAR_ID)).toBe('/assets/avatars/avatar_00.svg')
  })

  it('preferLocalCharacter: newer local wins and retries upsert', () => {
    expect(
      preferLocalCharacter(card({ updatedAt: 200, nickname: '本地' }), card({ updatedAt: 100 })),
    ).toEqual({ card: card({ updatedAt: 200, nickname: '本地' }), shouldRetryUpsert: true })
  })

  it('preferLocalCharacter: newer cloud wins without retry', () => {
    expect(
      preferLocalCharacter(card({ updatedAt: 100 }), card({ updatedAt: 200, nickname: '云端' })),
    ).toEqual({ card: card({ updatedAt: 200, nickname: '云端' }), shouldRetryUpsert: false })
  })

  it('preferLocalCharacter: local-only retries; cloud-only does not', () => {
    const local = card({ updatedAt: 50 })
    expect(preferLocalCharacter(local, null)).toEqual({
      card: local,
      shouldRetryUpsert: true,
    })
    const cloud = card({ updatedAt: 50 })
    expect(preferLocalCharacter(null, cloud)).toEqual({
      card: cloud,
      shouldRetryUpsert: false,
    })
    expect(preferLocalCharacter(null, null)).toEqual({
      card: null,
      shouldRetryUpsert: false,
    })
  })
})
