import { useCallback, useEffect, useState } from 'react'
import type { EstimatingSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import { db } from '@/services'

export function useSettings() {
  const [settings, setSettings] = useState<EstimatingSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const s = await db.settings.get()
    setSettings(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateSettings = useCallback(async (patch: Partial<EstimatingSettings>) => {
    const updated = await db.settings.update(patch)
    setSettings(updated)
    return updated
  }, [])

  const resetSettings = useCallback(async () => {
    const reset = await db.settings.reset()
    setSettings(reset)
    return reset
  }, [])

  return { settings, loading, refresh, updateSettings, resetSettings }
}
