import { useCallback, useEffect, useState } from 'react'
import type { Estimate } from '@/types'
import { db } from '@/services'

export function useEstimates() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const all = await db.estimates.list()
    setEstimates(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveEstimate = useCallback(
    async (estimate: Omit<Estimate, 'id' | 'createdAt'>) => {
      const created = await db.estimates.create(estimate)
      await refresh()
      return created
    },
    [refresh],
  )

  const removeEstimate = useCallback(
    async (id: string) => {
      await db.estimates.remove(id)
      await refresh()
    },
    [refresh],
  )

  return { estimates, loading, refresh, saveEstimate, removeEstimate }
}
