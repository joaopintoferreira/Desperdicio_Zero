// Home: o dashboard com os 4 indicadores será implementado na Fase 4, com dados reais.
export default function HomePage({ onIrParaProdutos }) {
  return (
    <section className="painel">
      <h2>Bem-vindo ao Desperdício Zero</h2>
      <p className="vazio">Os indicadores do estoque estarão disponíveis nas próximas fases.</p>
      <button type="button" className="btn btn--primario" onClick={onIrParaProdutos}>
        Gerenciar produtos
      </button>
    </section>
  )
}
