import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EditProjectDialog } from '@/components/historical/EditProjectDialog'
import { useProjects } from '@/hooks/useProjects'
import { useSettings } from '@/hooks/useSettings'
import { computeGroupStats, getModelablePool, getSizeGroupForSqft } from '@/lib/historicalAnalysis'
import { median } from '@/lib/stats'
import { formatCostPerSF, formatCurrency, formatDate, formatPercent, formatSF } from '@/lib/format'

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

function triLabel(v: boolean | null): string {
  return v === null ? 'Unknown' : v ? 'Yes' : 'No'
}

export function ProjectDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { projects, updateProject, refresh } = useProjects()
  const { settings } = useSettings()
  const [editOpen, setEditOpen] = useState(false)

  const project = useMemo(() => projects.find((p) => p.id === id) ?? null, [projects, id])

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const comparison = useMemo(() => {
    if (!project) return null
    const pool = getModelablePool(projects)
    const portfolioCostPerSF = median(pool.map((p) => p.costPerSF).filter((v): v is number => v !== null))
    const group = project.squareFootage !== null ? getSizeGroupForSqft(project.squareFootage, settings.sizeGroups) : null
    const groupStats = group ? computeGroupStats(projects, group) : null
    return { portfolioCostPerSF, group, groupStats }
  }, [project, projects, settings.sizeGroups])

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" /> Back to Historical Projects
        </Button>
        <p className="text-sm text-slate-500">Project not found.</p>
      </div>
    )
  }

  const varianceFromPortfolio =
    comparison?.portfolioCostPerSF && project.costPerSF ? (project.costPerSF - comparison.portfolioCostPerSF) / comparison.portfolioCostPerSF : null

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" /> Back to Historical Projects
        </Button>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="h-3.5 w-3.5" /> Edit Project
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{project.projectName}</h1>
          <p className="mt-1 text-sm text-slate-500">{project.location ?? 'Location not recorded'}</p>
        </div>
        <div className="flex gap-2">
          {project.isOutlier && (
            <Badge variant="danger" className="gap-1">
              <AlertTriangle className="h-3 w-3" /> Flagged Outlier
            </Badge>
          )}
          <Badge variant={project.includeInModel ? 'success' : 'outline'}>{project.includeInModel ? 'In Model' : 'Excluded'}</Badge>
          <Badge variant="outline">{project.dataQuality}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem label="Project Number" value={project.projectNumber ?? '—'} />
            <InfoItem label="Building Type" value={project.buildingType} />
            <InfoItem label="Construction Type" value={project.constructionType ?? '—'} />
            <InfoItem label="System Type" value={project.systemType} />
            <InfoItem label="Square Footage" value={formatSF(project.squareFootage)} />
            <InfoItem label="Floors" value={project.floors ?? '—'} />
            <InfoItem label="Buildings" value={project.buildings ?? '—'} />
            <InfoItem label="PSN Date" value={formatDate(project.psnDate)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem label="Budget (Current Agreement)" value={formatCurrency(project.budget)} />
            <InfoItem label="Actual Budget" value={formatCurrency(project.actualBudget)} />
            <InfoItem label="Calculated $/SF" value={formatCostPerSF(project.costPerSF)} />
            <InfoItem
              label="Estimate vs. Actual"
              value={
                project.actualBudget && project.budget
                  ? formatPercent(((project.actualBudget - project.budget) / project.budget) * 100, 1)
                  : 'No actual budget recorded'
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Characteristics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem label="High-Rise" value={triLabel(project.isHighRise)} />
            <InfoItem label="New Construction" value={triLabel(project.isNewConstruction)} />
            <InfoItem label="BIM Required" value={triLabel(project.bimRequired)} />
            <InfoItem label="iBwave Required" value={triLabel(project.ibwaveRequired)} />
            <InfoItem label="Permit Required" value={triLabel(project.permitRequired)} />
            <InfoItem label="AHJ Complexity" value={project.ahjComplexity} />
            <InfoItem label="Design Complexity" value={project.designComplexity} />
            <InfoItem label="Status" value={project.status ?? '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comparison to Historical Average</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoItem label="Portfolio Median $/SF" value={formatCostPerSF(comparison?.portfolioCostPerSF ?? null)} />
            <InfoItem label="Size Group" value={comparison?.group?.label ?? 'Not applicable'} />
            <InfoItem
              label={`Size Group Median $/SF (${comparison?.groupStats?.count ?? 0} projects)`}
              value={formatCostPerSF(comparison?.groupStats?.medianCostPerSF ?? null)}
            />
            {varianceFromPortfolio !== null && (
              <InfoItem
                label="Variance vs. Portfolio"
                value={
                  <span className={varianceFromPortfolio > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {varianceFromPortfolio > 0 ? '+' : ''}
                    {formatPercent(varianceFromPortfolio * 100, 1)}
                  </span>
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Outlier Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          {project.isOutlier ? (
            <div className="flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{project.outlierReason ?? 'Flagged as an outlier.'}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Not flagged as an outlier — included in the default estimating model.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{project.notes || 'No notes recorded.'}</p>
        </CardContent>
      </Card>

      <EditProjectDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={async (patch) => {
          await updateProject(project.id, patch)
        }}
      />
    </div>
  )
}
