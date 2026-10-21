import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { HoursEstimateInput, RoleHoursEntry } from '@/types'
import { useSettings } from '@/hooks/useSettings'
import { useHoursEstimates } from '@/hooks/useHoursEstimates'
import { runHoursEstimate } from '@/lib/hoursEstimator'
import { formatCurrency } from '@/lib/format'
import { generateId } from '@/services/storage'

function numOrZero(v: string): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function HoursEstimateForm() {
  const navigate = useNavigate()
  const { settings } = useSettings()
  const { saveHoursEstimate } = useHoursEstimates()

  const [projectName, setProjectName] = useState('')
  const [projectNumber, setProjectNumber] = useState('')
  const [roleHours, setRoleHours] = useState<RoleHoursEntry[]>([])
  const [overheadPercent, setOverheadPercent] = useState(settings.hoursOverheadPercent)
  const [contingencyLow, setContingencyLow] = useState(settings.hoursContingencyLowPercent)
  const [contingencyHigh, setContingencyHigh] = useState(settings.hoursContingencyHighPercent)
  const [customBudgetAdjustment, setCustomBudgetAdjustment] = useState<number | null>(null)
  const [customPercentAdjustment, setCustomPercentAdjustment] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Seed the role table from Settings once (and pick up the configured defaults for
  // overhead/contingency), without clobbering anything the user has already typed.
  useEffect(() => {
    if (initialized || settings.hourlyRoles.length === 0) return
    setRoleHours(settings.hourlyRoles.map((r) => ({ roleId: r.id, roleName: r.name, hours: 0, rate: r.defaultRate })))
    setOverheadPercent(settings.hoursOverheadPercent)
    setContingencyLow(settings.hoursContingencyLowPercent)
    setContingencyHigh(settings.hoursContingencyHighPercent)
    setInitialized(true)
  }, [settings, initialized])

  function updateRole(roleId: string, patch: Partial<RoleHoursEntry>) {
    setRoleHours((prev) => prev.map((r) => (r.roleId === roleId ? { ...r, ...patch } : r)))
  }

  function addCustomRole() {
    setRoleHours((prev) => [...prev, { roleId: generateId('role'), roleName: 'New Role', hours: 0, rate: 100 }])
  }

  function removeRole(roleId: string) {
    setRoleHours((prev) => prev.filter((r) => r.roleId !== roleId))
  }

  const input: HoursEstimateInput = useMemo(
    () => ({
      projectName,
      projectNumber,
      roleHours,
      overheadPercent,
      contingencyLowPercent: contingencyLow,
      contingencyHighPercent: contingencyHigh,
      customBudgetAdjustment,
      customPercentAdjustment,
      notes,
    }),
    [projectName, projectNumber, roleHours, overheadPercent, contingencyLow, contingencyHigh, customBudgetAdjustment, customPercentAdjustment, notes],
  )

  const preview = useMemo(() => runHoursEstimate(input), [input])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    setSubmitting(true)
    try {
      const result = runHoursEstimate(input)
      const estimate = await saveHoursEstimate({ projectName, input, result })
      navigate(`/estimates/hours/${estimate.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Hours-Based Estimate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Build a budget bottom-up from estimated labor hours by role — an independent cross-check alongside the historical-data estimate.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Project Name</Label>
            <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Example Tower" required />
          </div>
          <div className="space-y-1.5">
            <Label>Project Number</Label>
            <Input value={projectNumber} onChange={(e) => setProjectNumber(e.target.value)} placeholder="Optional" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estimated Hours by Role</CardTitle>
          <CardDescription>Default rates come from Estimating Settings — adjust per-estimate as needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="w-32">Hours</TableHead>
                <TableHead className="w-32">Rate ($/hr)</TableHead>
                <TableHead className="w-32">Cost</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roleHours.map((r) => (
                <TableRow key={r.roleId}>
                  <TableCell>
                    <Input className="h-8" value={r.roleName} onChange={(e) => updateRole(r.roleId, { roleName: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      min={0}
                      value={r.hours || ''}
                      onChange={(e) => updateRole(r.roleId, { hours: numOrZero(e.target.value) })}
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      type="number"
                      min={0}
                      value={r.rate}
                      onChange={(e) => updateRole(r.roleId, { rate: numOrZero(e.target.value) })}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">{formatCurrency(r.hours * r.rate)}</TableCell>
                  <TableCell>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeRole(r.roleId)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addCustomRole}>
            <Plus className="h-3.5 w-3.5" /> Add Role
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overhead, Contingency & Adjustments</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              Overhead (%)
              <InfoTooltip text="Applied to the labor subtotal — covers non-billable overhead, benefits, and margin." />
            </Label>
            <Input type="number" value={overheadPercent} onChange={(e) => setOverheadPercent(numOrZero(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Low Contingency (%)</Label>
            <Input type="number" value={contingencyLow} onChange={(e) => setContingencyLow(numOrZero(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>High Contingency (%)</Label>
            <Input type="number" value={contingencyHigh} onChange={(e) => setContingencyHigh(numOrZero(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Custom Budget Adjustment ($)</Label>
            <Input type="number" value={customBudgetAdjustment ?? ''} onChange={(e) => setCustomBudgetAdjustment(numOrNull(e.target.value))} placeholder="e.g. 5000" />
          </div>
          <div className="space-y-1.5">
            <Label>Custom Percentage Adjustment (%)</Label>
            <Input type="number" value={customPercentAdjustment ?? ''} onChange={(e) => setCustomPercentAdjustment(numOrNull(e.target.value))} placeholder="e.g. 10" />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Assumptions behind the hours above (informational only)." />
          </div>
        </CardContent>
      </Card>

      <Card className="border-brand-200 bg-brand-50/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Likely Estimate (live preview)</div>
            <div className="mt-1 text-2xl font-bold text-brand-700">{formatCurrency(preview.likelyEstimate)}</div>
          </div>
          <div className="text-sm text-slate-500">
            {formatCurrency(preview.lowEstimate)} – {formatCurrency(preview.highEstimate)} · {preview.totalHours.toLocaleString()} total hours
          </div>
          <Button type="submit" size="lg" disabled={submitting || !projectName.trim()}>
            {submitting ? 'Saving…' : 'Generate Hours-Based Estimate'}
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
