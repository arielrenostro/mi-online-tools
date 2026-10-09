import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom'
import { RootLayout } from '@/pages/RootLayout'
import HomePage from '@/pages/HomePage'
import MapaPage from '@/pages/MapaPage'
import { RequireMap } from '@/components/guards/RequireMap'
import { LastTabRedirect } from '@/components/LastTabRedirect'
import { VETab } from '@/features/mapa/ve/VETab'
import { IgnitionTab } from '@/features/mapa/ignition/IgnitionTab'
import { LambdaTab } from '@/features/mapa/lambda/LambdaTab'
import { ArquivoTab } from '@/features/mapa/arquivo/ArquivoTab'
import SettingsPage from '@/pages/SettingsPage'

/** Elemento vazio de uma rota cujo conteúdo é desenhado fora do <Outlet/> (ver `DatalogPage`). */
function Nothing() { return null }

const router = createHashRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },

      {
        path: 'mapa',
        element: <MapaPage />,
        children: [
          { index: true, element: <LastTabRedirect section="mapa" /> },
          { path: 'arquivo',   element: <ArquivoTab /> },
          { path: 've',        element: <RequireMap><VETab /></RequireMap> },
          { path: 'ignition',  element: <RequireMap><IgnitionTab /></RequireMap> },
          { path: 'lambda',    element: <RequireMap><LambdaTab /></RequireMap> },
        ],
      },

      // Prefixo antigo da seção, mantido para favoritos e abas em cache.
      { path: 'tuning/*', element: <Navigate to="/mapa" replace /> },

      { path: 'settings', element: <SettingsPage /> },

      // A seção Datalog é renderizada pelo `RootLayout` (`DatalogPage`), que a mantém montada ao sair
      // dela e resolve a aba pela rota; aqui ficam só os caminhos e o índice que reabre a última aba.
      {
        path: 'datalog',
        children: [
          { index: true, element: <LastTabRedirect section="datalog" /> },
          ...['logs', 'dashboard', 'charts', 'data', 'dyno', 'xy'].map(path => ({ path, element: <Nothing /> })),
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
