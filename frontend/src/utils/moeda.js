// Conversões de apresentação/entrada de dinheiro. Só aritmética inteira: nada de float.
// O banco guarda centavos inteiros; o usuário digita e lê reais.

// 123456 -> "R$ 1.234,56"
export function centavosParaReais(centavos) {
  const reais = Math.floor(centavos / 100)
  const resto = String(centavos % 100).padStart(2, '0')
  return `R$ ${reais.toLocaleString('pt-BR')},${resto}`
}

// 1250 -> "12,50" (valor inicial do campo de edição)
export function centavosParaCampo(centavos) {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`
}

// "12,50" | "12.50" | "1.234,56" | "R$ 5" -> centavos inteiros; null se inválido.
export function reaisParaCentavos(texto) {
  // Espaços só nas pontas e após "R$": um espaço no meio ("5 99") é erro de digitação, não "599".
  let t = String(texto).trim().replace(/^R\$\s*/, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t)
  if (!m) return null
  const centavos = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0)
  return Number.isSafeInteger(centavos) ? centavos : null
}
