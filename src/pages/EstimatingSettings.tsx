import { useEffect, useState } from 'react'
import { Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { InfoTooltip } from '@/components/ui/tooltip'
import { AdjustmentInput } from '@/components/settings/AdjustmentInput'
import type { EstimatingSettings, SizeGroup } from '@/types'
import { useSettings } from '@/hooks/useSettings'
import { useProjects } from '@/hooks/useProjects'
import { generateId } from '@/services/storage'
import { cn } from '@/lib/utils'

function WeightRow({ label, value, onChange, tooltip }: { label: string; value: number; onChange: (v: number) => void; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <Label className="flex items-center gap-1.5 text-sm text-slate-700">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </Label>
      <div className="flex items-center gap-1">
        <Input type="number" className="w-20 text-right" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="text-xs text-slate-400">%</span>
      </div>
    </div>
  )
}

function WeightSum({ total }: { total: number }) {
  const balanced = Math.abs(total - 100) < 0.01
  return (
    <div className={cn('mt-2 text-xs font-medium', balanced ? 'text-emerald-600' : 'text-amber-600')}>
      Total: {total.toFixed(0)}% {!balanced && '— will be auto-normalized at estimate time'}
    </div>
  )
}

export function EstimatingSettingsPage() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const { recalculateOutliers } = useProjects()
  const [draft, setDraft] = useState<EstimatingSettings>(settings)
  const [saved, setSaved] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => setDraft(settings), [settings])

  function set<K extends keyof EstimatingSettings>(key: K, value: EstimatingSettings[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    await updateSettings(draft)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleReset() {
    const d = await resetSettings()
    setDraft(d)
  }

  async function handleRecalcOutliers() {
    setRecalculating(true)
    try {
      await recalculateOutliers(draft.outlierIqrMultiplier)
    } finally {
      setRecalculating(false)
    }
  }

  function updateSizeGroup(id: string, patch: Partial<SizeGroup>) {
    set(
      'sizeGroups',
      draft.sizeGroups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    )
  }
  function addSizeGroup() {
    set('sizeGroups', [...draft.sizeGroups, { id: generateId('sg'), label: 'New Group', min: 0, max: null }])
  }
  function removeSizeGroup(id: string) {
    set(
      'sizeGroups',
      draft.sizeGroups.filter((g) => g.id !== id),
    )
  }

  function updateHourlyRole(id: string, patch: Partial<EstimatingSettings['hourlyRoles'][number]>) {
    set(
      'hourlyRoles',
      draft.hourlyRoles.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    )
  }
  function addHourlyRole() {
    set('hourlyRoles', [...draft.hourlyRoles, { id: generateId('role'), name: 'New Role', defaultRate: 100 }])
  }
  function removeHourlyRole(id: string) {
    set(
      'hourlyRoles',
      draft.hourlyRoles.filter((r) => r.id !== id),
    )
  }

  const methodWeightTotal = Object.values(draft.methodWeights).reduce((a, b) => a + b, 0)
  const similarityWeightTotal = Object.values(draft.similarityWeights).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Estimating Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Configure the estimating model. Changes apply to future estimates only — saved estimates keep their original snapshot.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-3.5 w-3.5" /> {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="sizeGroups">
        <TabsList>
          <TabsTrigger value="sizeGroups">Size Groups</TabsTrigger>
          <TabsTrigger value="methodWeights">Method Weights</TabsTrigger>
          <TabsTrigger value="similarityWeights">Similarity Weights</TabsTrigger>
          <TabsTrigger value="complexity">Complexity Factors</TabsTrigger>
          <TabsTrigger value="thresholds">Ranges & Thresholds</TabsTrigger>
          <TabsTrigger value="hourlyRates">Hourly Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="sizeGroups">
          <Card>
            <CardHeader>
              <CardTitle>Project Size Groups</CardTitle>
              <CardDescription>Used to prioritize comparable historical projects and power the Project Size Model.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {draft.sizeGroups.map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <Input className="flex-1" value={g.label} onChange={(e) => updateSizeGroup(g.id, { label: e.target.value })} />
                  <Input
                    type="number"
                    className="w-32"
                    value={g.min}
                    onChange={(e) => updateSizeGroup(g.id, { min: Number(e.target.value) })}
                    placeholder="Min SF"
                  />
                  <span className="text-slate-400">–</span>
                  <Input
                    type="number"
                    className="w-32"
                    value={g.max ?? ''}
                    onChange={(e) => updateSizeGroup(g.id, { max: e.target.value === '' ? null : Number(e.target.value) })}
                    placeholder="No limit"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeSizeGroup(g.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSizeGroup}>
                <Plus className="h-3.5 w-3.5" /> Add Size Group
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="methodWeights">
          <Card>
            <CardHeader>
              <CardTitle>Estimation Method Weights</CardTitle>
              <CardDescription>How much each method contributes to the Likely Estimate. Unavailable methods have their weight redistributed automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeightRow
                label="Historical Similar Projects"
                value={draft.methodWeights.similarProjects}
                onChange={(v) => set('methodWeights', { ...draft.methodWeights, similarProjects: v })}
                tooltip="Weighted median budget of the most similar historical projects."
              />
              <WeightRow
                label="Regression Model"
                value={draft.methodWeights.regression}
                onChange={(v) => set('methodWeights', { ...draft.methodWeights, regression: v })}
                tooltip="Linear fit of Budget vs. Square Footage across all usable historical projects."
              />
              <WeightRow
                label="Project Size Model"
                value={draft.methodWeights.sizeGroup}
                onChange={(v) => set('methodWeights', { ...draft.methodWeights, sizeGroup: v })}
                tooltip="Median $/SF of the nearest size group with enough data."
              />
              <WeightRow
                label="Historical $/SF"
                value={draft.methodWeights.costPerSF}
                onChange={(v) => set('methodWeights', { ...draft.methodWeights, costPerSF: v })}
                tooltip="Trimmed-mean $/SF across the entire modelable portfolio."
              />
              <WeightSum total={methodWeightTotal} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="similarityWeights">
          <Card>
            <CardHeader>
              <CardTitle>Similarity Scoring Weights</CardTitle>
              <CardDescription>How much each project attribute contributes to the similarity score used to find comparable projects.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeightRow label="Square Footage" value={draft.similarityWeights.squareFootage} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, squareFootage: v })} />
              <WeightRow label="System Type" value={draft.similarityWeights.systemType} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, systemType: v })} />
              <WeightRow label="Building Type" value={draft.similarityWeights.buildingType} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, buildingType: v })} />
              <WeightRow label="Number of Floors" value={draft.similarityWeights.floors} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, floors: v })} />
              <WeightRow label="High-Rise" value={draft.similarityWeights.highRise} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, highRise: v })} />
              <WeightRow label="BIM Required" value={draft.similarityWeights.bimRequired} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, bimRequired: v })} />
              <WeightRow label="AHJ Complexity" value={draft.similarityWeights.ahjComplexity} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, ahjComplexity: v })} />
              <WeightRow label="Design Complexity" value={draft.similarityWeights.designComplexity} onChange={(v) => set('similarityWeights', { ...draft.similarityWeights, designComplexity: v })} />
              <WeightSum total={similarityWeightTotal} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complexity">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>System Type</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <AdjustmentInput
                  label="Public Safety DAS / ERRCS"
                  value={draft.complexityFactors.systemType.publicSafety}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, systemType: { ...draft.complexityFactors.systemType, publicSafety: a } })}
                />
                <AdjustmentInput
                  label="Cellular DAS"
                  value={draft.complexityFactors.systemType.cellular}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, systemType: { ...draft.complexityFactors.systemType, cellular: a } })}
                />
                <AdjustmentInput
                  label="Both Systems"
                  value={draft.complexityFactors.systemType.both}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, systemType: { ...draft.complexityFactors.systemType, both: a } })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>High-Rise & Deliverables</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AdjustmentInput label="High-Rise Premium" value={draft.complexityFactors.highRise} onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, highRise: a })} />
                <AdjustmentInput label="BIM Coordination" value={draft.complexityFactors.bimRequired} onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, bimRequired: a })} />
                <AdjustmentInput label="iBwave Design" value={draft.complexityFactors.ibwaveRequired} onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, ibwaveRequired: a })} />
                <AdjustmentInput label="Permit Set" value={draft.complexityFactors.permitSet} onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, permitSet: a })} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AHJ Complexity</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <AdjustmentInput
                  label="Low"
                  value={draft.complexityFactors.ahjComplexity.Low}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, ahjComplexity: { ...draft.complexityFactors.ahjComplexity, Low: a } })}
                />
                <AdjustmentInput
                  label="Standard"
                  value={draft.complexityFactors.ahjComplexity.Standard}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, ahjComplexity: { ...draft.complexityFactors.ahjComplexity, Standard: a } })}
                />
                <AdjustmentInput
                  label="High"
                  value={draft.complexityFactors.ahjComplexity.High}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, ahjComplexity: { ...draft.complexityFactors.ahjComplexity, High: a } })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Coordination Complexity</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <AdjustmentInput
                  label="Low"
                  value={draft.complexityFactors.coordinationComplexity.Low}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, coordinationComplexity: { ...draft.complexityFactors.coordinationComplexity, Low: a } })}
                />
                <AdjustmentInput
                  label="Standard"
                  value={draft.complexityFactors.coordinationComplexity.Standard}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, coordinationComplexity: { ...draft.complexityFactors.coordinationComplexity, Standard: a } })}
                />
                <AdjustmentInput
                  label="High"
                  value={draft.complexityFactors.coordinationComplexity.High}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, coordinationComplexity: { ...draft.complexityFactors.coordinationComplexity, High: a } })}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Design Complexity</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <AdjustmentInput
                  label="Simple"
                  value={draft.complexityFactors.designComplexity.Simple}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, designComplexity: { ...draft.complexityFactors.designComplexity, Simple: a } })}
                />
                <AdjustmentInput
                  label="Standard"
                  value={draft.complexityFactors.designComplexity.Standard}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, designComplexity: { ...draft.complexityFactors.designComplexity, Standard: a } })}
                />
                <AdjustmentInput
                  label="Complex"
                  value={draft.complexityFactors.designComplexity.Complex}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, designComplexity: { ...draft.complexityFactors.designComplexity, Complex: a } })}
                />
                <AdjustmentInput
                  label="Highly Complex"
                  value={draft.complexityFactors.designComplexity['Highly Complex']}
                  onChange={(a) => set('complexityFactors', { ...draft.complexityFactors, designComplexity: { ...draft.complexityFactors.designComplexity, 'Highly Complex': a } })}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="thresholds">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Default Low / High Range</CardTitle>
                <CardDescription>Used only as a fallback when there isn't enough historical data for a statistical percentile range.</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-4">
                <div className="space-y-1.5">
                  <Label>Low Multiplier</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.defaultLowMultiplier}
                    onChange={(e) => set('defaultLowMultiplier', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>High Multiplier</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={draft.defaultHighMultiplier}
                    onChange={(e) => set('defaultHighMultiplier', Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Requirements</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Minimum Historical Projects
                    <InfoTooltip text="Minimum comparable projects required before a method or percentile range is used." />
                  </Label>
                  <Input type="number" value={draft.minHistoricalProjects} onChange={(e) => set('minHistoricalProjects', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Outlier Sensitivity (IQR ×)
                    <InfoTooltip text="Lower = more aggressive outlier flagging. 1.5 is the standard statistical default." />
                  </Label>
                  <Input type="number" step="0.1" value={draft.outlierIqrMultiplier} onChange={(e) => set('outlierIqrMultiplier', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Minimum Similarity Score</Label>
                  <Input type="number" value={draft.minSimilarityScore} onChange={(e) => set('minSimilarityScore', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Similar Projects Shown</Label>
                  <Input type="number" value={draft.maxSimilarProjects} onChange={(e) => set('maxSimilarProjects', Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Regression Model</CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={draft.regressionEnabled} onChange={(e) => set('regressionEnabled', e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  Enable regression-based estimation method
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recalculate Outliers</CardTitle>
                <CardDescription>Re-runs IQR outlier detection across all historical projects using the current sensitivity above. Manually-flagged projects are left untouched.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="secondary" onClick={handleRecalcOutliers} disabled={recalculating}>
                  {recalculating ? 'Recalculating…' : 'Recalculate Outliers Now'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="hourlyRates">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Hourly Roles & Default Rates</CardTitle>
                <CardDescription>Used by the Hours-Based Estimate as the starting rate for each role — editable per-estimate when creating one.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {draft.hourlyRoles.map((r) => (
                  <div key={r.id} className="flex items-center gap-3">
                    <Input className="flex-1" value={r.name} onChange={(e) => updateHourlyRole(r.id, { name: e.target.value })} />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">$</span>
                      <Input
                        type="number"
                        className="w-28"
                        value={r.defaultRate}
                        onChange={(e) => updateHourlyRole(r.id, { defaultRate: Number(e.target.value) })}
                      />
                      <span className="text-xs text-slate-400">/hr</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeHourlyRole(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addHourlyRole}>
                  <Plus className="h-3.5 w-3.5" /> Add Role
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Default Overhead & Contingency</CardTitle>
                <CardDescription>Starting values pre-filled on a new Hours-Based Estimate — editable per-estimate.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Overhead (%)
                    <InfoTooltip text="Applied to the labor subtotal before contingency — covers non-billable overhead, benefits, and margin." />
                  </Label>
                  <Input type="number" value={draft.hoursOverheadPercent} onChange={(e) => set('hoursOverheadPercent', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Low Contingency (%)</Label>
                  <Input type="number" value={draft.hoursContingencyLowPercent} onChange={(e) => set('hoursContingencyLowPercent', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>High Contingency (%)</Label>
                  <Input type="number" value={draft.hoursContingencyHighPercent} onChange={(e) => set('hoursContingencyHighPercent', Number(e.target.value))} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
