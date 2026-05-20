import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { RootLayout } from '@/pages/RootLayout'
import HomePage from '@/pages/HomePage'
import TuningPage from '@/pages/TuningPage'
import { DatalogPage } from '@/pages/DatalogPage'
import { DashboardTab } from '@/features/datalog/DashboardTab'
import { ChartsTab } from '@/features/datalog/ChartsTab'
import { DataTab } from '@/features/datalog/DataTab'
import { RequireMap } from '@/components/guards/RequireMap'
import { RequireLog } from '@/components/guards/RequireLog'
import { VETab } from '@/features/tuning/ve/VETab'
import { IgnitionTab } from '@/features/tuning/ignition/IgnitionTab'
import { LambdaTab } from '@/features/tuning/lambda/LambdaTab'
import { LogsTab } from '@/features/datalog/LogsTab'

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
        element: <DatalogPage />,
        children: [
          { index: true, element: <Navigate to="logs" replace /> },
          { path: 'logs',      element: <LogsTab /> },
          { path: 'dashboard', element: <RequireLog><DashboardTab /></RequireLog> },
          { path: 'charts',    element: <RequireLog><ChartsTab /></RequireLog> },
          { path: 'data',      element: <RequireLog><DataTab /></RequireLog> },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
