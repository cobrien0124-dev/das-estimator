import type { ComplexityFactors, EstimatingSettings, HourlyRole, SizeGroup } from '@/types'

export const DEFAULT_SIZE_GROUPS: SizeGroup[] = [
  { id: 'sg-1', label: '0 – 250,000 SF', min: 0, max: 250_000 },
  { id: 'sg-2', label: '250,001 – 500,000 SF', min: 250_001, max: 500_000 },
  { id: 'sg-3', label: '500,001 – 750,000 SF', min: 500_001, max: 750_000 },
  { id: 'sg-4', label: '750,001 – 1,000,000 SF', min: 750_001, max: 1_000_000 },
  { id: 'sg-5', label: '1,000,001+ SF', min: 1_000_001, max: null },
]

export const DEFAULT_COMPLEXITY_FACTORS: ComplexityFactors = {
  systemType: {
    publicSafety: { type: 'fixed', value: 0 }, // baseline
    cellular: { type: 'percent', value: 5 },
    both: { type: 'percent', value: 15 },
  },
  highRise: { type: 'percent', value: 10 },
  bimRequired: { type: 'fixed', value: 1500 },
  ibwaveRequired: { type: 'fixed', value: 1200 },
  permitSet: { type: 'fixed', value: 1000 },
  ahjComplexity: {
    Low: { type: 'percent', value: -5 },
    Standard: { type: 'percent', value: 0 },
    High: { type: 'percent', value: 12 },
  },
  designComplexity: {
    Simple: { type: 'percent', value: -10 },
    Standard: { type: 'percent', value: 0 },
    Complex: { type: 'percent', value: 15 },
    'Highly Complex': { type: 'percent', value: 30 },
  },
  coordinationComplexity: {
    Low: { type: 'percent', value: -5 },
    Standard: { type: 'percent', value: 0 },
    High: { type: 'percent', value: 10 },
  },
}

export const DEFAULT_HOURLY_ROLES: HourlyRole[] = [
  { id: 'role-design', name: 'Design Engineer', defaultRate: 135 },
  { id: 'role-coordination', name: 'Coordination Engineer', defaultRate: 125 },
  { id: 'role-pm', name: 'Project Manager', defaultRate: 150 },
  { id: 'role-drafter', name: 'Drafter / CAD', defaultRate: 95 },
  { id: 'role-qc', name: 'QC / QA', defaultRate: 140 },
]

export const DEFAULT_SETTINGS: EstimatingSettings = {
  id: 'default',
  sizeGroups: DEFAULT_SIZE_GROUPS,
  methodWeights: {
    similarProjects: 40,
    regression: 25,
    sizeGroup: 20,
    costPerSF: 15,
  },
  similarityWeights: {
    squareFootage: 40,
    systemType: 20,
    buildingType: 10,
    floors: 10,
    highRise: 5,
    bimRequired: 5,
    ahjComplexity: 5,
    designComplexity: 5,
  },
  complexityFactors: DEFAULT_COMPLEXITY_FACTORS,
  defaultLowMultiplier: 0.85,
  defaultHighMultiplier: 1.15,
  minHistoricalProjects: 3,
  outlierIqrMultiplier: 1.5,
  regressionEnabled: true,
  minSimilarityScore: 30,
  maxSimilarProjects: 10,
  hourlyRoles: DEFAULT_HOURLY_ROLES,
  hoursOverheadPercent: 15,
  hoursContingencyLowPercent: 10,
  hoursContingencyHighPercent: 20,
  updatedAt: new Date().toISOString(),
}
