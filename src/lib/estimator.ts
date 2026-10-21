// ---------------------------------------------------------------------------
// THE ESTIMATING ENGINE
//
// This is the single place that turns (EstimateInput + historical Projects +
// EstimatingSettings) into an EstimateResult. Nothing here knows about React,
// routing, or persistence — it's a pure function, which is what lets an old
// saved estimate stay frozen even after Settings change later (the caller
// snapshots the settings/projects it passed in alongside the result).
//
// HOW A NUMBER IS BUILT, TOP TO BOTTOM:
//
//   1. Four independent estimation METHODS each try to produce a $ figure
//      from the historical data (methodResults below). A method that
//      doesn't have enough data marks itself unavailable instead of guessing.
//   2. The available methods are blended by their configured weights
//      (normalized so unavailable methods' weight is redistributed, not lost)
//      into a single "multi-method estimate."
//   3. historicalBase is set to the Similar-Projects method's own result
//      (falling back to the plain historical median when that method itself
//      is unavailable) — this is "what a typical comparable project cost."
//   4. squareFootageAdjustment is the gap between the multi-method estimate
//      and that base — i.e. how much this project's specific size moved the
//      number away from the generic comparable figure.
//   5. DAS-specific complexity adjustments (system type / high-rise, design +
//      coordination complexity, AHJ complexity, BIM/iBwave/permit
//      deliverables, and finally any manual custom adjustment) are layered on
//      top, each computed by lib/complexityFactors.ts against the running
//      subtotal so every dollar is traceable to one labeled line.
//   6. Low/High bracket the result using the 25th/75th percentile of
//      comparable historical budgets when there's enough data, or a
//      configurable +/- fallback multiplier when there isn't (clearly
//      flagged via usedFallbackRange).
//   7. A 0-100 confidence score is derived from how much and how consistent
//      the supporting data was (see computeConfidence below).
// ---------------------------------------------------------------------------

import type {
  ConfidenceReason,
  EstimateInput,
  EstimateResult,
  EstimatingSettings,
  MethodResult,
  Project,
} from '@/types'
import {
  computeAhjAdjustment,
  computeComplexityAdjustment,
  computeCustomAdjustment,
  computeDeliverableAdjustment,
  computeSystemAdjustment,
} from './complexityFactors'
import { computeGroupStats, getModelablePool, nearestSizeGroups } from './historicalAnalysis'
import { findSimilarProjects } from './similarityEngine'
import { clamp, coefficientOfVariation, linearRegression, median, percentile, trimmedMean, weightedMedian } from './stats'

const MISSING_INPUT_FIELDS: (keyof EstimateInput)[] = [
  'squareFootage',
  'floors',
  'buildings',
  'buildingType',
  'systemType',
  'isHighRise',
  'isNewConstruction',
  'ibwaveRequired',
  'bimRequired',
  'permitRequired',
  'ahjComplexity',
  'designComplexity',
  'coordinationComplexity',
]

function isFieldMissing(value: unknown): boolean {
  return value === null || value === '' || value === 'Unknown'
}

// ---------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------

/** METHOD 1 — Historical Similar Projects: weighted median of comparable projects' budgets, weighted by similarity score */
function methodSimilarProjects(
  weightedBudgets: { value: number; weight: number }[],
  minRequired: number,
): { value: number | null; available: boolean; reason: string | null; sampleSize: number } {
  if (weightedBudgets.length < minRequired) {
    return {
      value: null,
      available: false,
      reason: `Fewer than ${minRequired} similar historical projects found (${weightedBudgets.length}).`,
      sampleSize: weightedBudgets.length,
    }
  }
  return { value: weightedMedian(weightedBudgets), available: true, reason: null, sampleSize: weightedBudgets.length }
}

