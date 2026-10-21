import type { Project } from '@/types'
import { computeCostPerSF, detectOutliers } from '@/lib/historicalAnalysis'
import { SEED_PROJECTS } from '@/data/seedProjects'
import { generateId, hasKey, readKey, writeKey } from './storage'

const KEY = 'projects'

export interface ProjectsRepository {
  list(): Promise<Project[]>
  get(id: string): Promise<Project | null>
  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'costPerSF' | 'dataQuality'>): Promise<Project>
  update(id: string, patch: Partial<Project>): Promise<Project>
  remove(id: string): Promise<void>
  bulkUpsert(projects: Partial<Project>[], importBatchId: string): Promise<Project[]>
  recalculateOutliers(iqrMultiplier: number): Promise<Project[]>
  resetToSeed(): Promise<Project[]>
}

function deriveDataQuality(p: Pick<Project, 'squareFootage' | 'budget'>): Project['dataQuality'] {
  if (p.squareFootage !== null && p.budget !== null) return 'complete'
  if (p.squareFootage !== null || p.budget !== null) return 'partial'
  return 'incomplete'
}

function withDerived(p: Project): Project {
  return { ...p, costPerSF: computeCostPerSF(p), dataQuality: deriveDataQuality(p) }
}

function seedInitialData(): Project[] {
  const seeded = SEED_PROJECTS.map(withDerived)
  const withOutliers = detectOutliers(seeded, 1.5)
  writeKey(KEY, withOutliers)
  return withOutliers
}

function loadAll(): Project[] {
  if (!hasKey(KEY)) return seedInitialData()
  return readKey<Project[]>(KEY, [])
}

function saveAll(projects: Project[]): void {
  writeKey(KEY, projects)
}

export class LocalStorageProjectsRepository implements ProjectsRepository {
  async list(): Promise<Project[]> {
    return loadAll()
  }

  async get(id: string): Promise<Project | null> {
    return loadAll().find((p) => p.id === id) ?? null
  }

  async create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'costPerSF' | 'dataQuality'>): Promise<Project> {
    const all = loadAll()
    const now = new Date().toISOString()
    const created = withDerived({ ...project, id: generateId('proj'), createdAt: now, updatedAt: now } as Project)
    saveAll([...all, created])
    return created
  }

  async update(id: string, patch: Partial<Project>): Promise<Project> {
    const all = loadAll()
    const idx = all.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Project ${id} not found`)
    const updated = withDerived({ ...all[idx], ...patch, updatedAt: new Date().toISOString() })
    const next = [...all]
    next[idx] = updated
    saveAll(next)
    return updated
  }

  async remove(id: string): Promise<void> {
    saveAll(loadAll().filter((p) => p.id !== id))
  }

  async bulkUpsert(projects: Partial<Project>[], importBatchId: string): Promise<Project[]> {
    const all = loadAll()
    const now = new Date().toISOString()
    const created = projects.map((p) =>
      withDerived({
        id: generateId('proj'),
        projectName: '',
        projectNumber: null,
        location: null,
        squareFootage: null,
        floors: null,
        buildings: null,
        constructionType: null,
        buildingType: 'Unknown',
        systemType: 'Unknown',
        isHighRise: null,
        isNewConstruction: null,
        ibwaveRequired: null,
        bimRequired: null,
        permitRequired: null,
        ahjComplexity: 'Unknown',
        designComplexity: 'Unknown',
        budget: null,
        actualBudget: null,
        costPerSF: null,
        status: null,
        psnDate: null,
        isOutlier: false,
        outlierReason: null,
        includeInModel: true,
        notes: null,
        dataQuality: 'incomplete',
        sourceRow: null,
        importBatchId,
        createdAt: now,
        updatedAt: now,
        ...p,
      } as Project),
    )
    saveAll([...all, ...created])
    return created
  }

  async recalculateOutliers(iqrMultiplier: number): Promise<Project[]> {
    const all = loadAll()
    const next = detectOutliers(all, iqrMultiplier)
    saveAll(next)
    return next
  }

  async resetToSeed(): Promise<Project[]> {
    return seedInitialData()
  }
}
