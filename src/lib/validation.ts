export interface FieldError {
  field: string
  message: string
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const cleaned = String(value).replace(/[$,\s]/g, '')
  if (cleaned === '' || cleaned === '#NO MATCH' || cleaned === '#BLOCKED') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function validateEstimateInput(input: {
  projectName: string
  squareFootage: number | null
  floors: number | null
  buildings: number | null
}): FieldError[] {
  const errors: FieldError[] = []
  if (!input.projectName.trim()) errors.push({ field: 'projectName', message: 'Project name is required.' })
  if (input.squareFootage !== null && !isPositiveNumber(input.squareFootage)) {
    errors.push({ field: 'squareFootage', message: 'Square footage must be a positive number.' })
  }
  if (input.floors !== null && !isPositiveNumber(input.floors)) {
    errors.push({ field: 'floors', message: 'Number of floors must be a positive number.' })
  }
  if (input.buildings !== null && !isPositiveNumber(input.buildings)) {
    errors.push({ field: 'buildings', message: 'Number of buildings must be a positive number.' })
  }
  return errors
}
