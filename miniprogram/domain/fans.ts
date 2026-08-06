import type { BasicFan, ExtraFan } from './types'

const BASIC: Record<BasicFan, number> = {
  pinghu: 1,
  duidui: 2,
  qingyise: 4,
  qidui: 4,
  jingougou: 4,
  qingdui: 8,
  qingqidui: 16,
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

export function basicFanMult(fan: BasicFan): number {
  return BASIC[fan]
}

export function extraMult(extras: ExtraFan[], genCount: number): number {
  let m = 1
  for (const e of extras) {
    if (e === 'gen') continue
    const v = EXTRA[e]
    if (v) m *= v
  }
  for (let i = 0; i < genCount; i++) m *= 2
  return m
}

export function fanProduct(
  basic: BasicFan,
  extras: ExtraFan[],
  genCount: number,
): number {
  return basicFanMult(basic) * extraMult(extras, genCount)
}
