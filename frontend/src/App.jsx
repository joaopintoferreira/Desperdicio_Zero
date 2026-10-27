import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import ProdutosPage from './pages/ProdutosPage'

const TITULOS = { home: 'Home', produtos: 'Produtos' }

export default function App() {
  const [pagina, setPagina] = useState('home')

  return (
    <div className="app">
      <Sidebar ativo={pagina} onSelecionar={setPagina} />
      <div className="principal">
        <Header titulo={TITULOS[pagina]} />
        <main className="conteudo">
          {pagina === 'home' ? <HomePage onIrParaProdutos={() => setPagina('produtos')} /> : <ProdutosPage />}
        </main>
      </div>
    </div>
  )
}
