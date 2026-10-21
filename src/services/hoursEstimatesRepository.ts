import type { HoursEstimate } from '@/types'
import { generateId, readKey, writeKey } from './storage'

const KEY = 'hoursEstimates'

export interface HoursEstimatesRepository {
  list(): Promise<HoursEstimate[]>
  get(id: string): Promise<HoursEstimate | null>
  create(estimate: Omit<HoursEstimate, 'id' | 'createdAt'>): Promise<HoursEstimate>
  remove(id: string): Promise<void>
}

function loadAll(): HoursEstimate[] {
  return readKey<HoursEstimate[]>(KEY, [])
}

function saveAll(estimates: HoursEstimate[]): void {
  writeKey(KEY, estimates)
}

export class LocalStorageHoursEstimatesRepository implements HoursEstimatesRepository {
  async list(): Promise<HoursEstimate[]> {
    return [...loadAll()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async get(id: string): Promise<HoursEstimate | null> {
    return loadAll().find((e) => e.id === id) ?? null
  }

  async create(estimate: Omit<HoursEstimate, 'id' | 'createdAt'>): Promise<HoursEstimate> {
    const all = loadAll()
    const created: HoursEstimate = { ...estimate, id: generateId('hest'), createdAt: new Date().toISOString() }
    saveAll([...all, created])
    return created
  }

  async remove(id: string): Promise<void> {
    saveAll(loadAll().filter((e) => e.id !== id))
  }
}
