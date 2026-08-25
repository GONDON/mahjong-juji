/**
 * Pure JS port of miniprogram/domain/character.ts — keep string constants identical.
 */

const PLACEHOLDER_AVATAR_ID = 'avatar_00'
const UNSET_DISPLAY_NICKNAME = '牌友'
const NICKNAME_MAX_LEN = 12
const SELECTABLE_AVATAR_IDS = [
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
]

function isSelectableAvatar(id) {
  return SELECTABLE_AVATAR_IDS.indexOf(id) >= 0
}

function trimNickname(raw) {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, NICKNAME_MAX_LEN)
}

function isCharacterComplete(card) {
  if (!card) return false
  return (
    trimNickname(card.nickname || '').length >= 1 &&
    isSelectableAvatar(card.avatarId || '')
  )
}

function validateCharacter(nickname, avatarId) {
  const name = trimNickname(nickname)
  if (!name) return { ok: false, message: '请填写牌桌名' }
  if (!isSelectableAvatar(avatarId)) return { ok: false, message: '请选一个头像' }
  return { ok: true, nickname: name, avatarId }
}

function memberSnapshot(card) {
  if (!isCharacterComplete(card) || !card) {
    return { nickname: UNSET_DISPLAY_NICKNAME, avatarId: PLACEHOLDER_AVATAR_ID }
  }
  return { nickname: trimNickname(card.nickname), avatarId: card.avatarId }
}

module.exports = {
  PLACEHOLDER_AVATAR_ID,
  UNSET_DISPLAY_NICKNAME,
  NICKNAME_MAX_LEN,
  SELECTABLE_AVATAR_IDS,
  isSelectableAvatar,
  trimNickname,
  isCharacterComplete,
  validateCharacter,
  memberSnapshot,
}
