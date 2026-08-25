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
