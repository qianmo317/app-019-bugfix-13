// 其余榫卯类型：搭接（lap）、圆木榫/饼干榫定位孔（dowel）、拼板（panel-glue）
import type { Fit } from '../types'
import { round01 } from './format'

// —— 搭接 / 企口 ——
export interface LapInput {
  thickness: number // 板厚（两板同厚）
  width: number     // 搭接长度方向用料宽
  kerf: number
}
export interface LapResult {
  depthEach: number // 每块切深 = 料厚/2 ± 让刀
  lapLength: number // 搭接长度 = 配合板宽
  warnings: string[]
}
export function computeLap(input: LapInput, fit: Fit): LapResult {
  // 紧配合每侧少切让刀 0.2（装后刨平），松配合多切 0.2 留胶（经验值）
  const shave = { tight: -0.2, standard: 0, loose: 0.2 }[fit]
  const depthEach = round01(input.thickness / 2 + shave)
  const warnings: string[] = []
  if (input.thickness / 2 < 6) {
    warnings.push('板厚过薄，半搭后剩余不足 6mm，易断裂')
  }
  void input.kerf
  return { depthEach, lapLength: round01(input.width), warnings }
}

// —— 圆木榫 / 饼干榫 / 拼板共用的均匀布孔规矩 ——
// 第一个孔距板端半个孔距、最后一个孔距另一端半个孔距，孔均匀落在板内（不能落在板边上）；
// 这样两件对起来只要从同一基准端量，孔位必然一一对应。
export interface SpacingLayout {
  count: number
  positions: number[]    // 各孔中心（距左端，mm），0.1 网格
  pitch: number          // 孔距（首孔→次孔的实际间距，0.1 网格）
  edgeMargin: number     // 端距（首孔中心到左端的实际距离，0.1 网格）= 孔距/2
  edgeMarginEnd: number  // 末孔中心到右端的实际距离（与左端差 ≤ 0.1mm，网格取整所致）
}

/**
 * 均匀布孔：板宽等分为 count 段，孔位打在各段中点上，
 * 因此两端各空出半个孔距（半段），首末孔都在板内。
 * 0.1mm 网格累积取整差分（同燕尾齿宽分配），Σ段宽 与板宽严格闭合（≤0.1mm）。
 * 段中点在网格上按奇偶落位（奇数段半格取整到右端），标注值直接取实际孔位：
 * 端距 = positions[0]、孔距 = positions[1]−positions[0]，图纸标注与真实孔位一致。
 */
export function layoutEvenSpacing(width: number, count: number): SpacingLayout {
  const totalUnits = Math.round(width / 0.1)
  const positions: number[] = []
  let boundary = 0 // 已累计的分界点（第 0 个分界点 = 板端 0，单位 0.1mm）
  for (let k = 0; k < count; k++) {
    const next = Math.round((totalUnits * (k + 1)) / count)
    const seg = next - boundary // 第 k 段的 0.1mm 格数
    // 中点在半格上时四舍五入到整格，结果落在 0.1mm 网格
    positions.push(round01((boundary + Math.round(seg / 2)) * 0.1))
    boundary = next
  }
  const edgeMargin = positions[0]
  const edgeMarginEnd = round01(width - positions[count - 1])
  const pitch = count >= 2 ? round01(positions[1] - positions[0]) : round01(width / count)
  return { count: positions.length, positions, pitch, edgeMargin, edgeMarginEnd }
}

// —— 圆木榫 / 饼干榫定位孔 ——
export interface DowelInput {
  width: number       // 板宽（沿拼缝方向）
  thickness: number   // 板厚
  kerf: number
}
export interface DowelResult {
  dowelDia: number    // 木榫直径
  dowelLength: number // 木榫长度
  holeDepth: number   // 单板孔深
  count: number       // 孔数
  positions: number[] // 孔位（距左端）
  pitch: number       // 孔距
  edgeMargin: number  // 端部边距（= 孔距 / 2）
  warnings: string[]
}
export function computeDowel(input: DowelInput): DowelResult {
  const { width, thickness } = input
  const warnings: string[] = []
  const dowelDia = thickness >= 24 ? 10 : 8
  const raw = Math.round(width / 100) + 1
  const count = raw > 8 ? 8 : raw < 2 ? 2 : raw
  const layout = layoutEvenSpacing(width, count)
  if (layout.edgeMargin < dowelDia * 2) {
    warnings.push(`端部边距 ${layout.edgeMargin}mm 不足 ${dowelDia * 2}mm（2×榫径），靠边打孔板端易劈裂，建议缩短孔距增加孔数`)
  }
  if (thickness < 12) warnings.push('板厚不足 12mm，圆木榫易穿透板面，建议改用饼干榫或拼板槽')
  void input.kerf
  return {
    dowelDia,
    dowelLength: dowelDia * 5,
    holeDepth: round01((dowelDia * 5) / 2 + 1),
    count: layout.count,
    positions: layout.positions,
    pitch: layout.pitch,
    edgeMargin: layout.edgeMargin,
    warnings,
  }
}

// —— 拼板（饼干榫/槽） ——
// 饼干榫展开长度的一半（mm），用于判断端距是否容得下榫片及图上画槽
export const BISCUIT_HALF: Record<number, number> = { 0: 15, 10: 18, 20: 20 }
export interface PanelInput {
  width: number     // 单块板宽（拼缝方向长度）
  thickness: number // 板厚
  kerf: number
}
export interface PanelResult {
  biscuitSize: number   // 饼干榫号（0/10/20）
  slotDepth: number     // 槽深
  count: number
  positions: number[]   // 饼干榫位置（距左端）
  pitch: number         // 榫间距
  edgeMargin: number    // 端部边距（= 孔距 / 2）
  grooveWidth: number   // 备选槽榫方案
  grooveDepth: number
  warnings: string[]
}
export function computePanel(input: PanelInput): PanelResult {
  const { width, thickness } = input
  const warnings: string[] = []
  const biscuitSize = thickness >= 20 ? 20 : thickness >= 14 ? 10 : 0
  const slotDepth = round01(biscuitSize === 20 ? 12 : biscuitSize === 10 ? 9 : 6.5)
  const raw = Math.ceil(width / 150) + 1
  const count = raw > 8 ? 8 : raw < 2 ? 2 : raw
  const layout = layoutEvenSpacing(width, count)
  if (layout.edgeMargin < BISCUIT_HALF[biscuitSize]) {
    warnings.push(`端部边距 ${layout.edgeMargin}mm 小于 #${biscuitSize} 饼干榫半长 ${BISCUIT_HALF[biscuitSize]}mm，榫片会顶出板端，建议缩短间距增加榫数`)
  }
  if (width > 600) {
    warnings.push('板宽超过 600mm，建议增加饼干榫数量（每 150mm 一颗）')
  }
  void input.kerf
  return {
    biscuitSize,
    slotDepth,
    count: layout.count,
    positions: layout.positions,
    pitch: layout.pitch,
    edgeMargin: layout.edgeMargin,
    grooveWidth: 6,
    grooveDepth: round01(thickness / 3),
    warnings,
  }
}
