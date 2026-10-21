// ---------------------------------------------------------------------------
// Historical data analysis: cost-per-SF derivation, outlier detection, and
// project-size grouping. This module never talks to the UI or persistence —
// it's pure functions over Project[] so the model can be tested and evolved
// independently of everything else.
// ---------------------------------------------------------------------------

import type { Project, SizeGroup } from '@/types'
import { iqrBounds, median, trimmedMean } from './stats'

/** budget / squareFootage — null when either input is missing or squareFootage is 0 */
export function computeCostPerSF(project: Pick<Project, 'budget' | 'squareFootage'>): number | null {
  if (project.budget === null || project.squareFootage === null || project.squareFootage <= 0) return null
  return project.budget / project.squareFootage
}

/**
 * Re-runs IQR-based outlier detection on Cost/SF across all projects with complete
 * data. Returns a NEW array — projects flagged as outliers get isOutlier=true and
 * includeInModel=false (per spec: outliers are excluded from the default model but
 * remain manually re-includable from the Historical Projects page).
 *
 * Projects the user has already reviewed (outlierReason starting with "Manual")
 * are left untouched so a re-run doesn't clobber a human decision.
 */
export function detectOutliers(projects: Project[], iqrMultiplier: number): Project[] {
  const complete = projects.filter((p) => p.dataQuality === 'complete' && p.costPerSF !== null)
  const bounds = iqrBounds(
    complete.map((p) => p.costPerSF as number),
    iqrMultiplier,
  )

  return projects.map((p) => {
    if (p.outlierReason?.startsWith('Manual')) return p
    if (p.dataQuality !== 'complete' || p.costPerSF === null || !bounds) {
      return p.isOutlier ? p : p
    }
    const isOutlier = p.costPerSF < bounds.lowerBound || p.costPerSF > bounds.upperBound
    if (!isOutlier) {
      return p.isOutlier ? { ...p, isOutlier: false, outlierReason: null } : p
    }
    const direction = p.costPerSF > bounds.upperBound ? 'high' : 'low'
    return {
      ...p,
      isOutlier: true,
      includeInModel: false,
      outlierReason: `Cost/SF ($${p.costPerSF.toFixed(3)}) is an extreme ${direction} outlier vs. the IQR range ($${bounds.lowerBound.toFixed(3)}–$${bounds.upperBound.toFixed(3)}).`,
    }
  })
}

export function getSizeGroupForSqft(sqft: number, groups: SizeGroup[]): SizeGroup | null {
  return groups.find((g) => sqft >= g.min && (g.max === null || sqft <= g.max)) ?? null
}

/** Size groups ordered by proximity to the target square footage (same group first, then nearest) */
export function nearestSizeGroups(sqft: number, groups: SizeGroup[]): SizeGroup[] {
  const distance = (g: SizeGroup) => {
    if (sqft >= g.min && (g.max === null || sqft <= g.max)) return 0
    if (sqft < g.min) return g.min - sqft
    return sqft - (g.max ?? sqft)
  }
  return [...groups].sort((a, b) => distance(a) - distance(b))
}

export interface GroupStats {
  group: SizeGroup
  count: number
  medianCostPerSF: number | null
  trimmedMeanCostPerSF: number | null
  medianBudget: number | null
}

export function computeGroupStats(projects: Project[], group: SizeGroup): GroupStats {
  const inGroup = projects.filter(
    (p) =>
      p.dataQuality === 'complete' &&
      p.includeInModel &&
      p.squareFootage !== null &&
      p.squareFootage >= group.min &&
      (group.max === null || p.squareFootage <= group.max),
  )
  const costsPerSF = inGroup.map((p) => p.costPerSF).filter((v): v is number => v !== null)
  const budgets = inGroup.map((p) => p.budget).filter((v): v is number => v !== null)

  return {
    group,
    count: inGroup.length,
    medianCostPerSF: median(costsPerSF),
    trimmedMeanCostPerSF: trimmedMean(costsPerSF, 0.1),
    medianBudget: median(budgets),
  }
}

/** Projects eligible for the estimating model: complete data + not excluded by the user */
export function getModelablePool(projects: Project[]): Project[] {
  return projects.filter((p) => p.dataQuality === 'complete' && p.includeInModel)
}
