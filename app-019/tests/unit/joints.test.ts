// 圆木榫 / 饼干榫布孔规矩（同一套 layoutHoles）：
// 板宽等分为 n 格，孔落在每格中心——端距 = 孔距/2，两端相等，孔均匀落在板内、不压边
import { describe, it, expect } from 'vitest'
import { computeDowel, computePanel, layoutHoles } from '../../src/lib/joints'

describe('layoutHoles 共用布孔规矩', () => {
  it('首孔在半格处：端距 = 名义孔距 / 2（200mm / 3 孔）', () => {
    const { positions, step, edgeMargin } = layoutHoles(200, 3)
    // 名义孔距 66.67 → 66.7，端距 33.3；首孔取整后 33.3
    expect(step).toBe(66.7)
    expect(positions).toEqual([33.3, 100, 166.7])
    expect(edgeMargin).toBe(33.3)
  })

  it('孔位严格中心对称：两端端距相等，末孔不压右边', () => {
    for (const width of [50, 73, 120, 200, 305, 460, 600, 900]) {
      for (let n = 2; n <= 8; n++) {
        const { positions } = layoutHoles(width, n)
        expect(positions).toHaveLength(n)
        // 中心镜像：pos[i] + pos[n-1-i] === width
        for (let i = 0; i < n; i++) {
          expect(positions[i] + positions[n - 1 - i]).toBeCloseTo(width, 10)
        }
        // 所有孔严格落在板内（0.1mm 网格容差）
        for (const x of positions) {
          expect(x).toBeGreaterThan(0)
          expect(x).toBeLessThan(width)
        }
      }
    }
  })

  it('相邻孔距与端距：端距约为孔距的一半（0.1mm 网格取整）', () => {
    const { positions, step, edgeMargin } = layoutHoles(400, 5)
    expect(step).toBe(80)
    expect(edgeMargin).toBe(40)
    expect(positions).toEqual([40, 120, 200, 280, 360])
  })

  it('取整后间距偏差 ≤ 0.1mm', () => {
    for (const width of [51, 99, 151, 203, 377, 613]) {
      for (let n = 2; n <= 8; n++) {
        const { positions, step } = layoutHoles(width, n)
        const gaps = positions.slice(1).map((x, i) => x - positions[i])
        for (const g of gaps) expect(Math.abs(g - step)).toBeLessThanOrEqual(0.1 + 1e-9)
      }
    }
  })

  it('单孔落在板宽正中', () => {
    const { positions, edgeMargin } = layoutHoles(200, 1)
    expect(positions).toEqual([100])
    expect(edgeMargin).toBe(100)
  })
})

describe('computeDowel（圆木榫）', () => {
  it('200mm 板：3 孔，端距 33.3（旧算法首孔在 0 处压边，此处回归）', () => {
    const r = computeDowel({ width: 200, thickness: 18, kerf: 1.1 })
    expect(r.count).toBe(3)
    expect(r.positions[0]).toBe(33.3)
    expect(r.positions[r.positions.length - 1]).toBe(166.7)
    expect(r.edgeMargin).toBe(33.3)
    expect(r.step).toBe(66.7)
  })

  it('端距小于榫径时给出端部开裂警告', () => {
    const r = computeDowel({ width: 20, thickness: 18, kerf: 1.1 })
    expect(r.count).toBe(2)
    expect(r.edgeMargin).toBe(5)
    expect(r.warnings.some((w) => w.includes('撑裂板端'))).toBe(true)
  })

  it('正常板宽无端距警告，且孔不压边', () => {
    const r = computeDowel({ width: 400, thickness: 18, kerf: 1.1 })
    expect(r.warnings.some((w) => w.includes('撑裂板端'))).toBe(false)
    expect(r.positions[0]).toBeGreaterThanOrEqual(8)
    expect(400 - r.positions[r.positions.length - 1]).toBeGreaterThanOrEqual(8)
  })
})

describe('computePanel（饼干榫）', () => {
  it('300mm 板：3 榫，端距 = 榫距/2，两端对称', () => {
    const r = computePanel({ width: 300, thickness: 18, kerf: 1.1 })
    expect(r.count).toBe(3)
    expect(r.step).toBe(100)
    expect(r.edgeMargin).toBe(50)
    expect(r.positions).toEqual([50, 150, 250])
  })

  it('槽口开出板边时警告（窄板端距 < 12mm）', () => {
    const r = computePanel({ width: 20, thickness: 18, kerf: 1.1 })
    expect(r.edgeMargin).toBe(5)
    expect(r.warnings.some((w) => w.includes('开出板边'))).toBe(true)
  })

  it('与圆木榫同一规矩：两类做法的孔位都来自 layoutHoles（两件对孔可对齐）', () => {
    for (const width of [120, 200, 450, 800]) {
      const d = computeDowel({ width, thickness: 18, kerf: 1.1 })
      const p = computePanel({ width, thickness: 18, kerf: 1.1 })
      expect(d.positions).toEqual(layoutHoles(width, d.count).positions)
      expect(p.positions).toEqual(layoutHoles(width, p.count).positions)
    }
  })
})
