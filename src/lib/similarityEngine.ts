// ---------------------------------------------------------------------------
// Similarity engine — scores every historical project against a new estimate
// input across a configurable set of weighted factors (Estimating Settings ->
// Similarity Weights) and returns the most similar projects.
//
// Each factor contributes between 0 and its configured weight. Missing data
// on either side scores 0 for that factor rather than guessing — this keeps
// the score honest and is also what pulls down the confidence score later.
// ---------------------------------------------------------------------------

import type { EstimateInput, Project, SimilarProject, SimilarityWeights } from '@/types'
import { getModelablePool } from './historicalAnalysis'

const COMPLEXITY_LEVEL_ORDER: Record<string, number> = { Low: 0, Standard: 1, High: 2 }
const DESIGN_LEVEL_ORDER: Record<string, number> = { Simple: 0, Standard: 1, Complex: 2, 'Highly Complex': 3 }

/** Ordinal similarity: exact match = 1, each step apart loses proportionally, unknowns score 0 */
function ordinalSimilarity(a: string, b: string, order: Record<string, number>): number {
  if (a === 'Unknown' || b === 'Unknown') return 0
  const ai = order[a]
  const bi = order[b]
  if (ai === undefined || bi === undefined) return 0
  const maxDistance = Math.max(...Object.values(order)) - Math.min(...Object.values(order))
  if (maxDistance === 0) return 1
  return 1 - Math.abs(ai - bi) / maxDistance
}

/** Relative-difference similarity for continuous quantities (square footage, floors) */
function magnitudeSimilarity(a: number, b: number): number {
  const larger = Math.max(a, b)
  if (larger === 0) return 1
  const diff = Math.abs(a - b)
  return Math.max(0, 1 - diff / larger)
}

export interface SimilarityBreakdownItem {
  factor: string
  points: number
  maxPoints: number
}

export function computeSimilarity(
  input: EstimateInput,
  project: Project,
  weights: SimilarityWeights,
): { score: number; breakdown: SimilarityBreakdownItem[] } {
  const breakdown: SimilarityBreakdownItem[] = []

  // Square footage
  {
    let ratio = 0
    if (input.squareFootage !== null && project.squareFootage !== null) {
      ratio = magnitudeSimilarity(input.squareFootage, project.squareFootage)
    }
    breakdown.push({ factor: 'Square Footage', points: ratio * weights.squareFootage, maxPoints: weights.squareFootage })
  }

  // System type
  {
    let ratio = 0
    if (input.systemType === project.systemType) ratio = 1
    else if (input.systemType === 'Both' || project.systemType === 'Both') ratio = 0.5
    breakdown.push({ factor: 'System Type', points: ratio * weights.systemType, maxPoints: weights.systemType })
  }

  // Building type
  {
    const ratio = input.buildingType !== 'Unknown' && input.buildingType === project.buildingType ? 1 : 0
    breakdown.push({ factor: 'Building Type', points: ratio * weights.buildingType, maxPoints: weights.buildingType })
  }

  // Floors
  {
    let ratio = 0
    if (input.floors !== null && project.floors !== null) {
      ratio = magnitudeSimilarity(input.floors, project.floors)
    }
    breakdown.push({ factor: 'Number of Floors', points: ratio * weights.floors, maxPoints: weights.floors })
  }

  // High-rise
  {
    const ratio = input.isHighRise !== null && input.isHighRise === project.isHighRise ? 1 : 0
    breakdown.push({ factor: 'High-Rise', points: ratio * weights.highRise, maxPoints: weights.highRise })
  }

  // BIM required
  {
    const ratio = input.bimRequired !== null && input.bimRequired === project.bimRequired ? 1 : 0
    breakdown.push({ factor: 'BIM Required', points: ratio * weights.bimRequired, maxPoints: weights.bimRequired })
  }

  // AHJ complexity
  {
    const ratio = ordinalSimilarity(input.ahjComplexity, project.ahjComplexity, COMPLEXITY_LEVEL_ORDER)
    breakdown.push({ factor: 'AHJ Complexity', points: ratio * weights.ahjComplexity, maxPoints: weights.ahjComplexity })
  }

  // Design complexity
  {
    const ratio = ordinalSimilarity(input.designComplexity, project.designComplexity, DESIGN_LEVEL_ORDER)
    breakdown.push({ factor: 'Design Complexity', points: ratio * weights.designComplexity, maxPoints: weights.designComplexity })
  }

  const score = breakdown.reduce((sum, b) => sum + b.points, 0)
  return { score, breakdown }
}

export function findSimilarProjects(
  input: EstimateInput,
  allProjects: Project[],
  weights: SimilarityWeights,
  opts: { minScore: number; maxResults: number },
): SimilarProject[] {
  const pool = getModelablePool(allProjects)

  const scored = pool.map((project) => {
    const { score, breakdown } = computeSimilarity(input, project, weights)
    return { project, similarityScore: score, breakdown }
  })

  return scored
    .filter((s) => s.similarityScore >= opts.minScore)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, opts.maxResults)
}
