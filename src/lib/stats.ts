// ---------------------------------------------------------------------------
// Shared statistical helpers used by historicalAnalysis.ts and estimator.ts.
// Kept dependency-free and side-effect-free so they're easy to unit test.
// ---------------------------------------------------------------------------

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/** Linear-interpolation percentile (matches the common "Excel PERCENTILE.INC" method) */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const rank = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(rank)
  const upper = Math.ceil(rank)
  if (lower === upper) return sorted[lower]
  const weight = rank - lower
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/** Mean after dropping the top/bottom `trimFraction` of sorted values (e.g. 0.1 = trim 10% each tail) */
export function trimmedMean(values: number[], trimFraction = 0.1): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const trimCount = Math.floor(sorted.length * trimFraction)
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount)
  return trimmed.length > 0 ? mean(trimmed) : mean(sorted)
}

export function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null
  const m = mean(values)
  if (m === null) return null
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

/** Coefficient of variation (stdev / mean) — a scale-free measure of spread used in the confidence score */
export function coefficientOfVariation(values: number[]): number | null {
  const m = mean(values)
  const sd = standardDeviation(values)
  if (m === null || sd === null || m === 0) return null
  return sd / Math.abs(m)
}

export interface IqrBounds {
  q1: number
  q3: number
  iqr: number
  lowerBound: number
  upperBound: number
}

export function iqrBounds(values: number[], multiplier = 1.5): IqrBounds | null {
  if (values.length < 4) return null
  const q1 = percentile(values, 25)
  const q3 = percentile(values, 75)
  if (q1 === null || q3 === null) return null
  const iqr = q3 - q1
  return {
    q1,
    q3,
    iqr,
    lowerBound: q1 - multiplier * iqr,
    upperBound: q3 + multiplier * iqr,
  }
}

/** Weighted median: the value at the point where cumulative weight first reaches 50% of total weight */
export function weightedMedian(items: { value: number; weight: number }[]): number | null {
  const valid = items.filter((i) => i.weight > 0)
  if (valid.length === 0) return null
  const sorted = [...valid].sort((a, b) => a.value - b.value)
  const totalWeight = sorted.reduce((sum, i) => sum + i.weight, 0)
  let cumulative = 0
  for (const item of sorted) {
    cumulative += item.weight
    if (cumulative >= totalWeight / 2) return item.value
  }
  return sorted[sorted.length - 1].value
}

export function weightedMean(items: { value: number; weight: number }[]): number | null {
  const valid = items.filter((i) => i.weight > 0)
  if (valid.length === 0) return null
  const totalWeight = valid.reduce((sum, i) => sum + i.weight, 0)
  if (totalWeight === 0) return null
  return valid.reduce((sum, i) => sum + i.value * i.weight, 0) / totalWeight
}

/** Simple linear regression (least squares): y = intercept + slope * x */
export interface LinearRegressionModel {
  intercept: number
  slope: number
  rSquared: number
  n: number
}

export function linearRegression(points: { x: number; y: number }[]): LinearRegressionModel | null {
  const n = points.length
  if (n < 3) return null

  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n

  let ssXY = 0
  let ssXX = 0
  for (const p of points) {
    ssXY += (p.x - meanX) * (p.y - meanY)
    ssXX += (p.x - meanX) ** 2
  }
  if (ssXX === 0) return null

  const slope = ssXY / ssXX
  const intercept = meanY - slope * meanX

  let ssTot = 0
  let ssRes = 0
  for (const p of points) {
    const predicted = intercept + slope * p.x
    ssRes += (p.y - predicted) ** 2
    ssTot += (p.y - meanY) ** 2
  }
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot

  return { intercept, slope, rSquared, n }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
