import { formatarPercentual, percentual, segmentosRosca } from '../../utils/graficos'

const RAIO = 54
const LARGURA = 22

// Rosca com a proporção dos produtos por situação de validade. Os números vêm da API
// (vencidos, a vencer, dentro); aqui só se desenha. A informação também está em texto
// (legenda e rótulo do gráfico), nunca apenas na cor.
export default function RoscaSituacao({ vencidos, aVencer, dentro, janelaDias }) {
  const itens = [
    { chave: 'vencido', rotulo: 'Vencidos', valor: vencidos },
    { chave: 'proximo', rotulo: `A vencer em ${janelaDias} dias`, valor: aVencer },
    { chave: 'dentro', rotulo: 'Dentro da validade', valor: dentro },
  ]
  const total = vencidos + aVencer + dentro
  const { circunferencia, segmentos } = segmentosRosca(itens, RAIO)
  const resumo = itens
    .map((i) => `${i.rotulo}: ${i.valor} (${formatarPercentual(percentual(i.valor, total))})`)
    .join('; ')

  return (
    <figure className="grafico">
      <figcaption className="grafico__titulo">Situação dos produtos</figcaption>
      <div className="rosca">
        <svg viewBox="0 0 140 140" className="rosca__svg" role="img" aria-label={`Distribuição dos ${total} produtos por situação de validade. ${resumo}.`}>
          <circle cx="70" cy="70" r={RAIO} className="rosca__trilho" strokeWidth={LARGURA} fill="none" />
          <g transform="rotate(-90 70 70)">
            {segmentos.map((s) => (
              <circle
                key={s.chave}
                data-segmento={s.chave}
                cx="70" cy="70" r={RAIO} fill="none" strokeWidth={LARGURA}
                className={`rosca__segmento rosca__segmento--${s.chave}`}
                strokeDasharray={`${s.comprimento} ${circunferencia - s.comprimento}`}
                strokeDashoffset={s.deslocamento}
              />
            ))}
          </g>
          <text x="70" y="66" textAnchor="middle" className="rosca__total">{total}</text>
          <text x="70" y="84" textAnchor="middle" className="rosca__total-rotulo">{total === 1 ? 'produto' : 'produtos'}</text>
        </svg>
        <ul className="legenda">
          {itens.map((i) => (
            <li key={i.chave} className="legenda__item">
              <span className={`legenda__marca legenda__marca--${i.chave}`} aria-hidden="true" />
              <span className="legenda__texto">{i.rotulo}</span>
              <strong className="legenda__valor">
                {i.valor} <span className="legenda__percentual">({formatarPercentual(percentual(i.valor, total))})</span>
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
