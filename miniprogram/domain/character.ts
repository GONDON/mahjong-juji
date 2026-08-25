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
