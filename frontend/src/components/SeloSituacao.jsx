// Selo da situação de validade. A situação vem do backend (RN01–RN03); aqui só se apresenta.
// Sempre texto + cor: a cor nunca é o único indicador.
export const ROTULOS_SITUACAO = {
  vencido: 'Vencido',
  proximo: 'A vencer',
  dentro: 'Dentro da validade',
}

export default function SeloSituacao({ situacao }) {
  const rotulo = ROTULOS_SITUACAO[situacao]
  if (!rotulo) return null
  return <span className={`selo selo--${situacao}`}>{rotulo}</span>
}
