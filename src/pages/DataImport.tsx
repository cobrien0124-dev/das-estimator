import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, UploadCloud } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import type { ColumnMapping, ImportPreviewRow, ImportTargetField, Project } from '@/types'
import { buildPreviewRows, guessColumnMapping, parseWorkbookFile, type ParsedSheet } from '@/lib/excelImport'
import { useProjects } from '@/hooks/useProjects'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency, formatSF } from '@/lib/format'
import { generateId } from '@/services/storage'
import { db } from '@/services'

const TARGET_FIELD_OPTIONS: { value: ImportTargetField; label: string }[] = [
  { value: 'ignore', label: '— Ignore this column —' },
  { value: 'projectName', label: 'Project Name' },
  { value: 'projectNumber', label: 'Project Number' },
  { value: 'squareFootage', label: 'Square Footage' },
  { value: 'budget', label: 'Budget' },
  { value: 'actualBudget', label: 'Actual Budget' },
  { value: 'floors', label: 'Floors' },
  { value: 'buildings', label: 'Buildings' },
  { value: 'systemType', label: 'System Type' },
  { value: 'buildingType', label: 'Building Type' },
  { value: 'isHighRise', label: 'High-Rise' },
  { value: 'bimRequired', label: 'BIM Required' },
  { value: 'ibwaveRequired', label: 'iBwave Required' },
  { value: 'permitRequired', label: 'Permit Required' },
  { value: 'ahjComplexity', label: 'AHJ Complexity' },
  { value: 'designComplexity', label: 'Design Complexity' },
  { value: 'notes', label: 'Project Notes' },
]

type Step = 'upload' | 'map' | 'preview' | 'done'

