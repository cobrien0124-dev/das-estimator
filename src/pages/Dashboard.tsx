import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Plus } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjects } from '@/hooks/useProjects'
import { useEstimates } from '@/hooks/useEstimates'
import { useSettings } from '@/hooks/useSettings'
import { computeGroupStats, getModelablePool } from '@/lib/historicalAnalysis'
import { mean, median } from '@/lib/stats'
import { formatCurrency, formatCostPerSF, formatNumber, formatPercent, formatSF } from '@/lib/format'

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
      </CardContent>
    </Card>
  )
}

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

export function Dashboard() {
  const { projects, loading: projectsLoading } = useProjects()
  const { estimates } = useEstimates()
  const { settings } = useSettings()

  const modelable = useMemo(() => getModelablePool(projects), [projects])

  const stats = useMemo(() => {
    const budgets = modelable.map((p) => p.budget).filter((v): v is number => v !== null)
    const costsPerSF = modelable.map((p) => p.costPerSF).filter((v): v is number => v !== null)
    const typeCounts = new Map<string, number>()
    for (const p of projects) {
      if (p.buildingType === 'Unknown') continue
      typeCounts.set(p.buildingType, (typeCounts.get(p.buildingType) ?? 0) + 1)
    }
    let mostCommonType = 'Not tracked in source data'
    let max = 0
    for (const [type, count] of typeCounts) {
      if (count > max) {
        max = count
        mostCommonType = type
      }
    }

    const accuracyDeltas = estimates
      .filter((e) => e.actualBudget !== null && e.actualBudget > 0)
      .map((e) => Math.abs((e.actualBudget as number) - e.result.likelyEstimate) / (e.actualBudget as number))
    const avgAccuracy = accuracyDeltas.length > 0 ? 1 - (mean(accuracyDeltas) ?? 0) : null

    return {
      totalProjects: projects.length,
      avgBudget: mean(budgets),
      medianBudget: median(budgets),
      avgCostPerSF: mean(costsPerSF),
      medianCostPerSF: median(costsPerSF),
      estimateCount: estimates.length,
      avgAccuracy,
      mostCommonType,
    }
  }, [projects, modelable, estimates])

  const sizeGroupData = useMemo(
    () =>
      settings.sizeGroups.map((g) => {
        const gs = computeGroupStats(projects, g)
        return { name: g.label.replace(' SF', ''), count: gs.count }
      }),
    [projects, settings.sizeGroups],
  )

  const scatterData = useMemo(
    () => modelable.filter((p) => p.squareFootage !== null && p.budget !== null).map((p) => ({ sf: p.squareFootage, budget: p.budget, name: p.projectName })),
    [modelable],
  )

  const costPerSfScatter = useMemo(
    () => modelable.filter((p) => p.squareFootage !== null && p.costPerSF !== null).map((p) => ({ sf: p.squareFootage, costPerSF: p.costPerSF, name: p.projectName })),
    [modelable],
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
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([bucket, count]) => ({ name: `$${formatNumber(bucket / 1000)}k`, count }))
  }, [modelable])

  const estimateVsActual = useMemo(
    () =>
      estimates
        .filter((e) => e.actualBudget !== null)
        .map((e) => ({ estimate: e.result.likelyEstimate, actual: e.actualBudget as number, name: e.projectName })),
    [estimates],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Portfolio overview and estimating model performance.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="lg" variant="outline">
            <Link to="/estimates/hours/new">
              <Clock className="h-4 w-4" />
              Estimate by Hours
            </Link>
          </Button>
          <Button asChild size="lg">
            <Link to="/estimates/new">
              <Plus className="h-4 w-4" />
              Create New Estimate
            </Link>
          </Button>
        </div>
      </div>

      {!projectsLoading && projects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-slate-500">
            No historical projects yet. Import data from the Data Import page to power the estimating model.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Total Historical Projects" value={formatNumber(stats.totalProjects)} sub={`${modelable.length} usable in model`} />
        <Kpi label="Average Project Budget" value={formatCurrency(stats.avgBudget)} />
        <Kpi label="Median Project Budget" value={formatCurrency(stats.medianBudget)} />
        <Kpi label="Average $/SF" value={formatCostPerSF(stats.avgCostPerSF)} />
        <Kpi label="Median $/SF" value={formatCostPerSF(stats.medianCostPerSF)} />
        <Kpi label="Estimates Created" value={formatNumber(stats.estimateCount)} />
        <Kpi label="Avg. Estimate Accuracy" value={stats.avgAccuracy !== null ? formatPercent(stats.avgAccuracy * 100) : '—'} sub={stats.avgAccuracy === null ? 'No completed projects yet' : undefined} />
        <Kpi label="Most Common Project Type" value={stats.mostCommonType} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Budget vs. Square Footage" description="Each point is one historical project (outliers excluded).">
          {scatterData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="sf" name="Square Footage" tickFormatter={(v) => formatSF(v)} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="budget" name="Budget" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                <RechartsTooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  formatter={(value, name) => (typeof value === 'number' ? [name === 'sf' ? formatSF(value) : formatCurrency(value), name] : value)}
                  labelFormatter={() => ''}
                />
                <Scatter data={scatterData} fill="#2563eb" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No projects with both budget and square footage yet." />
          )}
        </ChartCard>

        <ChartCard title="Cost per SF vs. Square Footage" description="Shows whether larger projects have economies of scale.">
          {costPerSfScatter.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="sf" name="Square Footage" tickFormatter={(v) => formatSF(v)} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="costPerSF" name="Cost/SF" tickFormatter={(v) => `$${v.toFixed(2)}`} tick={{ fontSize: 11 }} width={60} />
                <RechartsTooltip
                  formatter={(value, name) => (typeof value === 'number' ? [name === 'sf' ? formatSF(value) : formatCostPerSF(value), name] : value)}
                  labelFormatter={() => ''}
                />
                <Scatter data={costPerSfScatter} fill="#0ea5e9" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No projects with usable Cost/SF yet." />
          )}
        </ChartCard>

        <ChartCard title="Project Size Distribution" description="Count of historical projects per configured size group.">
          {sizeGroupData.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeGroupData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No sized projects yet." />
          )}
        </ChartCard>

        <ChartCard title="Estimate vs. Actual Budget" description="How saved estimates compared to final actual budgets.">
          {estimateVsActual.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="estimate" name="Estimate" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
                <YAxis type="number" dataKey="actual" name="Actual" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} width={80} />
                <RechartsTooltip formatter={(value) => (typeof value === 'number' ? formatCurrency(value) : value)} />
                <Scatter data={estimateVsActual} fill="#16a34a" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No estimates with a recorded actual budget yet." />
          )}
        </ChartCard>

        <ChartCard title="Historical Project Budget Distribution" description="Frequency of historical projects by budget range.">
          {budgetDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetDistribution} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RechartsTooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {budgetDistribution.map((_, i) => (
                    <Cell key={i} fill="#3b82f6" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No budget data yet." />
          )}
        </ChartCard>
      </div>
    </div>
  )
}
