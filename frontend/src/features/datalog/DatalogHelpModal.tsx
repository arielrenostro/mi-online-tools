import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-blue-400 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Item({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-gray-300 leading-relaxed">{children}</li>
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 text-xs font-mono bg-gray-700 border border-gray-600 rounded text-gray-200">
      {children}
    </kbd>
  )
}

export default function DatalogHelpModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">Recursos da Tela de Datalog</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 text-xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          <Section title="Aba Logs">
            <ul className="space-y-1.5 list-disc list-inside">
              <Item>Importe quantos arquivos <code className="text-xs bg-gray-800 px-1 rounded">.csv</code> quiser via drag-and-drop ou clicando na área de upload.</Item>
              <Item>Todos os logs ativos são concatenados em uma única linha do tempo contínua.</Item>
              <Item>Reordene os logs arrastando pelo ícone <span className="font-mono">≡</span> — a ordem define a sequência temporal.</Item>
              <Item>Ative ou desative logs com o toggle; desativado, o log é ignorado mas permanece na lista.</Item>
              <Item>Remova um log com o botão <span className="font-mono text-gray-400">×</span>.</Item>
            </ul>
          </Section>

          <Section title="TimeRail — Barra de Tempo">
            <ul className="space-y-1.5 list-disc list-inside">
              <Item>Clique em qualquer ponto para posicionar o <strong className="text-red-400">cursor</strong> (linha vertical vermelha).</Item>
              <Item>O cursor popula a <strong>aba Dashboard</strong> com os valores de cada sinal naquele instante exato.</Item>
              <Item>O cursor também destaca a linha correspondente na <strong>aba Dados</strong> com rolagem automática.</Item>
              <Item>Clique e arraste para criar uma <strong>seleção temporal</strong>; os handles laterais permitem ajustar os limites.</Item>
              <Item>Com seleção ativa, a <strong>aba Dados</strong> exibe apenas as linhas dentro do intervalo, e o Auto-Tuning usa esse range.</Item>
              <Item>Arraste o interior da seleção para movê-la sem redimensionar.</Item>
              <Item>O botão <span className="text-gray-400">[Limpar]</span> ou <Kbd>Esc</Kbd> remove a seleção.</Item>
              <Item>Escolha o sinal exibido como mini-gráfico (sparkline) no seletor à direita da barra.</Item>
              <Item>Linhas tracejadas verticais marcam a junção entre logs concatenados.</Item>
              <Item>A área escurecida no TimeRail reflete o viewport de zoom dos gráficos quando a aba Gráficos está ativa.</Item>
            </ul>
          </Section>

          <Section title="Aba Dashboard">
            <ul className="space-y-1.5 list-disc list-inside">
              <Item>Exibe o valor de <strong>todos os sinais</strong> no instante do cursor em um grid de cards.</Item>
              <Item>Mova o cursor no TimeRail para atualizar os valores em tempo real.</Item>
              <Item>Requer um log ativo e o cursor posicionado para exibir dados.</Item>
            </ul>
          </Section>

          <Section title="Aba Gráficos">
            <ul className="space-y-1.5 list-disc list-inside">
              <Item>Gráficos sincronizados: o cursor e o zoom se propagam entre todos os painéis simultaneamente.</Item>
              <Item>Redimensione cada gráfico individualmente arrastando a alça na parte inferior.</Item>
              <Item>O painel lateral mostra os valores de cada sinal na posição do cursor; pode ser recolhido.</Item>
              <Item>O zoom aplicado nos gráficos é refletido como faixa escurecida no TimeRail.</Item>
            </ul>
          </Section>

          <Section title="Aba Dados">
            <ul className="space-y-1.5 list-disc list-inside">
              <Item>Tabela com rolagem virtual — suporta milhares de linhas sem lentidão.</Item>
              <Item>A linha correspondente ao cursor é destacada em azul com indicador <span className="font-mono">▶</span> e centralizada automaticamente.</Item>
              <Item>Com seleção temporal ativa, exibe apenas as linhas dentro do intervalo selecionado.</Item>
              <Item>Alterne a visibilidade de colunas no menu <strong>Colunas</strong> no canto superior direito.</Item>
              <Item>Exporte as linhas e colunas visíveis como CSV com o botão <strong>Exportar</strong>.</Item>
            </ul>
          </Section>

          <Section title="Atalhos de Teclado">
            <p className="text-xs text-gray-500 mb-3">Clique no TimeRail para que ele receba o foco antes de usar os atalhos.</p>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <div className="flex items-center gap-1">
                <Kbd>←</Kbd>
              </div>
              <span className="text-sm text-gray-300">Move o cursor 100 ms para trás</span>

              <div className="flex items-center gap-1">
                <Kbd>→</Kbd>
              </div>
              <span className="text-sm text-gray-300">Move o cursor 100 ms para frente</span>

              <div className="flex items-center gap-1">
                <Kbd>Shift</Kbd><span className="text-gray-500 text-xs">+</span><Kbd>←</Kbd>
              </div>
              <span className="text-sm text-gray-300">Move o cursor 1 segundo para trás</span>

              <div className="flex items-center gap-1">
                <Kbd>Shift</Kbd><span className="text-gray-500 text-xs">+</span><Kbd>→</Kbd>
              </div>
              <span className="text-sm text-gray-300">Move o cursor 1 segundo para frente</span>

              <div className="flex items-center gap-1">
                <Kbd>Esc</Kbd>
              </div>
              <span className="text-sm text-gray-300">Limpa a seleção temporal</span>
            </div>
          </Section>

        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  )
}
