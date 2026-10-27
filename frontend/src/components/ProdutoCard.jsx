import { centavosParaReais } from '../utils/moeda'
import { formatarData } from '../utils/data'
import SeloSituacao from './SeloSituacao'

// Card de produto com dados, situação de validade (calculada pelo backend) e ações.
export default function ProdutoCard({ produto, onEditar, onExcluir }) {
  return (
    <li className="produto">
      <div className="produto__info">
        <strong>{produto.nome}</strong>
        <SeloSituacao situacao={produto.situacao} />
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
