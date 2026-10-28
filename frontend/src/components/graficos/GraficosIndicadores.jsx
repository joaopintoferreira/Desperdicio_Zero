import RoscaSituacao from './RoscaSituacao'
import BarrasValorCategoria from './BarrasValorCategoria'

// Seção de gráficos (Home e Relatórios). Recebe o `estado` de useIndicadores, então os gráficos
// usam exatamente os mesmos dados dos cards: uma única chamada à API.
export default function GraficosIndicadores({ estado }) {
  const { dados, erro, carregando, recarregar } = estado

  let conteudo
  if (erro) {
    conteudo = (
      <div>
        <p role="alert" className="msg msg--erro">Não foi possível carregar os gráficos. {erro}</p>
        <button type="button" className="btn" onClick={recarregar}>Tentar novamente</button>
      </div>
    )
  } else if (!dados) {
    conteudo = <p className="vazio">Carregando gráficos…</p>
  } else if (dados.total_produtos === 0) {
    conteudo = <p className="vazio">Nenhum produto cadastrado. Os gráficos aparecem quando houver produtos.</p>
  } else {
    conteudo = (
      <div className="graficos__grade">
        <RoscaSituacao
          vencidos={dados.produtos_vencidos}
          aVencer={dados.produtos_a_vencer}
          dentro={dados.produtos_dentro}
          janelaDias={dados.janela_alerta_dias}
        />
        <BarrasValorCategoria
          categorias={dados.por_categoria}
          valorTotal={dados.valor_em_risco}
          janelaDias={dados.janela_alerta_dias}
        />
      </div>
    )
  }

  return (
    <section className="graficos" aria-labelledby="titulo-graficos" aria-busy={carregando}>
      <h3 id="titulo-graficos" className="graficos__cabecalho">Gráficos do estoque</h3>
      {conteudo}
    </section>
  )
}
