import { useCallback, useEffect, useState } from 'react'
import type { Project } from '@/types'
import { db } from '@/services'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const all = await db.projects.list()
    setProjects(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const updateProject = useCallback(
    async (id: string, patch: Partial<Project>) => {
      await db.projects.update(id, patch)
      await refresh()
    },
    [refresh],
  )

  const removeProject = useCallback(
    async (id: string) => {
      await db.projects.remove(id)
      await refresh()
    },
    [refresh],
  )

  const createProject = useCallback(
    async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'costPerSF' | 'dataQuality'>) => {
      const created = await db.projects.create(project)
      await refresh()
      return created
    },
    [refresh],
  )

  const recalculateOutliers = useCallback(
    async (iqrMultiplier: number) => {
      await db.projects.recalculateOutliers(iqrMultiplier)
      await refresh()
    },
    [refresh],
  )

  return { projects, loading, refresh, updateProject, removeProject, createProject, recalculateOutliers }
}
