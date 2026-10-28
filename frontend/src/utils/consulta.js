// Controle de consultas assíncronas: só a mais recente pode atualizar a tela.
// Uso: const id = controle.iniciar(); const r = await buscar(); if (!controle.atual(id)) return
export function criarControleDeConsulta() {
  let ultima = 0
  return {
    iniciar: () => ++ultima,
    atual: (id) => id === ultima,
  }
}
