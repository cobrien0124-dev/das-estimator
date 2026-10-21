// ---------------------------------------------------------------------------
// Complexity adjustments — translates the configurable ComplexityFactors table
// (Estimating Settings) into dollar adjustments for a given estimate input.
//
// Every factor is either a fixed dollar amount or a percentage of the
// historical base estimate, so a settings change never has to touch this
// file — only the numbers in EstimatingSettings.complexityFactors change.
// ---------------------------------------------------------------------------

import type { Adjustment, ComplexityFactors, EstimateInput } from '@/types'

export interface AdjustmentLine {
  label: string
  amount: number
}

export interface AdjustmentGroup {
  amount: number
  lines: AdjustmentLine[]
}

export function applyAdjustment(adjustment: Adjustment, base: number): number {
  if (adjustment.type === 'fixed') return adjustment.value
  return base * (adjustment.value / 100)
}

/** SYSTEM TYPE ADJUSTMENTS bucket: system type (Public Safety / Cellular / Both) + high-rise premium */
export function computeSystemAdjustment(
  input: EstimateInput,
  factors: ComplexityFactors,
  base: number,
): AdjustmentGroup {
  const lines: AdjustmentLine[] = []

  const systemAdj =
    input.systemType === 'Cellular DAS'
      ? factors.systemType.cellular
      : input.systemType === 'Both'
        ? factors.systemType.both
        : factors.systemType.publicSafety // Public Safety DAS / ERRCS is baseline
  const systemAmount = applyAdjustment(systemAdj, base)
  if (systemAmount !== 0) lines.push({ label: `System Type (${input.systemType})`, amount: systemAmount })

  let highRiseAmount = 0
  if (input.isHighRise === true) {
    highRiseAmount = applyAdjustment(factors.highRise, base)
    lines.push({ label: 'High-Rise Premium', amount: highRiseAmount })
  }

  return { amount: systemAmount + highRiseAmount, lines }
}

/** PROJECT COMPLEXITY ADJUSTMENTS bucket: design complexity + coordination complexity */
export function computeComplexityAdjustment(
  input: EstimateInput,
  factors: ComplexityFactors,
  base: number,
): AdjustmentGroup {
  const lines: AdjustmentLine[] = []

  const designAdj = factors.designComplexity[input.designComplexity as keyof typeof factors.designComplexity]
  const designAmount = designAdj ? applyAdjustment(designAdj, base) : 0
  if (designAmount !== 0) lines.push({ label: `Design Complexity (${input.designComplexity})`, amount: designAmount })

  const coordAdj = factors.coordinationComplexity[input.coordinationComplexity as keyof typeof factors.coordinationComplexity]
  const coordAmount = coordAdj ? applyAdjustment(coordAdj, base) : 0
  if (coordAmount !== 0) lines.push({ label: `Coordination Complexity (${input.coordinationComplexity})`, amount: coordAmount })

  return { amount: designAmount + coordAmount, lines }
}

/** AHJ complexity is broken out as its own top-level line in the estimate breakdown */
export function computeAhjAdjustment(input: EstimateInput, factors: ComplexityFactors, base: number): AdjustmentGroup {
  const lines: AdjustmentLine[] = []
  const adj = factors.ahjComplexity[input.ahjComplexity as keyof typeof factors.ahjComplexity]
  const amount = adj ? applyAdjustment(adj, base) : 0
  if (amount !== 0) lines.push({ label: `AHJ Complexity (${input.ahjComplexity})`, amount })
  return { amount, lines }
}

/** COORDINATION / DELIVERABLE REQUIREMENTS bucket: BIM, iBwave, Permit Set */
export function computeDeliverableAdjustment(
  input: EstimateInput,
  factors: ComplexityFactors,
  base: number,
): AdjustmentGroup {
  const lines: AdjustmentLine[] = []
  let amount = 0

  if (input.bimRequired === true) {
    const a = applyAdjustment(factors.bimRequired, base)
    amount += a
    lines.push({ label: 'BIM Coordination', amount: a })
  }
  if (input.ibwaveRequired === true) {
    const a = applyAdjustment(factors.ibwaveRequired, base)
    amount += a
    lines.push({ label: 'iBwave Design', amount: a })
  }
  if (input.permitRequired === true) {
    const a = applyAdjustment(factors.permitSet, base)
    amount += a
    lines.push({ label: 'Permit Set', amount: a })
  }

  return { amount, lines }
}

/** Manual custom adjustments from Section C: a flat dollar amount plus a percentage of the running subtotal */
export function computeCustomAdjustment(
  input: EstimateInput,
  subtotalBeforeCustom: number,
): AdjustmentGroup {
  const lines: AdjustmentLine[] = []
  let amount = 0

  if (input.customBudgetAdjustment) {
    amount += input.customBudgetAdjustment
    lines.push({ label: 'Custom Budget Adjustment', amount: input.customBudgetAdjustment })
  }
  if (input.customPercentAdjustment) {
    const a = subtotalBeforeCustom * (input.customPercentAdjustment / 100)
    amount += a
    lines.push({ label: `Custom Percentage Adjustment (${input.customPercentAdjustment > 0 ? '+' : ''}${input.customPercentAdjustment}%)`, amount: a })
  }

  return { amount, lines }
}
