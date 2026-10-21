// ---------------------------------------------------------------------------
// HOURS-BASED ESTIMATOR
//
// A second, independent way to arrive at a budget: instead of leaning on
// historical comparable projects, this builds the number bottom-up from
// estimated labor hours per role.
//
//   1. Each role's cost = hours × its $/hr rate.
//   2. Labor Subtotal = sum of all role costs.
//   3. Overhead % is applied to the Labor Subtotal (covers non-billable
//      overhead, benefits, profit margin, etc. — configurable in Settings).
//   4. Any manual custom adjustment (flat $ and/or %) is applied last, same
//      pattern as the historical estimator, for consistency.
//   5. Low / High bracket the Likely estimate using configurable contingency
//      percentages (there's no historical variance to measure here, since
//      this method doesn't use comparable-project data at all).
//
// This is intentionally a separate, simpler model from lib/estimator.ts — it
// does not read historical Project data and is shown alongside the
// historical estimate for comparison, not blended into it.
// ---------------------------------------------------------------------------

import type { HoursEstimateInput, HoursEstimateResult, RoleCostLine } from '@/types'

// Everything this calculation needs (hours, rates, overhead %, contingency %) already
// flows through HoursEstimateInput — Settings only supplies the *defaults* the form
// pre-fills, so the engine itself doesn't need an EstimatingSettings dependency.
export function runHoursEstimate(input: HoursEstimateInput): HoursEstimateResult {
  const explanation: string[] = []

  const roleBreakdown: RoleCostLine[] = input.roleHours
    .filter((r) => r.hours > 0)
    .map((r) => ({
      roleId: r.roleId,
      roleName: r.roleName,
      hours: r.hours,
      rate: r.rate,
      cost: r.hours * r.rate,
    }))

  const totalHours = roleBreakdown.reduce((sum, r) => sum + r.hours, 0)
  const laborSubtotal = roleBreakdown.reduce((sum, r) => sum + r.cost, 0)

  if (roleBreakdown.length === 0) {
    explanation.push('No hours were entered for any role — enter estimated hours below to generate a budget.')
  } else {
    roleBreakdown.forEach((r) => {
      explanation.push(`${r.roleName}: ${r.hours.toLocaleString()} hrs × $${r.rate}/hr = $${Math.round(r.cost).toLocaleString()}`)
    })
    explanation.push(`Labor Subtotal: $${Math.round(laborSubtotal).toLocaleString()} (${totalHours.toLocaleString()} total hours)`)
  }

  const overheadAmount = laborSubtotal * (input.overheadPercent / 100)
  if (overheadAmount !== 0) {
    explanation.push(`Overhead (${input.overheadPercent}%): +$${Math.round(overheadAmount).toLocaleString()}`)
  }

  let runningSubtotal = laborSubtotal + overheadAmount

  let customAdjustment = 0
  if (input.customBudgetAdjustment) {
    customAdjustment += input.customBudgetAdjustment
    explanation.push(`Custom Budget Adjustment: ${input.customBudgetAdjustment >= 0 ? '+' : '-'}$${Math.round(Math.abs(input.customBudgetAdjustment)).toLocaleString()}`)
  }
  if (input.customPercentAdjustment) {
    const pctAmount = runningSubtotal * (input.customPercentAdjustment / 100)
    customAdjustment += pctAmount
    explanation.push(`Custom Percentage Adjustment (${input.customPercentAdjustment >= 0 ? '+' : ''}${input.customPercentAdjustment}%): ${pctAmount >= 0 ? '+' : '-'}$${Math.round(Math.abs(pctAmount)).toLocaleString()}`)
  }

  const likelyEstimate = Math.max(0, runningSubtotal + customAdjustment)
  explanation.push(`TOTAL RECOMMENDED BUDGET: $${Math.round(likelyEstimate).toLocaleString()}`)

  const lowEstimate = likelyEstimate * (1 - input.contingencyLowPercent / 100)
  const highEstimate = likelyEstimate * (1 + input.contingencyHighPercent / 100)
  explanation.push(
    `Range reflects a ${input.contingencyLowPercent}% low / ${input.contingencyHighPercent}% high contingency — this method has no historical variance to measure, since it doesn't use comparable-project data.`,
  )

  const blendedRate = totalHours > 0 ? likelyEstimate / totalHours : 0

  return {
    roleBreakdown,
    totalHours,
    laborSubtotal: Math.round(laborSubtotal),
    overheadAmount: Math.round(overheadAmount),
    customAdjustment: Math.round(customAdjustment),
    lowEstimate: Math.round(lowEstimate),
    likelyEstimate: Math.round(likelyEstimate),
    highEstimate: Math.round(highEstimate),
    blendedRate: Math.round(blendedRate * 100) / 100,
    explanation,
  }
}
