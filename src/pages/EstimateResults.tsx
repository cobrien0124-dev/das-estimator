import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronUp, Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import type { Estimate } from '@/types'
import { db } from '@/services'
import { formatCostPerSF, formatCurrency, formatDate, formatPercent, formatSF } from '@/lib/format'
import { cn } from '@/lib/utils'

function confidenceTier(score: number): { label: string; variant: 'success' | 'warning' | 'danger' } {
  if (score >= 80) return { label: 'High Confidence', variant: 'success' }
  if (score >= 50) return { label: 'Medium Confidence', variant: 'warning' }
  return { label: 'Low Confidence', variant: 'danger' }
}

function triLabel(v: boolean | null): string {
  return v === null ? 'Unknown' : v ? 'Yes' : 'No'
}

function InputItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-0.5 font-medium text-slate-700">{value}</div>
    </div>
  )
}

function EstimateCard({ label, value, emphasis }: { label: string; value: number; emphasis?: boolean }) {
  return (
    <Card className={cn(emphasis && 'border-brand-300 ring-1 ring-brand-200')}>
      <CardContent className="p-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className={cn('mt-2 text-2xl font-bold tracking-tight', emphasis ? 'text-brand-700' : 'text-slate-900')}>{formatCurrency(value)}</div>
      </CardContent>
    </Card>
  )
}

