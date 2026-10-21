import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { TriStateControl, SegmentedControl } from '@/components/ui/segmented'
import { InfoTooltip } from '@/components/ui/tooltip'
import type { BuildingType, ComplexityLevel, DesignComplexityLevel, EstimateInput, SystemType } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { useSettings } from '@/hooks/useSettings'
import { useEstimates } from '@/hooks/useEstimates'
import { runEstimate } from '@/lib/estimator'
import { validateEstimateInput } from '@/lib/validation'

const BUILDING_TYPES: BuildingType[] = ['Residential', 'Hotel', 'Hospital', 'Commercial', 'Mixed Use', 'Garage', 'Education', 'Other', 'Unknown']
const COMPLEXITY_LEVELS: ComplexityLevel[] = ['Low', 'Standard', 'High', 'Unknown']
const DESIGN_COMPLEXITY_LEVELS: DesignComplexityLevel[] = ['Simple', 'Standard', 'Complex', 'Highly Complex', 'Unknown']

const EMPTY_INPUT: EstimateInput = {
  projectName: '',
  projectNumber: '',
  location: '',
  squareFootage: null,
  floors: null,
  buildings: null,
  constructionType: '',
  buildingType: 'Unknown',
  systemType: 'Public Safety DAS',
  isHighRise: null,
  isNewConstruction: null,
  ibwaveRequired: null,
  bimRequired: null,
  permitRequired: null,
  ahjComplexity: 'Standard',
  designComplexity: 'Standard',
  coordinationComplexity: 'Standard',
  specialConditions: '',
  customBudgetAdjustment: null,
  customPercentAdjustment: null,
}

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function Section({ letter, title, description, children }: { letter: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{letter}</span>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription className="pl-8">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</CardContent>
    </Card>
  )
}

function Field({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </Label>
      {children}
    </div>
  )
}

