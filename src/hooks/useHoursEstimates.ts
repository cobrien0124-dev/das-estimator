import { useCallback, useEffect, useState } from 'react'
import type { HoursEstimate } from '@/types'
import { db } from '@/services'

export function useHoursEstimates() {
  const [hoursEstimates, setHoursEstimates] = useState<HoursEstimate[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const all = await db.hoursEstimates.list()
    setHoursEstimates(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveHoursEstimate = useCallback(
    async (estimate: Omit<HoursEstimate, 'id' | 'createdAt'>) => {
      const created = await db.hoursEstimates.create(estimate)
      await refresh()
      return created
    },
    [refresh],
  )

  const removeHoursEstimate = useCallback(
    async (id: string) => {
      await db.hoursEstimates.remove(id)
      await refresh()
    },
    [refresh],
  )

  return { hoursEstimates, loading, refresh, saveHoursEstimate, removeHoursEstimate }
}
