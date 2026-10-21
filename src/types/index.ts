// ---------------------------------------------------------------------------
// Domain enums
// ---------------------------------------------------------------------------

export type SystemType = 'Public Safety DAS' | 'Cellular DAS' | 'Both' | 'Unknown'

export type BuildingType =
  | 'Residential'
  | 'Hotel'
  | 'Hospital'
  | 'Commercial'
  | 'Mixed Use'
  | 'Garage'
  | 'Education'
  | 'Other'
  | 'Unknown'

export type ComplexityLevel = 'Low' | 'Standard' | 'High' | 'Unknown'

export type DesignComplexityLevel = 'Simple' | 'Standard' | 'Complex' | 'Highly Complex' | 'Unknown'

/** true / false / null(unknown) — historical records frequently lack this field */
export type TriState = boolean | null

export type DataQuality = 'complete' | 'partial' | 'incomplete'

// ---------------------------------------------------------------------------
// Historical project record
// ---------------------------------------------------------------------------

export interface Project {
  id: string
  projectName: string
  projectNumber: string | null
  location: string | null

  squareFootage: number | null
  floors: number | null
  buildings: number | null
  constructionType: string | null
  buildingType: BuildingType
  systemType: SystemType

  isHighRise: TriState
  isNewConstruction: TriState
  ibwaveRequired: TriState
  bimRequired: TriState
  permitRequired: TriState

  ahjComplexity: ComplexityLevel
  designComplexity: DesignComplexityLevel

  /** Primary budget figure used for modeling (maps to "Current Agreement" in the source data) */
  budget: number | null
  /** Final actual budget, when known — used for estimate-vs-actual accuracy analysis */
  actualBudget: number | null

  /** derived: budget / squareFootage, computed on load — null when either input is missing */
  costPerSF: number | null

  status: string | null
  psnDate: string | null

  isOutlier: boolean
  outlierReason: string | null
  /** manual override — an outlier can be flagged but still forced into the model, or vice versa */
  includeInModel: boolean

  notes: string | null

  /** 'complete' = has both squareFootage and budget; 'partial' = has one; 'incomplete' = has neither */
  dataQuality: DataQuality

  sourceRow: number | null
  importBatchId: string | null

  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// New estimate input (the form)
// ---------------------------------------------------------------------------

export interface EstimateInput {
  // Section A — basic project information
  projectName: string
  projectNumber: string
  location: string
  squareFootage: number | null
  floors: number | null
  buildings: number | null
  constructionType: string
  buildingType: BuildingType

  // Section B — DAS system information
  systemType: SystemType
  isHighRise: TriState
  isNewConstruction: TriState
  ibwaveRequired: TriState
  bimRequired: TriState
  permitRequired: TriState

  // Section C — project complexity
  ahjComplexity: ComplexityLevel
  designComplexity: DesignComplexityLevel
  coordinationComplexity: ComplexityLevel
  specialConditions: string

  customBudgetAdjustment: number | null
  customPercentAdjustment: number | null
}

// ---------------------------------------------------------------------------
// Estimating settings (configurable model)
// ---------------------------------------------------------------------------

export interface SizeGroup {
  id: string
  label: string
  min: number
  max: number | null // null = no upper bound
}

export interface MethodWeights {
  similarProjects: number
  regression: number
  sizeGroup: number
  costPerSF: number
}

export interface SimilarityWeights {
  squareFootage: number
  systemType: number
  buildingType: number
  floors: number
  highRise: number
  bimRequired: number
  ahjComplexity: number
  designComplexity: number
}

export type AdjustmentType = 'fixed' | 'percent'

export interface Adjustment {
  type: AdjustmentType
  value: number // dollars if fixed, percentage points (e.g. 10 = 10%) if percent
}

export interface ComplexityFactors {
  systemType: {
    publicSafety: Adjustment
    cellular: Adjustment
    both: Adjustment
  }
  highRise: Adjustment
  bimRequired: Adjustment
  ibwaveRequired: Adjustment
  permitSet: Adjustment
  ahjComplexity: {
    Low: Adjustment
    Standard: Adjustment
    High: Adjustment
  }
  designComplexity: {
    Simple: Adjustment
    Standard: Adjustment
    Complex: Adjustment
    'Highly Complex': Adjustment
  }
  coordinationComplexity: {
    Low: Adjustment
    Standard: Adjustment
    High: Adjustment
  }
}

export interface HourlyRole {
  id: string
  name: string
  defaultRate: number
}

export interface EstimatingSettings {
  id: string
  sizeGroups: SizeGroup[]
  methodWeights: MethodWeights
  similarityWeights: SimilarityWeights
  complexityFactors: ComplexityFactors
  defaultLowMultiplier: number
  defaultHighMultiplier: number
  minHistoricalProjects: number
  outlierIqrMultiplier: number
  regressionEnabled: boolean
  minSimilarityScore: number
  maxSimilarProjects: number
  /** Configurable roles + default $/hr rates used by the Hours-Based Estimate */
  hourlyRoles: HourlyRole[]
  hoursOverheadPercent: number
  hoursContingencyLowPercent: number
  hoursContingencyHighPercent: number
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Estimate calculation results
// ---------------------------------------------------------------------------

export type EstimationMethod = 'similarProjects' | 'regression' | 'sizeGroup' | 'costPerSF'

export interface MethodResult {
  method: EstimationMethod
  label: string
  value: number | null
  rawWeight: number
  normalizedWeight: number
  available: boolean
  unavailableReason: string | null
  sampleSize: number
}

export interface SimilarProject {
  project: Project
  similarityScore: number // 0-100
  breakdown: { factor: string; points: number; maxPoints: number }[]
}

export interface ConfidenceReason {
  label: string
  positive: boolean
  detail: string
}

export interface EstimateResult {
  lowEstimate: number
  likelyEstimate: number
  highEstimate: number
  confidenceScore: number

