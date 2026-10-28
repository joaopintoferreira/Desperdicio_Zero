// Estado do menu lateral responsivo (hambúrguer em telas pequenas). Função pura, testável sem navegador.
export const menuInicial = { aberto: false }

export function menuReducer(estado, acao) {
  switch (acao.tipo) {
    case 'abrir': return { aberto: true }
    case 'fechar': return { aberto: false }
    case 'alternar': return { aberto: !estado.aberto }
    case 'navegou': return { aberto: false } // escolher uma opção sempre fecha o menu
    case 'virou-desktop': return { aberto: false } // sem gaveta em tela grande: não deixa estado "aberto" pendente
    default: return estado
  }
}
