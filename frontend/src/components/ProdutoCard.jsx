import { centavosParaReais } from '../utils/moeda'
import { formatarData } from '../utils/data'

// Card de produto com dados e ações. A situação de validade (cores) entra na Fase 3.
export default function ProdutoCard({ produto, onEditar, onExcluir }) {
  return (
    <li className="produto">
      <div className="produto__info">
        <strong>{produto.nome}</strong>
        <span className="produto__meta">
          Código {produto.codigo} · {produto.categoria}
        </span>
        <span className="produto__meta">
          Estoque: {produto.quantidade} · Validade: {formatarData(produto.data_validade)}
        </span>
      </div>
      <div className="produto__preco">{centavosParaReais(produto.preco_unitario)}</div>
      <div className="produto__acoes">
        <button type="button" className="btn" onClick={() => onEditar(produto)} aria-label={`Editar ${produto.nome}`}>
          Editar
        </button>
        <button type="button" className="btn btn--perigo" onClick={() => onExcluir(produto)} aria-label={`Excluir ${produto.nome}`}>
          Excluir
        </button>
      </div>
    </li>
  )
}
