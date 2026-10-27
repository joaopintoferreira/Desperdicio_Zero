import { IconeHome, IconeProdutos } from './Icones'

// Menu lateral. Apenas Home e Produtos (decisão da Fase 1).
const ITENS = [
  { id: 'home', rotulo: 'Home', Icone: IconeHome },
  { id: 'produtos', rotulo: 'Produtos', Icone: IconeProdutos },
]

export default function Sidebar({ ativo, onSelecionar }) {
  return (
    <nav className="sidebar" aria-label="Menu principal">
      <div className="sidebar__marca">Desperdício Zero</div>
      {ITENS.map(({ id, rotulo, Icone }) => (
        <button
          key={id}
          type="button"
          className={`sidebar__item${ativo === id ? ' sidebar__item--ativo' : ''}`}
          aria-current={ativo === id ? 'page' : undefined}
          onClick={() => onSelecionar(id)}
        >
          <Icone />
          {rotulo}
        </button>
      ))}
    </nav>
  )
}
