import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  className?: string
}

export function SegmentedControl<T extends string>({ value, onChange, options, className }: SegmentedControlProps<T>) {
  return (
    <div className={cn('inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded px-3 py-1 font-medium transition-colors',
            value === opt.value ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/** Convenience wrapper for the pervasive TriState (Yes / No / Unknown) inputs in the New Estimate form */
export function TriStateControl({
  value,
  onChange,
  className,
}: {
  value: boolean | null
  onChange: (value: boolean | null) => void
  className?: string
}) {
  return (
    <SegmentedControl<'yes' | 'no' | 'unknown'>
      className={className}
      value={value === true ? 'yes' : value === false ? 'no' : 'unknown'}
      onChange={(v) => onChange(v === 'yes' ? true : v === 'no' ? false : null)}
      options={[
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'Unknown' },
      ]}
    />
  )
}
