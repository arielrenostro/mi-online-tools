import { Outlet } from 'react-router-dom'
import { TopBar } from '@/components/TopBar'

export function RootLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100">
      <TopBar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