export function NewEstimate() {
  const navigate = useNavigate()
  const { projects } = useProjects()
  const { settings } = useSettings()
  const { saveEstimate } = useEstimates()

  const [input, setInput] = useState<EstimateInput>(EMPTY_INPUT)
  const [errors, setErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof EstimateInput>(key: K, value: EstimateInput[K]) => setInput((prev) => ({ ...prev, [key]: value }))

  const fieldErrors = useMemo(
    () => validateEstimateInput({ projectName: input.projectName, squareFootage: input.squareFootage, floors: input.floors, buildings: input.buildings }),
    [input.projectName, input.squareFootage, input.floors, input.buildings],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (fieldErrors.length > 0) {
      setErrors(fieldErrors.map((f) => f.message))
      return
    }
    setErrors([])
    setSubmitting(true)
    try {
      const result = runEstimate(input, projects, settings)
      const estimate = await saveEstimate({
        projectName: input.projectName,
        input,
        result,
        settingsSnapshot: settings,
        historicalProjectsSnapshot: result.similarProjects.map((s) => s.project),
        actualBudget: null,
      })
      navigate(`/estimates/${estimate.id}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">New Estimate</h1>
        <p className="mt-1 text-sm text-slate-500">Enter project information to generate a low / likely / high budget estimate.</p>
      </div>

      <Section letter="A" title="Basic Project Information" description="Core project identification and size.">
        <Field label="Project Name">
          <Input value={input.projectName} onChange={(e) => set('projectName', e.target.value)} placeholder="e.g. Example Tower" required />
        </Field>
        <Field label="Project Number">
          <Input value={input.projectNumber} onChange={(e) => set('projectNumber', e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Location">
          <Input value={input.location} onChange={(e) => set('location', e.target.value)} placeholder="City, State" />
        </Field>
        <Field label="Total Building Square Footage">
          <Input
            type="number"
            min={0}
            value={input.squareFootage ?? ''}
            onChange={(e) => set('squareFootage', numOrNull(e.target.value))}
            placeholder="e.g. 750000"
          />
        </Field>
        <Field label="Number of Floors">
          <Input type="number" min={0} value={input.floors ?? ''} onChange={(e) => set('floors', numOrNull(e.target.value))} />
        </Field>
        <Field label="Number of Buildings">
          <Input type="number" min={0} value={input.buildings ?? ''} onChange={(e) => set('buildings', numOrNull(e.target.value))} />
        </Field>
        <Field label="Construction Type">
          <Input value={input.constructionType} onChange={(e) => set('constructionType', e.target.value)} placeholder="e.g. Type I-A" />
        </Field>
        <Field label="Building Type">
          <Select value={input.buildingType} onChange={(e) => set('buildingType', e.target.value as BuildingType)}>
            {BUILDING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section letter="B" title="DAS System Information" description="System type and coordination requirements.">
        <Field label="System Type">
          <Select value={input.systemType} onChange={(e) => set('systemType', e.target.value as SystemType)}>
            <option value="Public Safety DAS">Public Safety DAS / ERRCS</option>
            <option value="Cellular DAS">Cellular DAS</option>
            <option value="Both">Both Public Safety and Cellular</option>
          </Select>
        </Field>
        <Field label="Is this a High-Rise?">
          <TriStateControl value={input.isHighRise} onChange={(v) => set('isHighRise', v)} />
        </Field>
        <Field label="Is this New Construction?">
          <TriStateControl value={input.isNewConstruction} onChange={(v) => set('isNewConstruction', v)} />
        </Field>
        <Field label="Is iBwave Design Required?">
          <TriStateControl value={input.ibwaveRequired} onChange={(v) => set('ibwaveRequired', v)} />
        </Field>
        <Field label="Is BIM Coordination Required?">
          <TriStateControl value={input.bimRequired} onChange={(v) => set('bimRequired', v)} />
        </Field>
        <Field label="Is a Permit Set Required?">
          <TriStateControl value={input.permitRequired} onChange={(v) => set('permitRequired', v)} />
        </Field>
      </Section>

      <Section letter="C" title="Project Complexity" description="Drives the DAS-specific adjustments layered on top of the historical baseline.">
        <Field label="AHJ Complexity" tooltip="Authority Having Jurisdiction coordination difficulty — higher complexity increases the estimate.">
          <SegmentedControl value={input.ahjComplexity} onChange={(v) => set('ahjComplexity', v)} options={COMPLEXITY_LEVELS.map((l) => ({ value: l, label: l }))} />
        </Field>
        <Field label="Design Complexity">
          <SegmentedControl
            value={input.designComplexity}
            onChange={(v) => set('designComplexity', v)}
            options={DESIGN_COMPLEXITY_LEVELS.map((l) => ({ value: l, label: l }))}
            className="flex-wrap"
          />
        </Field>
        <Field label="Coordination Complexity">
          <SegmentedControl value={input.coordinationComplexity} onChange={(v) => set('coordinationComplexity', v)} options={COMPLEXITY_LEVELS.map((l) => ({ value: l, label: l }))} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="Special Conditions">
            <Textarea value={input.specialConditions} onChange={(e) => set('specialConditions', e.target.value)} placeholder="Notes about anything unusual affecting scope or cost (informational only — does not change the calculation)." />
          </Field>
        </div>
        <Field label="Custom Budget Adjustment ($)" tooltip="Flat dollar amount added to (or subtracted from) the final estimate.">
          <Input type="number" value={input.customBudgetAdjustment ?? ''} onChange={(e) => set('customBudgetAdjustment', numOrNull(e.target.value))} placeholder="e.g. 5000" />
        </Field>
        <Field label="Custom Percentage Adjustment (%)" tooltip="Percentage of the running subtotal added to (or subtracted from) the final estimate.">
          <Input type="number" value={input.customPercentAdjustment ?? ''} onChange={(e) => set('customPercentAdjustment', numOrNull(e.target.value))} placeholder="e.g. 10" />
        </Field>
      </Section>

      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errors.map((e) => (
            <div key={e}>{e}</div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? 'Calculating…' : 'Generate Estimate'}
        </Button>
      </div>
    </form>
  )
}
