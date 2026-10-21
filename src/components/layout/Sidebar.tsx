import { NavLink } from 'react-router-dom'
import { BarChart3, Clock, FilePlus2, LayoutDashboard, Radio, Settings, Table2, UploadCloud, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/estimates/new', label: 'New Estimate', icon: FilePlus2 },
  { to: '/estimates/hours/new', label: 'Hours Estimate', icon: Clock },
  { to: '/projects', label: 'Historical Projects', icon: Table2 },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/import', label: 'Data Import', icon: UploadCloud },
  { to: '/settings', label: 'Estimating Settings', icon: Settings },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-950/40 md:hidden no-print" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-60 shrink-0 -translate-x-full flex-col border-r border-slate-200 bg-white transition-transform no-print',
          'md:static md:z-auto md:translate-x-0',
          open && 'translate-x-0',
        )}
      >
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
            <Radio className="h-4.5 w-4.5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">DAS Design</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Estimator</div>
          </div>
          <button className="ml-auto text-slate-400 hover:text-slate-600 md:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-400">
          Estimating model v1.0 · local data
        </div>
      </aside>
    </>
  )
}
