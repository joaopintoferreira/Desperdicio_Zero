// Aviso de estoque baixo (Fase 6). O número vem da API; some quando não há produtos nessa situação.
export default function AlertaEstoqueBaixo({ quantidade }) {
  if (!quantidade) return null
  return (
    <p role="status" className="msg msg--aviso">
      <strong>Atenção:</strong> {quantidade === 1 ? '1 produto está' : `${quantidade} produtos estão`} com estoque baixo
      (quantidade igual ou abaixo do mínimo definido). Veja em Produtos, filtro "Estoque baixo".
    </p>
  )
}