  historicalBase: number
  squareFootageAdjustment: number
  systemAdjustment: number
  complexityAdjustment: number
  bimAdjustment: number
  ahjAdjustment: number
  customAdjustment: number

  similarProjects: SimilarProject[]
  explanation: string[]

  methodResults: MethodResult[]
  confidenceReasons: ConfidenceReason[]
  fallbacksUsed: string[]
  usedFallbackRange: boolean
}

/** A fully saved, immutable estimate — preserves everything needed to reproduce the number later */
export interface Estimate {
  id: string
  projectName: string
  input: EstimateInput
  result: EstimateResult
  settingsSnapshot: EstimatingSettings
  historicalProjectsSnapshot: Project[]
  createdAt: string
  /** filled in later if/when the project is actually built, for accuracy tracking */
  actualBudget: number | null
}

// ---------------------------------------------------------------------------
// Data import
// ---------------------------------------------------------------------------

export type ImportTargetField =
  | keyof Pick<
      Project,
      | 'projectName'
      | 'projectNumber'
      | 'squareFootage'
      | 'budget'
      | 'actualBudget'
      | 'floors'
      | 'buildings'
      | 'systemType'
      | 'buildingType'
      | 'isHighRise'
      | 'bimRequired'
      | 'ibwaveRequired'
      | 'permitRequired'
      | 'ahjComplexity'
      | 'designComplexity'
      | 'notes'
    >
  | 'ignore'

export interface ColumnMapping {
  sourceColumn: string
  targetField: ImportTargetField
}

export interface ImportValidationIssue {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ImportPreviewRow {
  rowIndex: number
  raw: Record<string, unknown>
  mapped: Partial<Project>
  issues: ImportValidationIssue[]
  isDuplicate: boolean
}

// ---------------------------------------------------------------------------
// Hours-Based Estimate — a standalone estimating method, separate from the
// historical-data model above. Budget is derived directly from estimated
// labor hours per role rather than from comparable project statistics, so it
// doesn't need any historical data and is shown side-by-side with the
// historical estimate for comparison rather than blended into it.
// ---------------------------------------------------------------------------

export interface RoleHoursEntry {
  roleId: string
  roleName: string
  hours: number
  rate: number
}

export interface HoursEstimateInput {
  projectName: string
  projectNumber: string
  roleHours: RoleHoursEntry[]
  overheadPercent: number
  contingencyLowPercent: number
  contingencyHighPercent: number
  customBudgetAdjustment: number | null
  customPercentAdjustment: number | null
  notes: string
}

export interface RoleCostLine {
  roleId: string
  roleName: string
  hours: number
  rate: number
  cost: number
}

export interface HoursEstimateResult {
  roleBreakdown: RoleCostLine[]
  totalHours: number
  laborSubtotal: number
  overheadAmount: number
  customAdjustment: number
  lowEstimate: number
  likelyEstimate: number
  highEstimate: number
  blendedRate: number
  explanation: string[]
}

/** A fully saved, immutable hours-based estimate — snapshots the rates used so later rate changes don't alter it */
export interface HoursEstimate {
  id: string
  projectName: string
  input: HoursEstimateInput
  result: HoursEstimateResult
  createdAt: string
}
