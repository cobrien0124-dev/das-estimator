import { HashRouter, Route, Routes } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { NewEstimate } from '@/pages/NewEstimate'
import { EstimateResults } from '@/pages/EstimateResults'
import { HoursEstimateForm } from '@/pages/HoursEstimateForm'
import { HoursEstimateResults } from '@/pages/HoursEstimateResults'
import { HistoricalProjects } from '@/pages/HistoricalProjects'
import { ProjectDetails } from '@/pages/ProjectDetails'
import { Analytics } from '@/pages/Analytics'
import { EstimatingSettingsPage } from '@/pages/EstimatingSettings'
import { DataImport } from '@/pages/DataImport'

export default function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="estimates/new" element={<NewEstimate />} />
            <Route path="estimates/hours/new" element={<HoursEstimateForm />} />
            <Route path="estimates/hours/:id" element={<HoursEstimateResults />} />
            <Route path="estimates/:id" element={<EstimateResults />} />
            <Route path="projects" element={<HistoricalProjects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="import" element={<DataImport />} />
            <Route path="settings" element={<EstimatingSettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </TooltipProvider>
  )
}
