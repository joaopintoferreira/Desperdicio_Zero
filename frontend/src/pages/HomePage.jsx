import Indicadores from '../components/Indicadores'
import GraficosIndicadores from '../components/graficos/GraficosIndicadores'
import AlertaEstoqueBaixo from '../components/AlertaEstoqueBaixo'
import useIndicadores from '../hooks/useIndicadores'

// Home: dashboard (PDF §6.3) com os 4 cards e, logo abaixo, os gráficos. Cards e gráficos
// usam os mesmos dados, vindos de uma única chamada à API.
export default function HomePage({ onIrParaProdutos, onIrParaRelatorios }) {
  const estado = useIndicadores()
  return (
    <section className="painel conteudo__cheio" aria-labelledby="titulo-dashboard">
      <div className="barra">
        <h2 id="titulo-dashboard">Situação do estoque</h2>
        <div className="barra__acoes">
          <button type="button" className="btn" onClick={onIrParaRelatorios}>Ver relatório</button>
          <button type="button" className="btn btn--primario" onClick={onIrParaProdutos}>Gerenciar produtos</button>
        </div>
      </div>
      <AlertaEstoqueBaixo quantidade={estado.dados?.produtos_estoque_baixo} />
      <Indicadores estado={estado} />
      <GraficosIndicadores estado={estado} />
    </section>
  )
}
