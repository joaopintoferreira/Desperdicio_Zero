import { IconeFechar, IconeHome, IconeProdutos, IconeRelatorios } from './Icones'

// Menu lateral. Em telas grandes é a barra fixa de sempre; em telas pequenas vira uma gaveta
// aberta pelo botão hambúrguer do cabeçalho (o CSS decide pelo tamanho da tela).
export const ITENS_MENU = [
  { id: 'home', rotulo: 'Home', Icone: IconeHome },
  { id: 'produtos', rotulo: 'Produtos', Icone: IconeProdutos },
  { id: 'relatorios', rotulo: 'Relatórios', Icone: IconeRelatorios },
]

export const ID_MENU = 'menu-lateral'

export default function Sidebar({ ativo, onSelecionar, aberto = false, onFechar, botaoFecharRef }) {
  return (
    <>
      {/* Fundo escurecido (só aparece com a gaveta aberta em tela pequena): clicar fora fecha. */}
      <div className={`sidebar__fundo${aberto ? ' sidebar__fundo--visivel' : ''}`} aria-hidden="true" onClick={onFechar} />
      <nav id={ID_MENU} className={`sidebar${aberto ? ' sidebar--aberta' : ''}`} aria-label="Menu principal">
        <div className="sidebar__topo">
          <div className="sidebar__marca">Desperdício Zero</div>
          <button type="button" className="sidebar__fechar" aria-label="Fechar menu" onClick={onFechar} ref={botaoFecharRef}>
            <IconeFechar />
          </button>
        </div>
        {ITENS_MENU.map(({ id, rotulo, Icone }) => (
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
    </>
  )
}
