import Indicadores from '../components/Indicadores'

// Home: dashboard com os 4 indicadores (PDF §6.3), todos vindos da API.
export default function HomePage({ onIrParaProdutos }) {
  return (
    <section className="painel conteudo__cheio" aria-labelledby="titulo-dashboard">
      <div className="barra">
        <h2 id="titulo-dashboard">Situação do estoque</h2>
        <button type="button" className="btn btn--primario" onClick={onIrParaProdutos}>
          Gerenciar produtos
        </button>
      </div>
      <Indicadores />
    </section>
  )
}
