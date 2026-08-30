import type { BasicFan, ExtraFan } from './types'

const BASIC: Record<BasicFan, number> = {
  pinghu: 1,
  duidui: 2,
  qingyise: 4,
  qidui: 4,
  longqidui: 16,
  jingougou: 4,
  qingdui: 8,
  qingqidui: 16,
  qinglongqidui: 32,
  qingjingougou: 16,
}

const EXTRA: Partial<Record<ExtraFan, number>> = {
  gangshanghua: 2,
  gangshangpao: 2,
  qianggang: 2,
  haidi: 2,
  menqing: 2,
  zhongzhang: 2,
  daiyaojiu: 4,
  jiangdui: 4,
  tianhu: 8,
  dihu: 4,
}

const SEVEN_PAIRS: ReadonlySet<BasicFan> = new Set([
  'qidui',
  'longqidui',
  'qingqidui',
  'qinglongqidui',
])

function dragonGenDeduct(basic: BasicFan): number {
  return basic === 'longqidui' || basic === 'qinglongqidui' ? 1 : 0
}

export function basicFanMult(fan: BasicFan): number {
  return BASIC[fan]
}

export function extraMult(
  extras: ExtraFan[],
  genCount: number,
  basic?: BasicFan,
): number {
  const selected = new Set(extras)
  const skipJiangdui = Boolean(basic && SEVEN_PAIRS.has(basic))
  const skipZhongzhang = selected.has('jiangdui') || selected.has('daiyaojiu')
  let m = 1
  for (const e of extras) {
    if (e === 'gen') continue
    if (e === 'jiangdui' && skipJiangdui) continue
    if (e === 'zhongzhang' && skipZhongzhang) continue
    const v = EXTRA[e]
    if (v) m *= v
  }
  const gens = Math.max(0, genCount - (basic ? dragonGenDeduct(basic) : 0))
  for (let i = 0; i < gens; i++) m *= 2
  return m
}

export function fanProduct(
  basic: BasicFan,
  extras: ExtraFan[],
  genCount: number,
): number {
  return basicFanMult(basic) * extraMult(extras, genCount, basic)
}
