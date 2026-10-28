import { centavosParaReais } from '../utils/moeda'

// Detalhe por categoria (tabela do relatório). Valores prontos da API.
export default function TabelaCategorias({ categorias, janelaDias }) {
  if (categorias.length === 0) return <p className="vazio">Nenhum produto cadastrado.</p>
  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <caption>Indicadores por categoria</caption>
        <thead>
          <tr>
            <th scope="col">Categoria</th>
            <th scope="col" className="tabela__num">Total</th>
            <th scope="col" className="tabela__num">Vencidos</th>
            <th scope="col" className="tabela__num">A vencer em {janelaDias} dias</th>
            <th scope="col" className="tabela__num">Dentro da validade</th>
            <th scope="col" className="tabela__num">Valor estimado em risco</th>
          </tr>
        </thead>
        <tbody>
          {categorias.map((c) => (
            <tr key={c.categoria}>
              <th scope="row">{c.categoria}</th>
              <td className="tabela__num">{c.total_produtos}</td>
              <td className="tabela__num">{c.produtos_vencidos}</td>
              <td className="tabela__num">{c.produtos_a_vencer}</td>
              <td className="tabela__num">{c.produtos_dentro}</td>
              <td className="tabela__num">{centavosParaReais(c.valor_em_risco)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
