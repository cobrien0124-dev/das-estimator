import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { TriStateControl, SegmentedControl } from '@/components/ui/segmented'
import type { BuildingType, ComplexityLevel, DesignComplexityLevel, Project, SystemType } from '@/types'

const BUILDING_TYPES: BuildingType[] = ['Residential', 'Hotel', 'Hospital', 'Commercial', 'Mixed Use', 'Garage', 'Education', 'Other', 'Unknown']
const COMPLEXITY_LEVELS: ComplexityLevel[] = ['Low', 'Standard', 'High', 'Unknown']
const DESIGN_COMPLEXITY_LEVELS: DesignComplexityLevel[] = ['Simple', 'Standard', 'Complex', 'Highly Complex', 'Unknown']

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSave,
}: {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (patch: Partial<Project>) => Promise<void>
}) {
  const [draft, setDraft] = useState<Project | null>(project)
  const [saving, setSaving] = useState(false)

  useEffect(() => setDraft(project), [project])

  if (!draft) return null

  const set = <K extends keyof Project>(key: K, value: Project[K]) => setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))

  async function handleSave() {
    if (!draft) return
    setSaving(true)
    try {
      await onSave(draft)
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Historical Project</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Project Name">
            <Input value={draft.projectName} onChange={(e) => set('projectName', e.target.value)} />
          </FieldRow>
          <FieldRow label="Project Number">
            <Input value={draft.projectNumber ?? ''} onChange={(e) => set('projectNumber', e.target.value || null)} />
          </FieldRow>
          <FieldRow label="Location">
            <Input value={draft.location ?? ''} onChange={(e) => set('location', e.target.value || null)} />
          </FieldRow>
          <FieldRow label="Square Footage">
            <Input type="number" value={draft.squareFootage ?? ''} onChange={(e) => set('squareFootage', numOrNull(e.target.value))} />
          </FieldRow>
          <FieldRow label="Floors">
            <Input type="number" value={draft.floors ?? ''} onChange={(e) => set('floors', numOrNull(e.target.value))} />
          </FieldRow>
          <FieldRow label="Buildings">
            <Input type="number" value={draft.buildings ?? ''} onChange={(e) => set('buildings', numOrNull(e.target.value))} />
          </FieldRow>
          <FieldRow label="Building Type">
            <Select value={draft.buildingType} onChange={(e) => set('buildingType', e.target.value as BuildingType)}>
              {BUILDING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </FieldRow>
          <FieldRow label="System Type">
            <Select value={draft.systemType} onChange={(e) => set('systemType', e.target.value as SystemType)}>
              <option value="Unknown">Unknown</option>
              <option value="Public Safety DAS">Public Safety DAS / ERRCS</option>
              <option value="Cellular DAS">Cellular DAS</option>
              <option value="Both">Both</option>
            </Select>
          </FieldRow>
          <FieldRow label="Budget (Current Agreement)">
            <Input type="number" value={draft.budget ?? ''} onChange={(e) => set('budget', numOrNull(e.target.value))} />
          </FieldRow>
          <FieldRow label="Actual Budget">
            <Input type="number" value={draft.actualBudget ?? ''} onChange={(e) => set('actualBudget', numOrNull(e.target.value))} />
          </FieldRow>

          <FieldRow label="High-Rise">
            <TriStateControl value={draft.isHighRise} onChange={(v) => set('isHighRise', v)} />
          </FieldRow>
          <FieldRow label="BIM Required">
            <TriStateControl value={draft.bimRequired} onChange={(v) => set('bimRequired', v)} />
          </FieldRow>
          <FieldRow label="iBwave Required">
            <TriStateControl value={draft.ibwaveRequired} onChange={(v) => set('ibwaveRequired', v)} />
          </FieldRow>
          <FieldRow label="Permit Required">
            <TriStateControl value={draft.permitRequired} onChange={(v) => set('permitRequired', v)} />
          </FieldRow>

          <FieldRow label="AHJ Complexity">
            <SegmentedControl value={draft.ahjComplexity} onChange={(v) => set('ahjComplexity', v)} options={COMPLEXITY_LEVELS.map((l) => ({ value: l, label: l }))} />
          </FieldRow>
          <FieldRow label="Design Complexity">
            <SegmentedControl
              value={draft.designComplexity}
              onChange={(v) => set('designComplexity', v)}
              options={DESIGN_COMPLEXITY_LEVELS.map((l) => ({ value: l, label: l }))}
              className="flex-wrap"
            />
          </FieldRow>

          <div className="col-span-2">
            <FieldRow label="Notes">
              <Textarea value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value || null)} />
            </FieldRow>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
