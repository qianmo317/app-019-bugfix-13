// 其余榫卯类型：搭接（lap）、圆木榫/饼干榫定位孔（dowel）、拼板（panel-glue）
import type { Fit } from '../types'
import { round01 } from './format'

/**
 * 圆木榫与饼干榫共用的布孔规矩：
 * 板宽按孔数等分为 n 格，孔落在每格中心——
 * 两端端距各为半个孔距，孔均匀落在板内，第一件与最后一件都不压边。
 * 坐标取 0.1mm 网格，并以中心镜像生成，保证两端端距严格相等（两件对孔时同一基准）。
 */
export interface HoleLayout {
  positions: number[] // 孔位（距左端，mm）
  step: number        // 名义孔距 = 板宽 / 孔数（端距 = 孔距/2）
  edgeMargin: number  // 实际端部边距（两端相等）
}
export function layoutHoles(width: number, count: number): HoleLayout {
  const n = Math.max(1, Math.round(count))
  const totalUnits = Math.round(width / 0.1)
  const cell = totalUnits / n // 每格宽（0.1mm 网格单位，可带小数）
  const halfCount = Math.ceil(n / 2)
  const half: number[] = []
  for (let k = 0; k < halfCount; k++) half.push(Math.round(cell * (k + 0.5)))
  const positions: number[] = []
  for (let k = 0; k < n; k++) {
    const fromLeft = k < halfCount
    const j = fromLeft ? k : n - 1 - k
    const units = fromLeft ? half[j] : totalUnits - half[j]
    positions.push(round01(units / 10))
  }
  const step = round01(width / n)
  return { positions, step, edgeMargin: positions[0] ?? 0 }
}

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
  step: number        // 孔距（相邻孔中心间距）
  edgeMargin: number  // 端部边距 = 孔距 / 2
  warnings: string[]
}
export function computeDowel(input: DowelInput): DowelResult {
  const { width, thickness } = input
  const warnings: string[] = []
  const dowelDia = thickness >= 24 ? 10 : 8
  const raw = Math.round(width / 100) + 1
  const count = raw > 8 ? 8 : raw < 2 ? 2 : raw
  const { positions, step, edgeMargin } = layoutHoles(width, count)
  if (thickness < 12) warnings.push('板厚不足 12mm，圆木榫易穿透板面，建议改用饼干榫或拼板槽')
  if (edgeMargin < dowelDia) {
    warnings.push(`端距 ${edgeMargin}mm 小于木榫直径 ${dowelDia}mm，端孔易撑裂板端，建议加宽板料或减少孔数`)
  }
  void input.kerf
  return { dowelDia, dowelLength: dowelDia * 5, holeDepth: round01((dowelDia * 5) / 2 + 1), count, positions, step, edgeMargin, warnings }
}

// —— 拼板（饼干榫/槽） ——
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
  step: number          // 榫距（相邻槽中心间距）
  edgeMargin: number    // 端部边距 = 榫距 / 2
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
  const { positions, step, edgeMargin } = layoutHoles(width, count)
  if (width > 600) {
    warnings.push('板宽超过 600mm，建议增加饼干榫数量（每 150mm 一颗）')
  }
  // 槽沿拼缝方向半宽 12mm；端距不足时槽口会开出板端
  if (edgeMargin < 12) {
    warnings.push(`端距 ${edgeMargin}mm 小于槽半宽 12mm，端部饼干榫槽会开出板边，建议加宽板料或减少榫数`)
  } else if (edgeMargin < 50) {
    warnings.push(`端距 ${edgeMargin}mm 小于经验值 50mm，端部易开裂，条件允许时建议加宽端距`)
  }
  void input.kerf
  return {
    biscuitSize,
    slotDepth,
    count,
    positions,
    step,
    edgeMargin,
    grooveWidth: 6,
    grooveDepth: round01(thickness / 3),
    warnings,
  }
}
