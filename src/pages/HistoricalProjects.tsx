import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowUp, Pencil, Search, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { EditProjectDialog } from '@/components/historical/EditProjectDialog'
import { useProjects } from '@/hooks/useProjects'
import type { Project } from '@/types'
import { formatCostPerSF, formatCurrency, formatPercent, formatSF } from '@/lib/format'
import { cn } from '@/lib/utils'

type SortKey = 'projectName' | 'squareFootage' | 'budget' | 'costPerSF'
type OutlierFilter = 'all' | 'outliers' | 'clean'

export function HistoricalProjects() {
  const { projects, loading, updateProject, removeProject } = useProjects()

  const [search, setSearch] = useState('')
  const [systemFilter, setSystemFilter] = useState('all')
  const [outlierFilter, setOutlierFilter] = useState<OutlierFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('squareFootage')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [editTarget, setEditTarget] = useState<Project | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const systemTypes = useMemo(() => Array.from(new Set(projects.map((p) => p.systemType))).sort(), [projects])

  const filtered = useMemo(() => {
    let list = projects
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => p.projectName.toLowerCase().includes(q) || (p.projectNumber ?? '').toLowerCase().includes(q))
    }
    if (systemFilter !== 'all') list = list.filter((p) => p.systemType === systemFilter)
    if (outlierFilter === 'outliers') list = list.filter((p) => p.isOutlier)
    if (outlierFilter === 'clean') list = list.filter((p) => !p.isOutlier)

    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      // nulls always sort to the bottom, regardless of sort direction
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * dir
      return ((av as number) - (bv as number)) * dir
    })
    return sorted
  }, [projects, search, systemFilter, outlierFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  async function toggleOutlier(p: Project) {
    if (p.isOutlier) {
      await updateProject(p.id, { isOutlier: false, outlierReason: null })
    } else {
      await updateProject(p.id, { isOutlier: true, includeInModel: false, outlierReason: 'Manual flag by user.' })
    }
  }

  async function toggleInclude(p: Project) {
    await updateProject(p.id, { includeInModel: !p.includeInModel })
  }

  function SortHeader({ label, sortableKey }: { label: string; sortableKey: SortKey }) {
    const active = sortKey === sortableKey
    return (
      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(sortableKey)}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </span>
      </TableHead>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Historical Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          {projects.length} projects · {projects.filter((p) => p.includeInModel && p.dataQuality === 'complete').length} used in the estimating model
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input className="pl-8" placeholder="Search name or number…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select className="w-48" value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
            <option value="all">All System Types</option>
            {systemTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select className="w-44" value={outlierFilter} onChange={(e) => setOutlierFilter(e.target.value as OutlierFilter)}>
            <option value="all">All Projects</option>
            <option value="outliers">Outliers Only</option>
            <option value="clean">Non-Outliers</option>
          </Select>
          <div className="ml-auto text-xs text-slate-400">{filtered.length} shown</div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Project Name" sortableKey="projectName" />
              <TableHead>Number</TableHead>
              <SortHeader label="Sq. Footage" sortableKey="squareFootage" />
              <TableHead>Floors</TableHead>
              <TableHead>Buildings</TableHead>
              <TableHead>System Type</TableHead>
              <TableHead>Building Type</TableHead>
              <TableHead>High-Rise</TableHead>
              <SortHeader label="Budget" sortableKey="budget" />
              <TableHead>Actual Budget</TableHead>
              <SortHeader label="Cost/SF" sortableKey="costPerSF" />
              <TableHead>Outlier Status</TableHead>
              <TableHead>Est. Accuracy</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={14} className="py-10 text-center text-slate-400">
                  No projects match the current filters.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => {
              const accuracy =
                p.actualBudget && p.budget ? 1 - Math.abs(p.actualBudget - p.budget) / p.actualBudget : null
              return (
                <TableRow key={p.id} className={cn(!p.includeInModel && 'bg-slate-50/60 opacity-70')}>
                  <TableCell className="max-w-[220px] truncate font-medium text-slate-900">
                    <Link to={`/projects/${p.id}`} className="hover:text-brand-600">
                      {p.projectName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{p.projectNumber ?? '—'}</TableCell>
                  <TableCell>{formatSF(p.squareFootage)}</TableCell>
                  <TableCell>{p.floors ?? '—'}</TableCell>
                  <TableCell>{p.buildings ?? '—'}</TableCell>
                  <TableCell className="text-xs">{p.systemType}</TableCell>
                  <TableCell className="text-xs">{p.buildingType}</TableCell>
                  <TableCell className="text-xs">{p.isHighRise === null ? '—' : p.isHighRise ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{formatCurrency(p.budget)}</TableCell>
                  <TableCell>{formatCurrency(p.actualBudget)}</TableCell>
                  <TableCell>{formatCostPerSF(p.costPerSF)}</TableCell>
                  <TableCell>
                    {p.isOutlier ? (
                      <Badge variant="danger" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Outlier
                      </Badge>
                    ) : p.dataQuality !== 'complete' ? (
                      <Badge variant="outline">Incomplete</Badge>
                    ) : !p.includeInModel ? (
                      <Badge variant="outline">Excluded</Badge>
                    ) : (
                      <Badge variant="success">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell>{accuracy !== null ? formatPercent(accuracy * 100) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditTarget(p)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleOutlier(p)} title={p.isOutlier ? 'Clear outlier flag' : 'Flag as outlier'}>
                        <AlertTriangle className={cn('h-3.5 w-3.5', p.isOutlier && 'text-red-500')} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleInclude(p)} title={p.includeInModel ? 'Exclude from model' : 'Include in model'}>
                        {p.includeInModel ? 'On' : 'Off'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(p)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <EditProjectDialog
        project={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSave={async (patch) => {
          if (editTarget) await updateProject(editTarget.id, patch)
        }}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              This will permanently remove "{deleteTarget?.projectName}" from the historical dataset. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteTarget) await removeProject(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
