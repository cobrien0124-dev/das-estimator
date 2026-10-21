// ---------------------------------------------------------------------------
// Excel import: parses a workbook client-side, proposes a best-guess column
// mapping (the source data is never assumed to have "clean" headers — see
// guessColumnMapping), and builds a validated preview before anything is
// written to the historical projects store.
// ---------------------------------------------------------------------------

import * as XLSX from 'xlsx'
import type { BuildingType, ColumnMapping, ImportPreviewRow, ImportTargetField, ImportValidationIssue, Project, SystemType } from '@/types'
import { parseNumeric } from './validation'

export interface ParsedSheet {
  sheetName: string
  headers: string[]
  rows: Record<string, unknown>[]
}

export async function parseWorkbookFile(file: File): Promise<ParsedSheet[]> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true })
    const headers = json.length > 0 ? Object.keys(json[0]) : (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[] | undefined) ?? []
    return { sheetName, headers, rows: json }
  })
}

// Keyword heuristics used to propose a mapping — the user can always override any of these.
const FIELD_KEYWORDS: { field: ImportTargetField; keywords: string[] }[] = [
  { field: 'projectName', keywords: ['project name', 'tsd project name', 'primary'] },
  { field: 'projectNumber', keywords: ['project number', 'project #', 'psn'] },
  { field: 'squareFootage', keywords: ['building area', 'square footage', 'sq ft', 'sqft', 'gross area'] },
  { field: 'budget', keywords: ['current agreement', 'budget', 'contract value'] },
  { field: 'actualBudget', keywords: ['actual budget', 'final cost', 'actual cost'] },
  { field: 'floors', keywords: ['floors', 'number of floors', 'stories'] },
  { field: 'buildings', keywords: ['buildings', 'number of buildings'] },
  { field: 'systemType', keywords: ['system type', 'das type'] },
  { field: 'buildingType', keywords: ['building type', 'project type', 'construction type'] },
  { field: 'isHighRise', keywords: ['high-rise', 'high rise'] },
  { field: 'bimRequired', keywords: ['bim required', 'bim'] },
  { field: 'ibwaveRequired', keywords: ['ibwave required', 'ibwave'] },
  { field: 'permitRequired', keywords: ['permit required', 'permit set'] },
  { field: 'ahjComplexity', keywords: ['ahj complexity', 'ahj coordination', 'ahj'] },
  { field: 'designComplexity', keywords: ['design complexity'] },
  { field: 'notes', keywords: ['notes', 'comments'] },
]

