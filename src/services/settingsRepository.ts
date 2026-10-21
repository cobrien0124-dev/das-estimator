import type { EstimatingSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import { hasKey, readKey, writeKey } from './storage'

const KEY = 'settings'

export interface SettingsRepository {
  get(): Promise<EstimatingSettings>
  update(patch: Partial<EstimatingSettings>): Promise<EstimatingSettings>
  reset(): Promise<EstimatingSettings>
}

export class LocalStorageSettingsRepository implements SettingsRepository {
  async get(): Promise<EstimatingSettings> {
    if (!hasKey(KEY)) {
      writeKey(KEY, DEFAULT_SETTINGS)
      return DEFAULT_SETTINGS
    }
    // Merge over DEFAULT_SETTINGS so fields added in a later app version (e.g. hourlyRoles)
    // are backfilled for settings saved by an older version, instead of coming back undefined.
    const stored = readKey<Partial<EstimatingSettings>>(KEY, DEFAULT_SETTINGS)
    return { ...DEFAULT_SETTINGS, ...stored }
  }

  async update(patch: Partial<EstimatingSettings>): Promise<EstimatingSettings> {
    const current = await this.get()
    const updated: EstimatingSettings = { ...current, ...patch, updatedAt: new Date().toISOString() }
    writeKey(KEY, updated)
    return updated
  }

  async reset(): Promise<EstimatingSettings> {
    writeKey(KEY, DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }
}
