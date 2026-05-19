import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { RootLayout } from '@/pages/RootLayout'
import HomePage from '@/pages/HomePage'
import TuningPage from '@/pages/TuningPage'
import { DatalogPage, DashboardTab, ChartsTab, DataTab } from '@/pages/DatalogPage'
import { RequireMap } from '@/components/guards/RequireMap'
import { RequireLog } from '@/components/guards/RequireLog'
import { VETab } from '@/features/tuning/ve/VETab'
import { IgnitionTab } from '@/features/tuning/ignition/IgnitionTab'
import { LambdaTab } from '@/features/tuning/lambda/LambdaTab'

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },

      {
        path: 'tuning',
        element: <RequireMap><TuningPage /></RequireMap>,
        children: [
          { index: true, element: <Navigate to="ve" replace /> },
          { path: 've',        element: <VETab /> },
          { path: 'ignition',  element: <IgnitionTab /> },
          { path: 'lambda',    element: <LambdaTab /> },
        ],
      },

      {
        path: 'datalog',
        element: <RequireLog><DatalogPage /></RequireLog>,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: 'dashboard', element: <DashboardTab /> },
          { path: 'charts',    element: <ChartsTab /> },
          { path: 'data',      element: <DataTab /> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