/** METHOD 2 — Project Size Model: median $/SF of the nearest size group with enough data, scaled to this project's SF */
function methodSizeGroup(
  input: EstimateInput,
  pool: Project[],
  settings: EstimatingSettings,
): { value: number | null; available: boolean; reason: string | null; sampleSize: number } {
  if (input.squareFootage === null) {
    return { value: null, available: false, reason: 'Square footage not provided.', sampleSize: 0 }
  }
  const ordered = nearestSizeGroups(input.squareFootage, settings.sizeGroups)
  for (const group of ordered) {
    const stats = computeGroupStats(pool, group)
    if (stats.count >= settings.minHistoricalProjects && stats.medianCostPerSF !== null) {
      return { value: stats.medianCostPerSF * input.squareFootage, available: true, reason: null, sampleSize: stats.count }
    }
  }
  return {
    value: null,
    available: false,
    reason: `No size group has at least ${settings.minHistoricalProjects} comparable projects.`,
    sampleSize: 0,
  }
}

/** METHOD 3 — Regression Model: Budget = intercept + slope * SquareFootage, fit across the modelable pool */
function methodRegression(
  input: EstimateInput,
  pool: Project[],
  settings: EstimatingSettings,
): { value: number | null; available: boolean; reason: string | null; sampleSize: number; rSquared?: number } {
  if (!settings.regressionEnabled) {
    return { value: null, available: false, reason: 'Regression model disabled in Estimating Settings.', sampleSize: 0 }
  }
  if (input.squareFootage === null) {
    return { value: null, available: false, reason: 'Square footage not provided.', sampleSize: 0 }
  }
  const points = pool
    .filter((p) => p.squareFootage !== null && p.budget !== null)
    .map((p) => ({ x: p.squareFootage as number, y: p.budget as number }))

  if (points.length < Math.max(5, settings.minHistoricalProjects)) {
    return {
      value: null,
      available: false,
      reason: `Insufficient historical data for a regression fit (need ${Math.max(5, settings.minHistoricalProjects)}, have ${points.length}).`,
      sampleSize: points.length,
    }
  }
  const model = linearRegression(points)
  if (!model) {
    return { value: null, available: false, reason: 'Regression fit failed (no variance in square footage).', sampleSize: points.length }
  }
  const predicted = Math.max(0, model.intercept + model.slope * input.squareFootage)
  return { value: predicted, available: true, reason: null, sampleSize: points.length, rSquared: model.rSquared }
}

/** METHOD 4 — Historical $/SF: trimmed-mean $/SF across the whole modelable pool (a portfolio-wide benchmark), scaled to this project's SF */
function methodCostPerSF(
  input: EstimateInput,
  pool: Project[],
  settings: EstimatingSettings,
): { value: number | null; available: boolean; reason: string | null; sampleSize: number } {
  if (input.squareFootage === null) {
    return { value: null, available: false, reason: 'Square footage not provided.', sampleSize: 0 }
  }
  const costs = pool.map((p) => p.costPerSF).filter((v): v is number => v !== null)
  if (costs.length < settings.minHistoricalProjects) {
    return {
      value: null,
      available: false,
      reason: `Fewer than ${settings.minHistoricalProjects} historical projects with usable Cost/SF (${costs.length}).`,
      sampleSize: costs.length,
    }
  }
  const rate = trimmedMean(costs, 0.1)
  return { value: rate !== null ? rate * input.squareFootage : null, available: true, reason: null, sampleSize: costs.length }
}

// ---------------------------------------------------------------------------
// Weight normalization
// ---------------------------------------------------------------------------

/** Redistributes an unavailable method's configured weight proportionally across the methods that ARE available */
function normalizeWeights(results: Omit<MethodResult, 'normalizedWeight'>[]): MethodResult[] {
  const availableTotalRawWeight = results.filter((r) => r.available).reduce((s, r) => s + r.rawWeight, 0)
  return results.map((r) => ({
    ...r,
    normalizedWeight: r.available && availableTotalRawWeight > 0 ? (r.rawWeight / availableTotalRawWeight) * 100 : 0,
  }))
}

