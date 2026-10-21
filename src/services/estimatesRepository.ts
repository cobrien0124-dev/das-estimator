import type { Estimate } from '@/types'
import { generateId, readKey, writeKey } from './storage'

const KEY = 'estimates'

export interface EstimatesRepository {
  list(): Promise<Estimate[]>
  get(id: string): Promise<Estimate | null>
  create(estimate: Omit<Estimate, 'id' | 'createdAt'>): Promise<Estimate>
  update(id: string, patch: Partial<Estimate>): Promise<Estimate>
  remove(id: string): Promise<void>
}

function loadAll(): Estimate[] {
  return readKey<Estimate[]>(KEY, [])
}

function saveAll(estimates: Estimate[]): void {
  writeKey(KEY, estimates)
}

export class LocalStorageEstimatesRepository implements EstimatesRepository {
  async list(): Promise<Estimate[]> {
    return [...loadAll()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async get(id: string): Promise<Estimate | null> {
    return loadAll().find((e) => e.id === id) ?? null
  }

  async create(estimate: Omit<Estimate, 'id' | 'createdAt'>): Promise<Estimate> {
    const all = loadAll()
    const created: Estimate = { ...estimate, id: generateId('est'), createdAt: new Date().toISOString() }
    saveAll([...all, created])
    return created
  }

  async update(id: string, patch: Partial<Estimate>): Promise<Estimate> {
    const all = loadAll()
    const idx = all.findIndex((e) => e.id === id)
    if (idx === -1) throw new Error(`Estimate ${id} not found`)
    const updated = { ...all[idx], ...patch }
    const next = [...all]
    next[idx] = updated
    saveAll(next)
    return updated
  }

  async remove(id: string): Promise<void> {
    saveAll(loadAll().filter((e) => e.id !== id))
  }
}
