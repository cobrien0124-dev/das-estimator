import type { Adjustment } from '@/types'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export function AdjustmentInput({ label, value, onChange }: { label: string; value: Adjustment; onChange: (a: Adjustment) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="number"
          className="w-28"
          value={value.value}
          onChange={(e) => onChange({ ...value, value: Number(e.target.value) })}
        />
        <Select className="w-32" value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as Adjustment['type'] })}>
          <option value="fixed">Fixed ($)</option>
          <option value="percent">Percent (%)</option>
        </Select>
      </div>
    </div>
  )
}
