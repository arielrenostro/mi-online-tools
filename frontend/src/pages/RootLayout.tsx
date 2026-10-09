import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DatalogPage } from '@/pages/DatalogPage'
import { TopBar } from '@/components/TopBar'
import { ToastHost } from '@/components/ToastHost'
import { BusyHost } from '@/components/BusyHost'

export function RootLayout() {
  // A seção Datalog fica montada depois da primeira visita (escondida nas outras seções): é o que
  // mantém os gráficos vivos ao ir para Mapa e voltar. As abas dela são resolvidas pelo próprio
  // `DatalogPage` a partir da rota, não por <Outlet/>.
  const { pathname } = useLocation()
  const onDatalog = pathname === '/datalog' || pathname.startsWith('/datalog/')
  const [datalogVisited, setDatalogVisited] = useState(onDatalog)
  useEffect(() => { if (onDatalog) setDatalogVisited(true) }, [onDatalog])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">
      <TopBar />
      <main className="flex-1 overflow-auto">
        {(datalogVisited || onDatalog) && <DatalogPage visible={onDatalog} />}
        <Outlet />
      </main>
      <ToastHost />
      <BusyHost />
    </div>
  )
}
