import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Radio } from 'lucide-react'
import { Sidebar } from './Sidebar'

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen w-full bg-slate-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button className="text-slate-500 hover:text-slate-700" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Radio className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-semibold text-slate-900">DAS Design Estimator</span>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
