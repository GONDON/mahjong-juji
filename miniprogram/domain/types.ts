export type PlayerId = string

export type WinType = 'zimo' | 'dianpao'

export type BasicFan =
  | 'pinghu'
  | 'duidui'
  | 'qingyise'
  | 'qidui'
  | 'longqidui'
  | 'jingougou'
  | 'qingdui'
  | 'qingqidui'
  | 'qinglongqidui'
  | 'qingjingougou'

export type ExtraFan =
  | 'gangshanghua'
  | 'gangshangpao'
  | 'qianggang'
  | 'haidi'
  | 'gen'
  | 'menqing'
  | 'zhongzhang'
  | 'daiyaojiu'
  | 'jiangdui'
  | 'tianhu'
  | 'dihu'

export interface Seat {
  playerId: PlayerId
  nickname: string
  chips: number
  hasHu: boolean
}

export interface DealerState {
  dealerId: PlayerId
  streak: number // 连庄数；0 = 首庄，庄倍 = 2 + streak
}

export interface TableState {
  seats: Seat[] // length 4
  dealer: DealerState
  firstHuId: PlayerId | null
}

export interface HuInput {
  winnerId: PlayerId
  winType: WinType
  dianpaoId?: PlayerId
  basicFan: BasicFan
  extras: ExtraFan[]
  genCount: number // 根的个数，每个 ×2
  mingGang: number
  anGang: number
}

export interface Transfer {
  fromId: PlayerId
  toId: PlayerId
  chips: number
  reason: 'fee' | 'fan' | 'gang' | 'truncated'
}

export interface ScoreHuResult {
  transfers: Transfer[]
  perPayer: number // 每人应付（截断前）
  fanPart: number
  gangPart: number
  dealerMult: number
  bankruptTriggered: boolean
}
