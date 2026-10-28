// Cálculos de apresentação dos gráficos (proporções e geometria). Não contêm regra de negócio:
// as contagens e os valores já chegam prontos da API.

// Percentual de `parte` em `total`, com 1 casa decimal (0 se total for 0).
export function percentual(parte, total) {
  if (!total) return 0
  return Math.round((parte / total) * 1000) / 10
}

export function formatarPercentual(valor) {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

// Largura (0–100) de cada barra em relação ao maior valor. Todos 0 => todas 0.
export function larguraBarras(valores) {
  const maior = Math.max(0, ...valores)
  return valores.map((v) => (maior === 0 ? 0 : Math.round((v / maior) * 1000) / 10))
}

// Segmentos de uma rosca desenhada com <circle> e stroke-dasharray.
// itens: [{ chave, valor }]. Devolve { circunferencia, segmentos: [{ chave, comprimento, deslocamento }] }.
// Itens com valor 0 não geram segmento.
export function segmentosRosca(itens, raio) {
  const circunferencia = 2 * Math.PI * raio
  const total = itens.reduce((soma, i) => soma + i.valor, 0)
  let acumulado = 0
  const segmentos = []
  if (total > 0) {
    for (const { chave, valor } of itens) {
      if (valor === 0) continue
      const comprimento = (valor / total) * circunferencia
      segmentos.push({ chave, comprimento, deslocamento: -acumulado })
      acumulado += comprimento
    }
  }
  return { circunferencia, segmentos }
}

// Máximo de categorias desenhadas no gráfico de barras. Só limita a VISUALIZAÇÃO: a API e a
// tabela "Indicadores por categoria" continuam com todas as categorias.
export const LIMITE_CATEGORIAS_GRAFICO = 10

// Escolhe as categorias do gráfico: maior valor em risco primeiro; empate pelo nome (sem diferenciar
// maiúsculas e acentos, depois pelo texto exato), para a ordem ser sempre a mesma. Não altera a lista
// recebida. Devolve { exibidas, omitidas } (omitidas = quantas ficaram de fora).
export function categoriasDoGrafico(categorias, limite = LIMITE_CATEGORIAS_GRAFICO) {
  const ordenadas = [...categorias].sort(
    (a, b) => b.valor_em_risco - a.valor_em_risco
      || a.categoria.localeCompare(b.categoria, 'pt-BR', { sensitivity: 'base' })
      || (a.categoria < b.categoria ? -1 : a.categoria > b.categoria ? 1 : 0),
  )
  return { exibidas: ordenadas.slice(0, limite), omitidas: Math.max(0, ordenadas.length - limite) }
}