export function DataImport() {
  const { projects, refresh } = useProjects()
  const { settings } = useSettings()
  const [step, setStep] = useState<Step>('upload')
  const [sheets, setSheets] = useState<ParsedSheet[]>([])
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [mapping, setMapping] = useState<ColumnMapping[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const sheet = sheets[selectedSheet]

  const preview: ImportPreviewRow[] = useMemo(() => {
    if (!sheet) return []
    return buildPreviewRows(sheet.rows, mapping, projects)
  }, [sheet, mapping, projects])

  const summary = useMemo(() => {
    const errors = preview.filter((r) => r.issues.some((i) => i.severity === 'error')).length
    const warnings = preview.filter((r) => r.issues.some((i) => i.severity === 'warning')).length
    const duplicates = preview.filter((r) => r.isDuplicate).length
    const willImport = preview.filter((r) => !r.issues.some((i) => i.severity === 'error') && !(skipDuplicates && r.isDuplicate)).length
    return { total: preview.length, errors, warnings, duplicates, willImport }
  }, [preview, skipDuplicates])

  async function handleFile(file: File) {
    setError(null)
    setFileName(file.name)
    try {
      const parsed = await parseWorkbookFile(file)
      if (parsed.length === 0 || parsed.every((s) => s.rows.length === 0)) {
        setError('No data rows were found in this workbook.')
        return
      }
      setSheets(parsed)
      const bestSheetIdx = parsed.reduce((best, s, i) => (s.rows.length > parsed[best].rows.length ? i : best), 0)
      setSelectedSheet(bestSheetIdx)
      setMapping(guessColumnMapping(parsed[bestSheetIdx].headers))
      setStep('map')
    } catch {
      setError('Could not read this file. Make sure it is a valid .xlsx or .csv workbook.')
    }
  }

  function updateMapping(sourceColumn: string, targetField: ImportTargetField) {
    setMapping((prev) => prev.map((m) => (m.sourceColumn === sourceColumn ? { ...m, targetField } : m)))
  }

  async function handleImport() {
    setImporting(true)
    try {
      const batchId = generateId('import')
      const toImport = preview.filter((r) => !r.issues.some((i) => i.severity === 'error') && !(skipDuplicates && r.isDuplicate))
      await db.projects.bulkUpsert(toImport.map((r) => r.mapped as Partial<Project>), batchId)
      await db.projects.recalculateOutliers(settings.outlierIqrMultiplier)
      await refresh()
      setImportSummary({ imported: toImport.length, skipped: preview.length - toImport.length })
      setStep('done')
    } finally {
      setImporting(false)
    }
  }

  function reset() {
    setStep('upload')
    setSheets([])
    setMapping([])
    setImportSummary(null)
    setFileName('')
    setError(null)
  }

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Data Import</h1>
        <p className="mt-1 text-sm text-slate-500">Import historical DAS projects from an Excel workbook.</p>
      </div>

      {step === 'upload' && (
        <Card>
          <CardContent className="p-10">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-300 py-16 text-center hover:border-brand-400 hover:bg-slate-50">
              <UploadCloud className="h-8 w-8 text-slate-400" />
              <div className="text-sm font-medium text-slate-700">Click to choose a workbook, or drag one here</div>
              <div className="text-xs text-slate-400">.xlsx, .xls, or .csv</div>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
            </label>
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'map' && sheet && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Column Mapping</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                {fileName} · Sheet:
                <Select className="ml-1 inline-block w-auto" value={selectedSheet} onChange={(e) => { const i = Number(e.target.value); setSelectedSheet(i); setMapping(guessColumnMapping(sheets[i].headers)) }}>
                  {sheets.map((s, i) => (
                    <option key={s.sheetName} value={i}>
                      {s.sheetName} ({s.rows.length} rows)
                    </option>
                  ))}
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-xs text-slate-500">
                We've proposed a mapping based on column names — this data doesn't always have clean headers, so review and adjust before importing.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mapping.map((m) => (
                  <div key={m.sourceColumn} className="space-y-1">
                    <div className="truncate text-xs font-medium text-slate-600" title={m.sourceColumn}>
                      {m.sourceColumn}
                    </div>
                    <Select value={m.targetField} onChange={(e) => updateMapping(m.sourceColumn, e.target.value as ImportTargetField)}>
                      {TARGET_FIELD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={() => setStep('preview')}>Continue to Preview</Button>
          </div>
        </>
      )}

      {step === 'preview' && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">Total Rows</div>
                <div className="text-xl font-semibold">{summary.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">Will Import</div>
                <div className="text-xl font-semibold text-emerald-600">{summary.willImport}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">Errors</div>
                <div className="text-xl font-semibold text-red-600">{summary.errors}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500">Possible Duplicates</div>
                <div className="text-xl font-semibold text-amber-600">{summary.duplicates}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>First {Math.min(preview.length, 50)} of {preview.length} rows.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Square Footage</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Issues</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((row) => (
                    <TableRow key={row.rowIndex}>
                      <TableCell className="text-xs text-slate-400">{row.rowIndex}</TableCell>
                      <TableCell className="font-medium">
                        {row.mapped.projectName || <span className="text-red-500">missing</span>}
                        {row.isDuplicate && (
                          <Badge variant="warning" className="ml-2">
                            duplicate
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatSF(row.mapped.squareFootage ?? null)}</TableCell>
                      <TableCell>{formatCurrency(row.mapped.budget ?? null)}</TableCell>
                      <TableCell>
                        {row.issues.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {row.issues.map((issue, i) => (
                              <div key={i} className={issue.severity === 'error' ? 'text-xs text-red-600' : 'text-xs text-amber-600'}>
                                {issue.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={skipDuplicates} onCheckedChange={(v) => setSkipDuplicates(v === true)} />
              Skip likely duplicate project names
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('map')}>
                Back to Mapping
              </Button>
              <Button onClick={handleImport} disabled={importing || summary.willImport === 0}>
                {importing ? 'Importing…' : `Import ${summary.willImport} Projects`}
              </Button>
            </div>
          </div>
        </>
      )}

      {step === 'done' && importSummary && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <div className="text-lg font-semibold text-slate-900">Import Complete</div>
            <p className="text-sm text-slate-500">
              Imported {importSummary.imported} project{importSummary.imported === 1 ? '' : 's'}
              {importSummary.skipped > 0 && ` (${importSummary.skipped} skipped)`}. Outlier detection has been re-run automatically.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Import Another File
              </Button>
              <Button asChild>
                <Link to="/projects">View Historical Projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
