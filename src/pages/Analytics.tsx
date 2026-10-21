import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useProjects } from '@/hooks/useProjects'
import { useEstimates } from '@/hooks/useEstimates'
import { useSettings } from '@/hooks/useSettings'
import { computeGroupStats } from '@/lib/historicalAnalysis'
import { formatCostPerSF, formatCurrency, formatSF } from '@/lib/format'

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </CardHeader>
      <CardContent className="h-72 pt-0">{children}</CardContent>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-400">{message}</div>
}

export function Analytics() {
  const { projects } = useProjects()
  const { estimates } = useEstimates()
  const { settings } = useSettings()

  const [systemFilter, setSystemFilter] = useState('all')
  const [buildingFilter, setBuildingFilter] = useState('all')
  const [sizeGroupFilter, setSizeGroupFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const systemTypes = useMemo(() => Array.from(new Set(projects.map((p) => p.systemType))).sort(), [projects])
  const buildingTypes = useMemo(() => Array.from(new Set(projects.map((p) => p.buildingType))).sort(), [projects])

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      if (systemFilter !== 'all' && p.systemType !== systemFilter) return false
      if (buildingFilter !== 'all' && p.buildingType !== buildingFilter) return false
      if (sizeGroupFilter !== 'all') {
        const group = settings.sizeGroups.find((g) => g.id === sizeGroupFilter)
        if (!group || p.squareFootage === null) return false
        if (p.squareFootage < group.min || (group.max !== null && p.squareFootage > group.max)) return false
      }
      if (dateFrom && (!p.psnDate || p.psnDate < dateFrom)) return false
      if (dateTo && (!p.psnDate || p.psnDate > dateTo)) return false
      return true
    })
  }, [projects, systemFilter, buildingFilter, sizeGroupFilter, dateFrom, dateTo, settings.sizeGroups])

  const modelable = useMemo(() => filtered.filter((p) => p.dataQuality === 'complete' && p.includeInModel), [filtered])
  const outliers = useMemo(() => filtered.filter((p) => p.isOutlier), [filtered])

  const budgetVsSf = useMemo(() => modelable.map((p) => ({ sf: p.squareFootage, budget: p.budget, name: p.projectName })), [modelable])
  const costVsSf = useMemo(() => modelable.map((p) => ({ sf: p.squareFootage, costPerSF: p.costPerSF, name: p.projectName })), [modelable])

  const sizeGroupCostData = useMemo(
    () =>
      settings.sizeGroups.map((g) => {
        const gs = computeGroupStats(filtered, g)
        return { name: g.label.replace(' SF', ''), medianCostPerSF: gs.medianCostPerSF ? Number(gs.medianCostPerSF.toFixed(4)) : 0, count: gs.count }
      }),
    [filtered, settings.sizeGroups],
  )

  const budgetDistribution = useMemo(() => {
    const budgets = modelable.map((p) => p.budget).filter((v): v is number => v !== null)
    if (budgets.length === 0) return []
    const max = Math.max(...budgets)
    const bucketSize = Math.max(1000, Math.ceil(max / 8 / 1000) * 1000)
    const buckets = new Map<number, number>()
    for (const b of budgets) {
      const bucket = Math.floor(b / bucketSize) * bucketSize
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    }
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([bucket, count]) => ({ name: `$${(bucket / 1000).toFixed(0)}k`, count }))
  }, [modelable])

  const estimateAccuracy = useMemo(
    () =>
      estimates
        .filter((e) => e.actualBudget !== null)
        .map((e) => ({ estimate: e.result.likelyEstimate, actual: e.actualBudget as number, name: e.projectName })),
    [estimates],
  )

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Deeper analysis of the historical project portfolio.</p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select className="w-48" value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)}>
            <option value="all">All System Types</option>
            {systemTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select className="w-48" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
            <option value="all">All Building Types</option>
            {buildingTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select className="w-48" value={sizeGroupFilter} onChange={(e) => setSizeGroupFilter(e.target.value)}>
            <option value="all">All Project Sizes</option>
            {settings.sizeGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Input type="date" className="w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span>to</span>
            <Input type="date" className="w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="ml-auto text-xs text-slate-400">{filtered.length} projects match</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Budget vs. Square Footage">
          {budgetVsSf.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="sf" name="SF" tickFormatter={(v) => formatSF(v)} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="budget" name="Budget" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                <RechartsTooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : v)} />
                <Scatter data={budgetVsSf} fill="#2563eb" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No data for current filters." />
          )}
        </ChartCard>

        <ChartCard title="Cost per SF vs. Square Footage">
          {costVsSf.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="sf" name="SF" tickFormatter={(v) => formatSF(v)} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="costPerSF" name="Cost/SF" tickFormatter={(v) => `$${v.toFixed(2)}`} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip formatter={(v) => (typeof v === 'number' ? formatCostPerSF(v) : v)} />
                <Scatter data={costVsSf} fill="#0ea5e9" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No data for current filters." />
          )}
        </ChartCard>

        <ChartCard title="Historical $/SF by Project Size Group">
          {sizeGroupCostData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeGroupCostData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <RechartsTooltip formatter={(v) => (typeof v === 'number' ? `$${v.toFixed(3)}/SF` : v)} />
                <Bar dataKey="medianCostPerSF" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No data for current filters." />
          )}
        </ChartCard>

        <ChartCard title="Budget Distribution">
          {budgetDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetDistribution} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No data for current filters." />
          )}
        </ChartCard>

        <ChartCard title="Estimate vs. Actual Accuracy" description="Saved estimates with a recorded actual budget.">
          {estimateAccuracy.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="estimate" name="Estimate" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="actual" name="Actual" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                <RechartsTooltip formatter={(v) => (typeof v === 'number' ? formatCurrency(v) : v)} />
                <Scatter data={estimateAccuracy} fill="#16a34a" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No estimates with actual budgets recorded yet." />
          )}
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Outlier Projects</CardTitle>
            <p className="text-xs text-slate-500">{outliers.length} projects flagged and excluded from the default model.</p>
          </CardHeader>
          <CardContent className="max-h-72 overflow-y-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Cost/SF</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outliers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-slate-400">
                      No outliers for current filters.
                    </TableCell>
                  </TableRow>
                )}
                {outliers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link to={`/projects/${p.id}`} className="font-medium text-slate-800 hover:text-brand-600">
                        {p.projectName}
                      </Link>
                    </TableCell>
                    <TableCell>{formatCostPerSF(p.costPerSF)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-slate-500" title={p.outlierReason ?? ''}>
                      <Badge variant="danger" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {p.outlierReason ?? 'Flagged'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
