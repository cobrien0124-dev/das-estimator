// ---------------------------------------------------------------------------
// Single wiring point for persistence. Every page/hook imports `db` from
// here rather than reaching into a specific repository implementation — to
// move from local storage to Supabase later, swap these three instances for
// Supabase-backed implementations of the same interfaces and nothing else
// in the app needs to change.
// ---------------------------------------------------------------------------

import { LocalStorageEstimatesRepository } from './estimatesRepository'
import { LocalStorageHoursEstimatesRepository } from './hoursEstimatesRepository'
import { LocalStorageProjectsRepository } from './projectsRepository'
import { LocalStorageSettingsRepository } from './settingsRepository'

export const db = {
  projects: new LocalStorageProjectsRepository(),
  estimates: new LocalStorageEstimatesRepository(),
  hoursEstimates: new LocalStorageHoursEstimatesRepository(),
  settings: new LocalStorageSettingsRepository(),
}

export type { EstimatesRepository } from './estimatesRepository'
export type { HoursEstimatesRepository } from './hoursEstimatesRepository'
export type { ProjectsRepository } from './projectsRepository'
export type { SettingsRepository } from './settingsRepository'
