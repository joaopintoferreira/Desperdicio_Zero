import { centavosParaReais } from '../utils/moeda'
import { formatarData } from '../utils/data'

const plural = (n, singular, pluralTxt) => `${n} ${n === 1 ? singular : pluralTxt}`

// Os quatro indicadores do PDF §6.3. Todos os números vêm da API (nada é calculado aqui);
// o frontend só formata. Recebe o `estado` de useIndicadores ({ dados, erro, carregando, recarregar }).
export default function Indicadores({ estado }) {
  const { dados, erro, carregando, recarregar } = estado

  if (erro) {
    return (
      <div>
        <p role="alert" className="msg msg--erro">Não foi possível carregar os indicadores. {erro}</p>
        <button type="button" className="btn" onClick={recarregar}>Tentar novamente</button>
      </div>
    )
  }
  if (!dados) return <p className="vazio">Carregando indicadores…</p>

  const { total_produtos, produtos_vencidos, produtos_a_vencer, valor_em_risco, janela_alerta_dias, data_referencia } = dados

  return (
    <div aria-busy={carregando}>
      <dl className="indicadores">
        <div className="indicador">
          <dt>Total de produtos</dt>
          <dd>{total_produtos}</dd>
          <p className="indicador__nota">{total_produtos === 1 ? 'produto diferente cadastrado' : 'produtos diferentes cadastrados'}</p>
        </div>
        <div className="indicador indicador--vencido">
          <dt>Produtos vencidos</dt>
          <dd>{produtos_vencidos}</dd>
          <p className="indicador__nota">{plural(produtos_vencidos, 'produto vencido', 'produtos vencidos')}</p>
        </div>
        <div className="indicador indicador--proximo">
          <dt>A vencer em {janela_alerta_dias} dias</dt>
          <dd>{produtos_a_vencer}</dd>
          <p className="indicador__nota">{plural(produtos_a_vencer, 'produto', 'produtos')}, incluindo os que vencem hoje</p>
        </div>
        <div className="indicador indicador--valor">
          <dt>Valor estimado em risco</dt>
          <dd>{centavosParaReais(valor_em_risco)}</dd>
          <p className="indicador__nota">
            Estimativa: quantidade × preço dos produtos a vencer em {janela_alerta_dias} dias. Não inclui vencidos e
            não é prejuízo confirmado.
          </p>
        </div>
      </dl>
      <p className="indicadores__data">Situação em {formatarData(data_referencia)}</p>
    </div>
  )
}
