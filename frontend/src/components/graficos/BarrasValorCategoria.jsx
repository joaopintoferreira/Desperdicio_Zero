import { categoriasDoGrafico, larguraBarras } from '../../utils/graficos'
import { centavosParaReais } from '../../utils/moeda'

// Barras horizontais: valor estimado em risco (RN04) por categoria, em R$. Os valores vêm da API
// (soma de quantidade × preço dos produtos a vencer, por categoria); aqui só se desenha.
// Cada barra tem rótulo e valor em texto, então a informação não depende da cor.
// Mostra no máximo as 10 categorias com maior valor em risco; os dados completos por categoria
// continuam na tabela do Relatório e o total abaixo considera todas as categorias.
export default function BarrasValorCategoria({ categorias, valorTotal, janelaDias }) {
  const { exibidas, omitidas } = categoriasDoGrafico(categorias)
  const larguras = larguraBarras(exibidas.map((c) => c.valor_em_risco))

  return (
    <figure className="grafico">
      <figcaption className="grafico__titulo">Valor estimado em risco por categoria</figcaption>
      {valorTotal === 0 ? (
        <p className="vazio">
          Nenhum valor em risco: não há produtos a vencer em {janelaDias} dias com quantidade e preço maiores que zero (R$ 0,00).
        </p>
      ) : (
        <ul className="barras" aria-label={`Valor estimado em risco por categoria; total ${centavosParaReais(valorTotal)}`}>
          {exibidas.map((c, i) => (
            <li key={c.categoria} className="barras__linha">
              <span className="barras__rotulo">{c.categoria}</span>
              <span className="barras__trilho" aria-hidden="true">
                <span className="barras__preenchimento" data-largura={larguras[i]} style={{ width: `${larguras[i]}%` }} />
              </span>
              <strong className="barras__valor">{centavosParaReais(c.valor_em_risco)}</strong>
            </li>
          ))}
        </ul>
      )}
      {omitidas > 0 && valorTotal !== 0 && (
        <p className="grafico__nota grafico__nota--limite">
          Exibindo as {exibidas.length} categorias com maior valor estimado em risco ({categorias.length} no total;
          {' '}{omitidas === 1 ? '1 omitida' : `${omitidas} omitidas`}). A tabela do Relatório lista todas.
        </p>
      )}
      <p className="grafico__nota">
        Estimativa: quantidade × preço dos produtos a vencer em {janelaDias} dias, somados por categoria
        (total geral {centavosParaReais(valorTotal)}). Não inclui vencidos e não é prejuízo confirmado.
      </p>
    </figure>
  )
}
