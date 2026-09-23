// 三视图一致性（蓝图 §10：正视图宽度 = 俯视图宽度）+ 锯路补偿 + 切割清单
import { describe, it, expect } from 'vitest'
import { computeJoint } from '../../src/lib/calc'
import { buildViews } from '../../src/geometry/views'
import { buildCutList } from '../../src/lib/cutlist'
import type { Joint, JointKind } from '../../src/types'

const JOINTS: JointKind[] = ['dovetail', 'half-blind-dovetail', 'mortise-tenon', 'dowel', 'lap', 'panel-glue']

function makeJoint(kind: JointKind): Joint {
  return {
    kind,
    params: {
      boardA: { thickness: 18, width: 200 },
      boardB: { thickness: 18, width: 200 },
      wood: 'hardwood',
      fit: 'standard',
      dovetail: { angleRatio: 8 },
      tenon: { thicknessRatio: 1 / 3, lengthRatio: 1, offsetFromFace: 0 },
      kerfMm: 1.1,
    },
    notes: [],
  }
}

describe('三视图一致性（断言：正视图宽 = 俯视图宽）', () => {
  for (const kind of JOINTS) {
    it(`${kind}: front.contentW === top.contentW`, () => {
      const joint = makeJoint(kind)
      const r = computeJoint(joint)
      const views = buildViews(joint, r)
      expect(views).toHaveLength(3)
      const front = views.find((v) => v.id === 'front')!
      const top = views.find((v) => v.id === 'top')!
      const side = views.find((v) => v.id === 'side')!
      expect(front.contentW).toBe(top.contentW)
      expect(side).toBeTruthy()
      // 视图内几何不得越界（局部坐标 −40~content+60 之外不允许）
      for (const v of views) {
        for (const l of v.lines) {
          expect(l.x1).toBeGreaterThanOrEqual(-40)
          expect(l.y1).toBeGreaterThanOrEqual(-40)
          expect(l.x2).toBeLessThanOrEqual(v.contentW + 60)
          expect(l.y2).toBeLessThanOrEqual(v.contentH + 60)
        }
      }
    })
  }

  it('燕尾：锯切线数量 = 2×齿数（每齿两侧 kerf 补偿线）', () => {
    const joint = makeJoint('dovetail')
    const r = computeJoint(joint)
    const views = buildViews(joint, r)
    const front = views.find((v) => v.id === 'front')!
    const sawCount = front.lines.filter((l) => l.cls === 'saw').length
    expect(sawCount).toBe(r.dovetail!.teeth.length * 2)
  })

  it('燕尾：齿序编号覆盖每个齿', () => {
    const joint = makeJoint('dovetail')
    const r = computeJoint(joint)
    const views = buildViews(joint, r)
    const front = views.find((v) => v.id === 'front')!
    expect(front.marks.map((m) => m.text)).toEqual(r.dovetail!.teeth.map((t) => String(t.index)))
  })

  it('圆木榫：首/末孔不压边，端距=孔距/2，正视/俯视均标两端端距，俯视标孔距', () => {
    const joint = makeJoint('dowel')
    const r = computeJoint(joint)
    const views = buildViews(joint, r)
    const dw = r.dowel!
    const W = joint.params.boardA.width
    // 几何：孔严格落在板内且两端对称
    expect(dw.positions[0]).toBeGreaterThan(0)
    expect(dw.positions[dw.positions.length - 1]).toBeLessThan(W)
    expect(dw.positions[0]).toBeCloseTo(dw.edgeMargin, 6)
    expect(W - dw.positions[dw.positions.length - 1]).toBeCloseTo(dw.edgeMargin, 6)
    expect(Math.abs(dw.edgeMargin - dw.step / 2)).toBeLessThanOrEqual(0.1)
    // 标注：正视图两条端距（左端 0→首孔、右端 末孔→W）
    const front = views.find((v) => v.id === 'front')!
    const frontEdgeDims = front.dims.filter((d) => d.label.includes('端距'))
    expect(frontEdgeDims).toHaveLength(2)
    expect(frontEdgeDims[0].from).toBe(0)
    expect(frontEdgeDims[0].to).toBe(dw.positions[0])
    expect(frontEdgeDims[1].from).toBe(dw.positions[dw.positions.length - 1])
    expect(frontEdgeDims[1].to).toBe(W)
    // 标注：俯视图含端距两条 + 孔距一条
    const top = views.find((v) => v.id === 'top')!
    expect(top.dims.filter((d) => d.label.includes('端距'))).toHaveLength(2)
    expect(top.dims.filter((d) => d.label.includes('孔距'))).toHaveLength(1)
  })

  it('饼干榫：与圆木榫同规矩——首末槽居中于等分格，正视/俯视标两端端距，俯视标榫距', () => {
    const joint = makeJoint('panel-glue')
    const r = computeJoint(joint)
    const views = buildViews(joint, r)
    const pn = r.panel!
    const W = joint.params.boardA.width
    expect(pn.positions[0]).toBeGreaterThan(0)
    expect(pn.positions[pn.positions.length - 1]).toBeLessThan(W)
    expect(pn.positions[0]).toBeCloseTo(pn.edgeMargin, 6)
    expect(W - pn.positions[pn.positions.length - 1]).toBeCloseTo(pn.edgeMargin, 6)
    expect(Math.abs(pn.edgeMargin - pn.step / 2)).toBeLessThanOrEqual(0.1)
    const front = views.find((v) => v.id === 'front')!
    expect(front.dims.filter((d) => d.label.includes('端距'))).toHaveLength(2)
    const top = views.find((v) => v.id === 'top')!
    expect(top.dims.filter((d) => d.label.includes('端距'))).toHaveLength(2)
    expect(top.dims.filter((d) => d.label.includes('榫距'))).toHaveLength(1)
  })
})

describe('切割清单', () => {
  for (const kind of JOINTS) {
    it(`${kind}: A/B 两件步骤非空且有序`, () => {
      const joint = makeJoint(kind)
      const r = computeJoint(joint)
      const cut = buildCutList(joint, r.dovetail, r.tenon)
      expect(cut.boardA.length).toBeGreaterThan(0)
      expect(cut.boardB.length).toBeGreaterThan(0)
      expect(cut.boardA.map((s) => s.no)).toEqual(cut.boardA.map((s) => s.no).sort((a, b) => a - b))
      expect(cut.cautions.length).toBeGreaterThanOrEqual(2)
      expect(cut.cautions.some((c) => c.includes('锯路'))).toBe(true)
      expect(cut.cautions.some((c) => c.includes('锯切线'))).toBe(true)
    })
  }
})
