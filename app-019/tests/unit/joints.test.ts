// 圆木榫 / 饼干榫（拼板）布孔规矩：端距 = 孔距/2，首末孔落在板内，两件对得齐
import { describe, it, expect } from 'vitest'
import { computeDowel, computePanel, layoutEvenSpacing } from '../../src/lib/joints'

function round1(x: number): number {
  return Math.round(x * 10) / 10
}

describe('共用均匀布孔 layoutEvenSpacing', () => {
  it('首孔距端 = 末孔距端 = 半个孔距，孔严格落在板内', () => {
    for (const width of [20, 50, 123.4, 200, 456.7, 900]) {
      for (let count = 2; count <= 8; count++) {
        const l = layoutEvenSpacing(width, count)
        expect(l.positions).toHaveLength(count)
        // 严格递增
        for (let k = 1; k < count; k++) expect(l.positions[k]).toBeGreaterThan(l.positions[k - 1])
        // 首末孔在板内，绝不压在板边上
        expect(l.positions[0]).toBeGreaterThan(0)
        expect(l.positions[count - 1]).toBeLessThan(width)
        // 两端端距 = 半个孔距（0.1 网格取整后互差 ≤ 0.1，2×端距与孔距差 ≤ 0.2）
        const left = round1(l.positions[0])
        const right = round1(width - l.positions[count - 1])
        expect(left).toBe(l.edgeMargin)
        expect(right).toBe(l.edgeMarginEnd)
        expect(Math.abs(left - right)).toBeLessThanOrEqual(0.11)
        expect(Math.abs(round1(left * 2) - l.pitch)).toBeLessThanOrEqual(0.21)
        // 末孔 + 右端端距闭合回板宽（误差 ≤ 0.1mm）
        expect(round1(l.positions[count - 1] + right)).toBe(round1(width))
      }
    }
  })

  it('200mm / 3 孔：孔位 33.4 / 100 / 166.7（半格取整到网格），端距 = 孔距/2', () => {
    const l = layoutEvenSpacing(200, 3)
    expect(l.positions).toEqual([33.4, 100, 166.7])
    expect(l.edgeMargin).toBe(33.4)
    expect(l.edgeMarginEnd).toBe(33.3)
    expect(l.pitch).toBe(66.6)
  })

  it('200mm / 2 孔：孔位 50 / 150（两端各留 50，孔距 100）', () => {
    const l = layoutEvenSpacing(200, 2)
    expect(l.positions).toEqual([50, 150])
    expect(l.edgeMargin).toBe(50)
    expect(l.pitch).toBe(100)
  })

  it('300mm / 3 孔：50 / 150 / 250，两端端距一致', () => {
    const l = layoutEvenSpacing(300, 3)
    expect(l.positions).toEqual([50, 150, 250])
    expect(l.edgeMargin).toBe(50)
    expect(l.edgeMarginEnd).toBe(50)
  })
})

describe('圆木榫 computeDowel（200mm 板）', () => {
  const dw = computeDowel({ width: 200, thickness: 18, kerf: 1.1 })

  it('不再把孔打在板边上（旧算法首孔=0、末孔=200）', () => {
    expect(dw.positions[0]).not.toBe(0)
    expect(dw.positions[dw.positions.length - 1]).not.toBe(200)
    expect(dw.positions).toEqual([33.4, 100, 166.7])
  })

  it('端距字段与首孔实际位置一致（旧字段错标成整个孔距 100）', () => {
    expect(dw.edgeMargin).toBe(dw.positions[0])
    expect(dw.edgeMargin).toBe(33.4)
    expect(dw.pitch).toBe(66.6)
  })

  it('相同输入重算孔位完全一致（两件可对孔）', () => {
    const again = computeDowel({ width: 200, thickness: 18, kerf: 1.1 })
    expect(again.positions).toEqual(dw.positions)
  })

  it('端距不足 2×榫径时给劈裂警告，正常板宽不警告', () => {
    expect(dw.warnings.filter((w) => w.includes('劈裂'))).toEqual([])
    const narrow = computeDowel({ width: 20, thickness: 18, kerf: 1.1 })
    expect(narrow.warnings.some((w) => w.includes('劈裂'))).toBe(true)
  })
})

describe('拼板（饼干榫）computePanel', () => {
  it('200mm：首末榫在板内，端距 = 间距/2 且与标注字段一致', () => {
    const pn = computePanel({ width: 200, thickness: 18, kerf: 1.1 })
    expect(pn.positions[0]).toBeGreaterThan(0)
    expect(pn.positions[pn.positions.length - 1]).toBeLessThan(200)
    expect(pn.edgeMargin).toBe(pn.positions[0])
    expect(Math.abs(round1(pn.edgeMargin * 2) - pn.pitch)).toBeLessThanOrEqual(0.21)
  })

  it('与圆木榫使用同一套布孔规矩（同宽同孔数 → 同位）', () => {
    // 300mm：圆榫 4 孔、拼板 3 孔；同孔数时二者孔位必须一致
    const pn4 = layoutEvenSpacing(300, 4)
    const dw = computeDowel({ width: 300, thickness: 18, kerf: 1.1 })
    expect(dw.positions).toEqual(pn4.positions)
    expect(dw.edgeMargin).toBe(pn4.edgeMargin)
    // 拼板 3 孔：50 / 150 / 250，端距 50（≥ #20 半长 20mm，不警告）
    const pn = computePanel({ width: 300, thickness: 18, kerf: 1.1 })
    expect(pn.positions).toEqual([50, 150, 250])
    expect(pn.edgeMargin).toBe(50)
  })
})
