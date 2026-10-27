// Comunicação com a API do backend. Nenhuma regra de negócio aqui.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

export class ErroApi extends Error {
  constructor(mensagem, status, detalhes) {
    super(mensagem)
    this.status = status
    this.detalhes = detalhes
  }
}

async function requisitar(caminho, opcoes = {}) {
  let resposta
  try {
    resposta = await fetch(`${API_URL}${caminho}`, {
      headers: { 'Content-Type': 'application/json' },
      ...opcoes,
    })
  } catch {
    throw new ErroApi('Não foi possível comunicar com o servidor. Verifique se o backend está em execução.', 0)
  }
  if (resposta.status === 204) return null
  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok) {
    throw new ErroApi(corpo?.erro || 'Erro inesperado ao comunicar com o servidor', resposta.status, corpo?.detalhes)
  }
  return corpo
}

export const verificarSaude = () => requisitar('/health')

export function listarProdutos({ busca = '', pagina = 1, limite = 10 } = {}) {
  const params = new URLSearchParams({ pagina, limite })
  if (busca) params.set('busca', busca)
  return requisitar(`/produtos?${params}`)
}

export const criarProduto = (dados) =>
  requisitar('/produtos', { method: 'POST', body: JSON.stringify(dados) })

export const atualizarProduto = (id, dados) =>
  requisitar(`/produtos/${id}`, { method: 'PUT', body: JSON.stringify(dados) })

export const excluirProduto = (id) => requisitar(`/produtos/${id}`, { method: 'DELETE' })