export function EstimateResults() {
  const { id } = useParams<{ id: string }>()
  const [estimate, setEstimate] = useState<Estimate | null | undefined>(undefined)
  const [breakdownOpen, setBreakdownOpen] = useState(true)
  const [actualBudgetInput, setActualBudgetInput] = useState('')

  useEffect(() => {
    if (!id) return
    db.estimates.get(id).then((e) => {
      setEstimate(e)
      setActualBudgetInput(e?.actualBudget != null ? String(e.actualBudget) : '')
    })
  }, [id])

  async function saveActual() {
    if (!id) return
    const n = actualBudgetInput.trim() === '' ? null : Number(actualBudgetInput)
    const updated = await db.estimates.update(id, { actualBudget: Number.isFinite(n) ? n : null })
    setEstimate(updated)
  }

  if (estimate === undefined) return <div className="text-sm text-slate-500">Loading…</div>
  if (estimate === null) return <div className="text-sm text-slate-500">Estimate not found.</div>

  const { input, result } = estimate
  const tier = confidenceTier(result.confidenceScore)

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Estimate Results</h1>
          <p className="mt-1 text-sm text-slate-500">Generated {formatDate(estimate.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Export
          </Button>
          <Link to="/estimates/new">
            <Button variant="secondary">New Estimate</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{input.projectName || 'Untitled Project'}</div>
            {input.location && <div className="text-xs text-slate-500">{input.location}</div>}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Building Area</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{formatSF(input.squareFootage)}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">System</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{input.systemType}</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project Complexity</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{input.designComplexity}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Inputs</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <InputItem label="Project Number" value={input.projectNumber || '—'} />
          <InputItem label="Floors" value={input.floors ?? '—'} />
          <InputItem label="Buildings" value={input.buildings ?? '—'} />
          <InputItem label="Construction Type" value={input.constructionType || '—'} />
          <InputItem label="Building Type" value={input.buildingType} />
          <InputItem label="High-Rise" value={triLabel(input.isHighRise)} />
          <InputItem label="New Construction" value={triLabel(input.isNewConstruction)} />
          <InputItem label="iBwave Required" value={triLabel(input.ibwaveRequired)} />
          <InputItem label="BIM Required" value={triLabel(input.bimRequired)} />
          <InputItem label="Permit Required" value={triLabel(input.permitRequired)} />
          <InputItem label="AHJ Complexity" value={input.ahjComplexity} />
          <InputItem label="Coordination Complexity" value={input.coordinationComplexity} />
          {input.specialConditions && (
            <div className="col-span-full">
              <div className="text-xs font-medium text-slate-400">Special Conditions</div>
              <div className="mt-0.5 whitespace-pre-wrap text-slate-700">{input.specialConditions}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {result.fallbacksUsed.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            This estimate used fallback assumptions due to limited historical data:{' '}
            {result.usedFallbackRange && 'default low/high range multiplier. '}
            {result.fallbacksUsed.includes('no-methods-available') && 'no estimation method had enough data. '}
            {result.fallbacksUsed.includes('no-historical-base') && 'no historical base could be established. '}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EstimateCard label="Low Estimate" value={result.lowEstimate} />
        <EstimateCard label="Likely Estimate" value={result.likelyEstimate} emphasis />
        <EstimateCard label="High Estimate" value={result.highEstimate} />
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">Confidence Score</div>
              <div className="mt-0.5 text-2xl font-bold text-slate-900">{result.confidenceScore}%</div>
            </div>
            <Badge variant={tier.variant} className="text-sm">
              {tier.label}
            </Badge>
          </div>
          <Progress value={result.confidenceScore} className="mt-3 h-2.5" />
          <div className="mt-4 space-y-1.5 text-sm">
            {result.confidenceReasons.map((r) => (
              <div key={r.label} className="flex items-center gap-2">
                <span className={r.positive ? 'text-emerald-600' : 'text-amber-600'}>{r.positive ? '✓' : '⚠'}</span>
                <span className="text-slate-600">{r.detail}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="cursor-pointer select-none" onClick={() => setBreakdownOpen((o) => !o)}>
          <div className="flex items-center justify-between">
            <CardTitle>How This Estimate Was Calculated</CardTitle>
            {breakdownOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
        </CardHeader>
        {breakdownOpen && (
          <CardContent className="space-y-4">
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
              <BreakdownLine label="Historical Base Estimate" value={result.historicalBase} />
              <BreakdownLine label="Square Footage Adjustment" value={result.squareFootageAdjustment} signed />
              <BreakdownLine label="System Type Adjustment" value={result.systemAdjustment} signed />
              <BreakdownLine label="Project Complexity Adjustment" value={result.complexityAdjustment} signed />
              <BreakdownLine label="AHJ Complexity Adjustment" value={result.ahjAdjustment} signed />
              <BreakdownLine label="Coordination / Deliverable Requirements" value={result.bimAdjustment} signed />
              <BreakdownLine label="Custom Adjustment" value={result.customAdjustment} signed />
              <BreakdownLine label="Total Recommended Budget" value={result.likelyEstimate} total />
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Estimation Methods Used</div>
              <div className="space-y-2">
                {result.methodResults.map((m) => (
                  <div key={m.method} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', m.available ? 'bg-emerald-500' : 'bg-slate-300')} />
                      <span className="font-medium text-slate-800">{m.label}</span>
                      {m.available && <span className="text-slate-400">({m.sampleSize} data points)</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {m.available ? (
                        <>
                          <span className="text-slate-600">{formatCurrency(m.value)}</span>
                          <Badge variant="brand">{Math.round(m.normalizedWeight)}% weight</Badge>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">{m.unavailableReason}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Explanation Log</div>
              <ul className="space-y-1 text-sm text-slate-600">
                {result.explanation.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-slate-300">·</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Similar Historical Projects</CardTitle>
          <p className="text-xs text-slate-500">
            {result.similarProjects.length} project{result.similarProjects.length === 1 ? '' : 's'} used in this calculation.
          </p>
        </CardHeader>
        <CardContent>
          {result.similarProjects.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">No sufficiently similar historical projects were found.</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {result.similarProjects.map((s) => (
                <div key={s.project.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/projects/${s.project.id}`} className="text-sm font-medium text-slate-900 hover:text-brand-600">
                      {s.project.projectName}
                    </Link>
                    <Badge variant="brand">{Math.round(s.similarityScore)}%</Badge>
                  </div>
                  <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                    <div>{formatSF(s.project.squareFootage)}</div>
                    <div>{formatCurrency(s.project.budget)}</div>
                    <div>{formatCostPerSF(s.project.costPerSF)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardHeader>
          <CardTitle>Track Actual Budget</CardTitle>
          <p className="text-xs text-slate-500">Once this project is built, record the actual budget here to feed the dashboard's accuracy metrics.</p>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input type="number" className="max-w-48" placeholder="Actual budget" value={actualBudgetInput} onChange={(e) => setActualBudgetInput(e.target.value)} />
          <Button variant="secondary" onClick={saveActual}>
            Save
          </Button>
          {estimate.actualBudget !== null && (
            <span className="text-xs text-slate-500">
              Variance: {formatPercent(((estimate.actualBudget - result.likelyEstimate) / result.likelyEstimate) * 100, 1)}
            </span>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BreakdownLine({ label, value, signed, total }: { label: string; value: number; signed?: boolean; total?: boolean }) {
  const displayValue = signed ? `${value >= 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}` : formatCurrency(value)
  return (
    <div className={cn('flex items-center justify-between px-4 py-2.5 text-sm', total && 'bg-slate-50 font-semibold')}>
      <span className={total ? 'text-slate-900' : 'text-slate-600'}>{label}</span>
      <span className={cn(total ? 'text-slate-900' : 'text-slate-700', signed && value < 0 && 'text-red-600', signed && value > 0 && 'text-emerald-600')}>{displayValue}</span>
    </div>
  )
}