// ---------------------------------------------------------------------------
// Confidence score
// ---------------------------------------------------------------------------

function computeConfidence(params: {
  similarCount: number
  avgSimilarity: number | null
  costVariance: number | null
  availableMethodCount: number
  input: EstimateInput
}): { score: number; reasons: ConfidenceReason[] } {
  const reasons: ConfidenceReason[] = []

  // Up to 30 points: more comparable projects = more confidence. Saturates at 10 projects.
  const countScore = clamp(params.similarCount / 10, 0, 1) * 30
  reasons.push({
    label: 'Comparable projects',
    positive: params.similarCount >= 5,
    detail: `${params.similarCount} comparable historical project${params.similarCount === 1 ? '' : 's'} found`,
  })

  // Up to 25 points: how closely those comparables actually match this project.
  const similarityScore = params.avgSimilarity !== null ? (params.avgSimilarity / 100) * 25 : 0
  if (params.avgSimilarity !== null) {
    reasons.push({
      label: 'Average similarity',
      positive: params.avgSimilarity >= 70,
      detail: `Average similarity score: ${Math.round(params.avgSimilarity)}%`,
    })
  }

  // Up to 20 points: less spread in comparable Cost/SF = more trustworthy midpoint.
  let varianceScore = 10 // neutral default when variance can't be computed
  if (params.costVariance !== null) {
    varianceScore = clamp(1 - params.costVariance, 0, 1) * 20
    const label = params.costVariance < 0.25 ? 'Low' : params.costVariance < 0.6 ? 'Moderate' : 'High'
    reasons.push({
      label: 'Budget variation',
      positive: params.costVariance < 0.25,
      detail: `${label} variation in comparable project Cost/SF`,
    })
  }

  // Up to 15 points: more independent methods agreeing = more confidence.
  const methodScore = clamp(params.availableMethodCount / 4, 0, 1) * 15
  reasons.push({
    label: 'Estimation methods',
    positive: params.availableMethodCount >= 3,
    detail: `${params.availableMethodCount} of 4 estimation methods available`,
  })

  // Up to 10 points: how complete the project inputs are.
  const missing = MISSING_INPUT_FIELDS.filter((f) => isFieldMissing(params.input[f]))
  const completeness = 1 - missing.length / MISSING_INPUT_FIELDS.length
  const completenessScore = completeness * 10
  reasons.push({
    label: 'Input completeness',
    positive: missing.length === 0,
    detail:
      missing.length === 0
        ? 'All project details provided'
        : `${missing.length} of ${MISSING_INPUT_FIELDS.length} project detail${missing.length === 1 ? '' : 's'} not provided`,
  })

  const score = Math.round(clamp(countScore + similarityScore + varianceScore + methodScore + completenessScore, 0, 100))
  return { score, reasons }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function runEstimate(input: EstimateInput, allProjects: Project[], settings: EstimatingSettings): EstimateResult {
  const explanation: string[] = []
  const fallbacksUsed: string[] = []
  const pool = getModelablePool(allProjects)

  // --- Similarity -----------------------------------------------------
  const similarProjects = findSimilarProjects(input, allProjects, settings.similarityWeights, {
    minScore: settings.minSimilarityScore,
    maxResults: settings.maxSimilarProjects,
  })
  const weightedBudgets = similarProjects
    .filter((s) => s.project.budget !== null)
    .map((s) => ({ value: s.project.budget as number, weight: s.similarityScore }))

  // --- Four estimation methods -----------------------------------------
  const m1 = methodSimilarProjects(weightedBudgets, settings.minHistoricalProjects)
  const m2 = methodSizeGroup(input, pool, settings)
  const m3 = methodRegression(input, pool, settings)
  const m4 = methodCostPerSF(input, pool, settings)

  const rawResults: Omit<MethodResult, 'normalizedWeight'>[] = [
    {
      method: 'similarProjects',
      label: 'Historical Similar Projects',
      value: m1.value,
      rawWeight: settings.methodWeights.similarProjects,
      available: m1.available,
      unavailableReason: m1.reason,
      sampleSize: m1.sampleSize,
    },
    {
      method: 'sizeGroup',
      label: 'Project Size Model',
      value: m2.value,
      rawWeight: settings.methodWeights.sizeGroup,
      available: m2.available,
      unavailableReason: m2.reason,
      sampleSize: m2.sampleSize,
    },
    {
      method: 'regression',
      label: 'Regression Model',
      value: m3.value,
      rawWeight: settings.methodWeights.regression,
      available: m3.available,
      unavailableReason: m3.reason,
      sampleSize: m3.sampleSize,
    },
    {
      method: 'costPerSF',
      label: 'Historical $/SF',
      value: m4.value,
      rawWeight: settings.methodWeights.costPerSF,
      available: m4.available,
      unavailableReason: m4.reason,
      sampleSize: m4.sampleSize,
    },
  ]
  const methodResults = normalizeWeights(rawResults)
  const availableMethods = methodResults.filter((r) => r.available && r.value !== null)

  let multiMethodEstimate = 0
  if (availableMethods.length > 0) {
    multiMethodEstimate = availableMethods.reduce((sum, r) => sum + (r.value as number) * (r.normalizedWeight / 100), 0)
    explanation.push(
      `Blended ${availableMethods.length} of 4 estimation method${availableMethods.length === 1 ? '' : 's'}: ${availableMethods
        .map((r) => `${r.label} (${Math.round(r.normalizedWeight)}%)`)
        .join(', ')}.`,
    )
  } else {
    fallbacksUsed.push('no-methods-available')
    explanation.push('No estimation method had enough historical data — result is $0 and should be treated as informational only.')
  }
  methodResults
    .filter((r) => !r.available)
    .forEach((r) => explanation.push(`${r.label} not used: ${r.unavailableReason}`))

  // --- Historical base + square footage adjustment -----------------------
  let historicalBase: number
  if (m1.available && m1.value !== null) {
    historicalBase = m1.value
  } else {
    const poolBudgets = pool.map((p) => p.budget).filter((v): v is number => v !== null)
    historicalBase = median(poolBudgets) ?? 0
    if (poolBudgets.length === 0) fallbacksUsed.push('no-historical-base')
  }
  const squareFootageAdjustment = multiMethodEstimate - historicalBase
  explanation.push(`Historical Base Estimate: $${Math.round(historicalBase).toLocaleString()} (typical comparable project).`)
  explanation.push(
    `Square Footage Adjustment: ${squareFootageAdjustment >= 0 ? '+' : '-'}$${Math.round(Math.abs(squareFootageAdjustment)).toLocaleString()} (this project's size vs. the comparable baseline).`,
  )

  // --- DAS complexity adjustments, layered on the multi-method subtotal --
  let runningSubtotal = historicalBase + squareFootageAdjustment // === multiMethodEstimate
  const factors = settings.complexityFactors

  const systemAdj = computeSystemAdjustment(input, factors, runningSubtotal)
  runningSubtotal += systemAdj.amount
  systemAdj.lines.forEach((l) => explanation.push(`${l.label}: ${l.amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(l.amount)).toLocaleString()}`))

  const complexityAdj = computeComplexityAdjustment(input, factors, runningSubtotal)
  runningSubtotal += complexityAdj.amount
  complexityAdj.lines.forEach((l) => explanation.push(`${l.label}: ${l.amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(l.amount)).toLocaleString()}`))

  const ahjAdj = computeAhjAdjustment(input, factors, runningSubtotal)
  runningSubtotal += ahjAdj.amount
  ahjAdj.lines.forEach((l) => explanation.push(`${l.label}: ${l.amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(l.amount)).toLocaleString()}`))

  const deliverableAdj = computeDeliverableAdjustment(input, factors, runningSubtotal)
  runningSubtotal += deliverableAdj.amount
  deliverableAdj.lines.forEach((l) => explanation.push(`${l.label}: ${l.amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(l.amount)).toLocaleString()}`))

  const customAdj = computeCustomAdjustment(input, runningSubtotal)
  runningSubtotal += customAdj.amount
  customAdj.lines.forEach((l) => explanation.push(`${l.label}: ${l.amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(l.amount)).toLocaleString()}`))

  const likelyEstimate = Math.max(0, runningSubtotal)
  explanation.push(`TOTAL RECOMMENDED BUDGET: $${Math.round(likelyEstimate).toLocaleString()}`)

  // --- Low / High range ---------------------------------------------------
  const comparableBudgets =
    weightedBudgets.length >= settings.minHistoricalProjects
      ? weightedBudgets.map((b) => b.value)
      : pool.map((p) => p.budget).filter((v): v is number => v !== null)

  let lowEstimate: number
  let highEstimate: number
  let usedFallbackRange = false

  if (comparableBudgets.length >= settings.minHistoricalProjects) {
    const p25 = percentile(comparableBudgets, 25)
    const p75 = percentile(comparableBudgets, 75)
    // Scale the historical percentile spread proportionally onto the likely estimate so the
    // range reflects historical variation without being thrown off by an absolute mismatch
    // in project size between the comparables and this specific project.
    const historicalMedian = median(comparableBudgets) ?? likelyEstimate
    const lowRatio = historicalMedian > 0 && p25 !== null ? p25 / historicalMedian : settings.defaultLowMultiplier
    const highRatio = historicalMedian > 0 && p75 !== null ? p75 / historicalMedian : settings.defaultHighMultiplier
    lowEstimate = likelyEstimate * clamp(lowRatio, 0.3, 1)
    highEstimate = likelyEstimate * clamp(highRatio, 1, 3)
  } else {
    usedFallbackRange = true
    fallbacksUsed.push('default-low-high-range')
    lowEstimate = likelyEstimate * settings.defaultLowMultiplier
    highEstimate = likelyEstimate * settings.defaultHighMultiplier
    explanation.push(
      `Low/High range uses the default fallback (${Math.round(settings.defaultLowMultiplier * 100)}% / ${Math.round(settings.defaultHighMultiplier * 100)}%) — fewer than ${settings.minHistoricalProjects} comparable projects were available for a statistical range.`,
    )
  }
  lowEstimate = Math.min(lowEstimate, likelyEstimate)
  highEstimate = Math.max(highEstimate, likelyEstimate)

  // --- Confidence -----------------------------------------------------
  const avgSimilarity =
    similarProjects.length > 0 ? similarProjects.reduce((s, p) => s + p.similarityScore, 0) / similarProjects.length : null
  const costVariance = coefficientOfVariation(similarProjects.map((s) => s.project.costPerSF).filter((v): v is number => v !== null))
  const { score: confidenceScore, reasons: confidenceReasons } = computeConfidence({
    similarCount: similarProjects.length,
    avgSimilarity,
    costVariance,
    availableMethodCount: availableMethods.length,
    input,
  })

  return {
    lowEstimate: Math.round(lowEstimate),
    likelyEstimate: Math.round(likelyEstimate),
    highEstimate: Math.round(highEstimate),
    confidenceScore,
    historicalBase: Math.round(historicalBase),
    squareFootageAdjustment: Math.round(squareFootageAdjustment),
    systemAdjustment: Math.round(systemAdj.amount),
    complexityAdjustment: Math.round(complexityAdj.amount),
    bimAdjustment: Math.round(deliverableAdj.amount),
    ahjAdjustment: Math.round(ahjAdj.amount),
    customAdjustment: Math.round(customAdj.amount),
    similarProjects,
    explanation,
    methodResults,
    confidenceReasons,
    fallbacksUsed,
    usedFallbackRange,
  }
}
