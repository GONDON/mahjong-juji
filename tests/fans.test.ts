import { describe, it, expect } from 'vitest'
import { fanProduct } from '../miniprogram/domain/fans'

describe('fanProduct', () => {
  it('pinghu alone is 1', () => {
    expect(fanProduct('pinghu', [], 0)).toBe(1)
  })

  it('duidui * gangshanghua * one gen = 8', () => {
    expect(fanProduct('duidui', ['gangshanghua'], 1)).toBe(8)
  })

  it('qingyise is 4', () => {
    expect(fanProduct('qingyise', [], 0)).toBe(4)
  })

  it('longqidui is 16 and deducts one gen', () => {
    expect(fanProduct('longqidui', [], 0)).toBe(16)
    expect(fanProduct('longqidui', [], 1)).toBe(16)
  })

  it('longqidui with two gens is shuanglong 32', () => {
    expect(fanProduct('longqidui', [], 2)).toBe(32)
  })

  it('qinglongqidui is 32 and deducts one gen', () => {
    expect(fanProduct('qinglongqidui', [], 0)).toBe(32)
    expect(fanProduct('qinglongqidui', [], 1)).toBe(32)
    expect(fanProduct('qinglongqidui', [], 2)).toBe(64)
  })

  it('duidui * jiangdui is 8', () => {
    expect(fanProduct('duidui', ['jiangdui'], 0)).toBe(8)
  })

  it('qingdui * jiangdui is 32', () => {
    expect(fanProduct('qingdui', ['jiangdui'], 0)).toBe(32)
  })

  it('qidui ignores jiangdui', () => {
    expect(fanProduct('qidui', ['jiangdui'], 0)).toBe(4)
  })

  it('qingyise * daiyaojiu is qingyaojiu 16', () => {
    expect(fanProduct('qingyise', ['daiyaojiu'], 0)).toBe(16)
  })

  it('jiangdui does not stack with zhongzhang', () => {
    expect(fanProduct('duidui', ['jiangdui', 'zhongzhang'], 0)).toBe(8)
  })

  it('daiyaojiu does not stack with zhongzhang', () => {
    expect(fanProduct('pinghu', ['daiyaojiu', 'zhongzhang'], 0)).toBe(4)
  })
})
