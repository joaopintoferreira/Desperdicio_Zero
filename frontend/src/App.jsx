import { useEffect, useReducer, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import ProdutosPage from './pages/ProdutosPage'
import RelatoriosPage from './pages/RelatoriosPage'
import useMediaQuery from './hooks/useMediaQuery'
import { menuInicial, menuReducer } from './utils/menu'

const TITULOS = { home: 'Home', produtos: 'Produtos', relatorios: 'Relatórios de indicadores' }

export default function App() {
  const [pagina, setPagina] = useState('home')
  const [menu, dispatch] = useReducer(menuReducer, menuInicial)
  const ehMobile = useMediaQuery('(max-width: 800px)')
  const botaoMenuRef = useRef(null)
  const botaoFecharRef = useRef(null)
  const jaAbriu = useRef(false)

  // Ao voltar para tela grande não sobra gaveta aberta nem conteúdo bloqueado.
  useEffect(() => { if (!ehMobile) dispatch({ tipo: 'virou-desktop' }) }, [ehMobile])

  // Esc fecha o menu aberto.
  useEffect(() => {
    if (!menu.aberto) return undefined
    const aoTeclar = (ev) => { if (ev.key === 'Escape') dispatch({ tipo: 'fechar' }) }
    document.addEventListener('keydown', aoTeclar)
    return () => document.removeEventListener('keydown', aoTeclar)
  }, [menu.aberto])

  // Foco: ao abrir vai para "Fechar menu"; ao fechar volta para o botão hambúrguer.
  useEffect(() => {
    if (menu.aberto) {
      jaAbriu.current = true
      botaoFecharRef.current?.focus()
    } else if (jaAbriu.current) {
      jaAbriu.current = false
      if (ehMobile) botaoMenuRef.current?.focus()
    }
  }, [menu.aberto, ehMobile])

  const selecionar = (id) => {
    setPagina(id)
    dispatch({ tipo: 'navegou' }) // escolher uma opção fecha o menu
  }

  return (
    <div className="app">
      <Sidebar
        ativo={pagina}
        onSelecionar={selecionar}
        aberto={menu.aberto}
        onFechar={() => dispatch({ tipo: 'fechar' })}
        botaoFecharRef={botaoFecharRef}
      />
      {/* Com a gaveta aberta (tela pequena) o conteúdo de fundo não recebe foco nem cliques. */}
      <div className="principal" inert={ehMobile && menu.aberto}>
        <Header
          titulo={TITULOS[pagina]}
          menuAberto={menu.aberto}
          onAlternarMenu={() => dispatch({ tipo: 'alternar' })}
          botaoMenuRef={botaoMenuRef}
        />
        <main className="conteudo">
          {pagina === 'home' && <HomePage onIrParaProdutos={() => selecionar('produtos')} onIrParaRelatorios={() => selecionar('relatorios')} />}
          {pagina === 'produtos' && <ProdutosPage />}
          {pagina === 'relatorios' && <RelatoriosPage />}
        </main>
      </div>
    </div>
  )
}
