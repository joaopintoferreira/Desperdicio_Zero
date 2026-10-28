import { useState } from 'react'
import { IconeSetaBaixo, IconeSetaCima } from './Icones'

// Seção com título e botão Expandir/Ocultar. Começa recolhida (tela mais compacta).
// O conteúdo fica sempre no DOM (atributo `hidden`), para o aria-controls apontar para um elemento
// real; ao imprimir, o conteúdo aparece mesmo recolhido (ver CSS), então o relatório sai completo.
export default function SecaoRecolhivel({ id, titulo, abertaInicial = false, children }) {
  const [aberta, setAberta] = useState(abertaInicial)
  const idTitulo = `${id}-titulo`

  return (
    <section className="recolhivel" aria-labelledby={idTitulo}>
      <div className="recolhivel__cabecalho">
        <h3 id={idTitulo} className="recolhivel__titulo">{titulo}</h3>
        <button
          type="button"
          className="btn recolhivel__botao nao-imprimir"
          aria-expanded={aberta}
          aria-controls={id}
          onClick={() => setAberta((a) => !a)}
        >
          {aberta ? <IconeSetaCima /> : <IconeSetaBaixo />}
          <span>{aberta ? 'Ocultar' : 'Expandir'}</span>
          <span className="sr-only"> {titulo}</span>
        </button>
      </div>
      <div id={id} className="recolhivel__conteudo" hidden={!aberta}>
        {children}
      </div>
    </section>
  )
}
