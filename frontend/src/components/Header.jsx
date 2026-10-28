import { IconeMenu } from './Icones'
import { ID_MENU } from './Sidebar'

// Cabeçalho superior com o botão do menu (visível só em telas pequenas) e o título da página.
export default function Header({ titulo, menuAberto = false, onAlternarMenu, botaoMenuRef }) {
  return (
    <header className="header nao-imprimir">
      <button
        type="button"
        className="menu-botao"
        aria-label="Menu de navegação"
        aria-expanded={menuAberto}
        aria-controls={ID_MENU}
        onClick={onAlternarMenu}
        ref={botaoMenuRef}
      >
        <IconeMenu />
      </button>
      <h1>{titulo}</h1>
    </header>
  )
}
