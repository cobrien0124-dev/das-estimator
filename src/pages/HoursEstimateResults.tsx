import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { HoursEstimate } from '@/types'
import { db } from '@/services'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

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

export function HoursEstimateResults() {
  const { id } = useParams<{ id: string }>()
  const [estimate, setEstimate] = useState<HoursEstimate | null | undefined>(undefined)

  useEffect(() => {
    if (!id) return
    db.hoursEstimates.get(id).then(setEstimate)
  }, [id])

  if (estimate === undefined) return <div className="text-sm text-slate-500">Loading…</div>
  if (estimate === null) return <div className="text-sm text-slate-500">Hours-based estimate not found.</div>

  const { input, result } = estimate

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Hours-Based Estimate Results</h1>
          <p className="mt-1 text-sm text-slate-500">Generated {formatDate(estimate.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Export
          </Button>
          <Link to="/estimates/hours/new">
            <Button variant="secondary">New Hours Estimate</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Project</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{input.projectName || 'Untitled Project'}</div>
            {input.projectNumber && <div className="text-xs text-slate-500">{input.projectNumber}</div>}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Hours</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{result.totalHours.toLocaleString()} hrs</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Blended Rate</div>
            <div className="mt-1 text-base font-semibold text-slate-900">${result.blendedRate.toFixed(2)}/hr</div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overhead Applied</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{input.overheadPercent}%</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EstimateCard label="Low Estimate" value={result.lowEstimate} />
        <EstimateCard label="Likely Estimate" value={result.likelyEstimate} emphasis />
        <EstimateCard label="High Estimate" value={result.highEstimate} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hours by Role</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.roleBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-slate-400">
                    No hours were entered.
                  </TableCell>
                </TableRow>
              ) : (
                result.roleBreakdown.map((r) => (
                  <TableRow key={r.roleId}>
                    <TableCell className="font-medium text-slate-800">{r.roleName}</TableCell>
                    <TableCell>{r.hours.toLocaleString()}</TableCell>
                    <TableCell>${r.rate}/hr</TableCell>
                    <TableCell className="font-medium">{formatCurrency(r.cost)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How This Estimate Was Calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            <BreakdownLine label="Labor Subtotal" value={result.laborSubtotal} />
            <BreakdownLine label={`Overhead (${input.overheadPercent}%)`} value={result.overheadAmount} signed />
            <BreakdownLine label="Custom Adjustment" value={result.customAdjustment} signed />
            <BreakdownLine label="Total Recommended Budget" value={result.likelyEstimate} total />
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
          {input.notes && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{input.notes}</p>
            </div>
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