export function guessColumnMapping(headers: string[]): ColumnMapping[] {
  // Score every (header, field) candidate first, then assign globally best-match-first —
  // assigning greedily in header order would let an early, weak substring match (e.g.
  // "Original Budget") block a later, exact match (e.g. "Current Agreement") for the
  // same field.
  const candidates: { sourceColumn: string; field: ImportTargetField; score: number }[] = []
  for (const sourceColumn of headers) {
    const normalized = sourceColumn.toLowerCase().trim()
    for (const { field, keywords } of FIELD_KEYWORDS) {
      for (const kw of keywords) {
        if (normalized === kw) {
          candidates.push({ sourceColumn, field, score: 100 })
        } else if (normalized.includes(kw)) {
          candidates.push({ sourceColumn, field, score: 50 })
        }
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score)

  const assignedColumn = new Map<string, ImportTargetField>()
  const usedField = new Set<ImportTargetField>()
  for (const c of candidates) {
    if (assignedColumn.has(c.sourceColumn) || usedField.has(c.field)) continue
    assignedColumn.set(c.sourceColumn, c.field)
    usedField.add(c.field)
  }

  return headers.map((sourceColumn) => ({ sourceColumn, targetField: assignedColumn.get(sourceColumn) ?? 'ignore' }))
}

function normalizeSystemType(value: unknown): SystemType {
  const s = String(value ?? '').toLowerCase()
  if (s.includes('both') || (s.includes('cellular') && s.includes('safety'))) return 'Both'
  if (s.includes('cellular')) return 'Cellular DAS'
  if (s.includes('public safety') || s.includes('errcs')) return 'Public Safety DAS'
  return 'Unknown'
}

function normalizeBuildingType(value: unknown): BuildingType {
  const s = String(value ?? '').toLowerCase()
  const known: BuildingType[] = ['Residential', 'Hotel', 'Hospital', 'Commercial', 'Mixed Use', 'Garage', 'Education', 'Other']
  const match = known.find((k) => s.includes(k.toLowerCase()))
  return match ?? 'Unknown'
}

function normalizeTriState(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'boolean') return value
  const s = String(value).toLowerCase().trim()
  if (['yes', 'y', 'true', '1', 'required'].includes(s)) return true
  if (['no', 'n', 'false', '0', 'not required'].includes(s)) return false
  return null
}

function normalizeComplexity(value: unknown): 'Low' | 'Standard' | 'High' | 'Unknown' {
  const s = String(value ?? '').toLowerCase().trim()
  if (s === 'low') return 'Low'
  if (s === 'high') return 'High'
  if (s === 'standard' || s === 'medium') return 'Standard'
  return 'Unknown'
}

/** Applies the column mapping to one raw row and returns a partial Project plus any validation issues */
export function mapRow(raw: Record<string, unknown>, mapping: ColumnMapping[], rowIndex: number): { mapped: Partial<Project>; issues: ImportValidationIssue[] } {
  const issues: ImportValidationIssue[] = []
  const mapped: Partial<Project> = {}

  for (const { sourceColumn, targetField } of mapping) {
    if (targetField === 'ignore') continue
    const rawValue = raw[sourceColumn]

    switch (targetField) {
      case 'projectName':
        mapped.projectName = rawValue ? String(rawValue).trim() : ''
        break
      case 'projectNumber':
        mapped.projectNumber = rawValue ? String(rawValue).trim() : null
        break
      case 'squareFootage': {
        const n = parseNumeric(rawValue)
        if (rawValue !== null && rawValue !== '' && n === null) {
          issues.push({ row: rowIndex, field: 'squareFootage', message: 'Square Footage must be numeric.', severity: 'warning' })
        }
        mapped.squareFootage = n
        break
      }
      case 'budget': {
        const n = parseNumeric(rawValue)
        if (rawValue !== null && rawValue !== '' && n === null) {
          issues.push({ row: rowIndex, field: 'budget', message: 'Budget must be numeric.', severity: 'warning' })
        }
        mapped.budget = n
        break
      }
      case 'actualBudget':
        mapped.actualBudget = parseNumeric(rawValue)
        break
      case 'floors':
        mapped.floors = parseNumeric(rawValue)
        break
      case 'buildings':
        mapped.buildings = parseNumeric(rawValue)
        break
      case 'systemType':
        mapped.systemType = normalizeSystemType(rawValue)
        break
      case 'buildingType':
        mapped.buildingType = normalizeBuildingType(rawValue)
        break
      case 'isHighRise':
        mapped.isHighRise = normalizeTriState(rawValue)
        break
      case 'bimRequired':
        mapped.bimRequired = normalizeTriState(rawValue)
        break
      case 'ibwaveRequired':
        mapped.ibwaveRequired = normalizeTriState(rawValue)
        break
      case 'permitRequired':
        mapped.permitRequired = normalizeTriState(rawValue)
        break
      case 'ahjComplexity':
        mapped.ahjComplexity = normalizeComplexity(rawValue)
        break
      case 'designComplexity': {
        const s = normalizeComplexity(rawValue)
        mapped.designComplexity = s === 'Standard' || s === 'Unknown' ? s : s === 'Low' ? 'Simple' : 'Complex'
        break
      }
      case 'notes':
        mapped.notes = rawValue ? String(rawValue) : null
        break
    }
  }

  if (!mapped.projectName) {
    issues.push({ row: rowIndex, field: 'projectName', message: 'Project Name is missing.', severity: 'error' })
  }
  if (mapped.squareFootage == null && mapped.budget == null) {
    issues.push({
      row: rowIndex,
      field: 'general',
      message: 'Missing both Square Footage and Budget — will be stored as an incomplete record, not used in the estimating model.',
      severity: 'warning',
    })
  }

  return { mapped, issues }
}

export function buildPreviewRows(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping[],
  existingProjects: Project[],
): ImportPreviewRow[] {
  const existingNames = new Set(existingProjects.map((p) => p.projectName.trim().toLowerCase()))
  const seenInBatch = new Set<string>()

  return rows.map((raw, i) => {
    const { mapped, issues } = mapRow(raw, mapping, i + 1)
    const nameKey = (mapped.projectName ?? '').trim().toLowerCase()
    const isDuplicate = nameKey !== '' && (existingNames.has(nameKey) || seenInBatch.has(nameKey))
    if (nameKey) seenInBatch.add(nameKey)
    return { rowIndex: i + 1, raw, mapped, issues, isDuplicate }
  })
}
