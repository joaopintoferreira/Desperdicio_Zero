// Interação real (clique, aria-expanded, foco) na tela de Relatórios, com jsdom e a API simulada.
// Verifica o Top 10 do gráfico e o botão Expandir/Ocultar de "Indicadores por categoria".
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

const cat = (n, valor) => ({
  categoria: n, total_produtos: 2, produtos_vencidos: 0, produtos_a_vencer: valor > 0 ? 1 : 0, produtos_dentro: 1, valor_em_risco: valor,
})
// 12 categorias: valores 1200, 1100, ..., 100 (as duas últimas ficam fora do gráfico)
const CATEGORIAS = Array.from({ length: 12 }, (_, i) => cat(`Categoria ${String(i + 1).padStart(2, '0')}`, (12 - i) * 100))
const DADOS = {
  total_produtos: 24, produtos_vencidos: 3, produtos_a_vencer: 11, produtos_dentro: 10, valor_em_risco: 7800,
  produtos_estoque_baixo: 0, por_categoria: CATEGORIAS, janela_alerta_dias: 7, data_referencia: '2026-11-10',
}

let dom, React, act, createRoot, RelatoriosPage, container, root
let resposta // o que a API simulada devolve

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/' })
  for (const k of ['window', 'document']) globalThis[k] = dom.window[k === 'window' ? 'self' : k]
  globalThis.window = dom.window
  globalThis.navigator = dom.window.navigator // o react-dom do Node 20 consulta navigator
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.fetch = async () => resposta()
  React = await import('react')
  act = React.act
  ;({ createRoot } = await import('react-dom/client'))
  RelatoriosPage = (await import('./RelatoriosPage.jsx')).default
})

after(() => { dom.window.close() })

beforeEach(async () => {
  resposta = async () => ({ ok: true, status: 200, json: async () => DADOS })
  container = document.getElementById('app')
  container.innerHTML = ''
  root = createRoot(container)
  await act(async () => { root.render(React.createElement(RelatoriosPage)) })
  await act(async () => {}) // deixa a resposta simulada da API chegar
})

const botao = () => container.querySelector('.recolhivel__botao')
const conteudo = () => container.querySelector('#indicadores-por-categoria')
const clicar = (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
const linhasTabela = () => conteudo().querySelectorAll('tbody tr').length
const barras = () => [...container.querySelectorAll('.barras__rotulo')].map((e) => e.textContent)

test('a seção começa recolhida, com o botão "Expandir" e aria-expanded=false', () => {
  assert.equal(botao().tagName, 'BUTTON')
  assert.equal(botao().getAttribute('type'), 'button')
  assert.equal(botao().getAttribute('aria-expanded'), 'false')
  assert.match(botao().textContent, /Expandir/)
  assert.equal(conteudo().hidden, true)
})

test('aria-controls aponta para o conteúdo (id único e estável) e o título da seção existe', () => {
  assert.equal(botao().getAttribute('aria-controls'), 'indicadores-por-categoria')
  assert.equal(container.querySelectorAll('#indicadores-por-categoria').length, 1)
  assert.equal(container.querySelector('#indicadores-por-categoria-titulo').textContent, 'Indicadores por categoria')
  assert.equal(container.querySelector('section.recolhivel').getAttribute('aria-labelledby'), 'indicadores-por-categoria-titulo')
})

test('o nome acessível do botão diz o que ele expande', () => {
  assert.match(botao().textContent, /Expandir\s+Indicadores por categoria/)
})

test('clicar em Expandir mostra o conteúdo, com todas as 12 categorias, e atualiza aria-expanded', async () => {
  await clicar(botao())
  assert.equal(botao().getAttribute('aria-expanded'), 'true')
  assert.match(botao().textContent, /Ocultar/)
  assert.equal(conteudo().hidden, false)
  assert.equal(linhasTabela(), 12)
  assert.ok(conteudo().textContent.includes('Categoria 11') && conteudo().textContent.includes('Categoria 12'))
  assert.ok(conteudo().textContent.includes('R$ 12,00') && conteudo().textContent.includes('R$ 1,00'))
})

test('clicar em Ocultar recolhe de novo e atualiza aria-expanded', async () => {
  await clicar(botao())
  await clicar(botao())
  assert.equal(botao().getAttribute('aria-expanded'), 'false')
  assert.match(botao().textContent, /Expandir/)
  assert.equal(conteudo().hidden, true)
})

test('os dados completos continuam disponíveis mesmo recolhida (só ficam ocultos)', () => {
  assert.equal(linhasTabela(), 12)
  assert.equal(conteudo().hidden, true)
})

test('alternar várias vezes mantém o ciclo e o mesmo elemento de conteúdo', async () => {
  const el = conteudo()
  for (let i = 0; i < 3; i += 1) {
    await clicar(botao())
    assert.equal(botao().getAttribute('aria-expanded'), 'true')
    await clicar(botao())
    assert.equal(botao().getAttribute('aria-expanded'), 'false')
  }
  assert.equal(conteudo(), el)
})

test('o gráfico mostra só as 10 categorias de maior valor, em ordem decrescente', () => {
  const rotulos = barras()
  assert.equal(rotulos.length, 10)
  assert.deepEqual(rotulos, CATEGORIAS.slice(0, 10).map((c) => c.categoria))
  assert.ok(container.textContent.includes('Exibindo as 10 categorias com maior valor estimado em risco (12 no total; 2 omitidas)'))
})

test('expandir/ocultar não interfere nos gráficos, cards, botões de CSV e impressão', async () => {
  const antes = { barras: barras(), segmentos: container.querySelectorAll('[data-segmento]').length, cards: container.querySelector('.indicadores').textContent }
  await clicar(botao())
  await clicar(botao())
  assert.deepEqual(barras(), antes.barras)
  assert.equal(container.querySelectorAll('[data-segmento]').length, antes.segmentos)
  assert.equal(container.querySelector('.indicadores').textContent, antes.cards)
  const textos = [...container.querySelectorAll('button')].map((b) => b.textContent)
  assert.ok(textos.some((t) => t.includes('Exportar produtos a vencer (CSV)')))
  assert.ok(textos.some((t) => t.includes('Imprimir / Salvar como PDF')))
  assert.ok(container.querySelector('.indicadores').textContent.includes('R$ 78,00'))
})

test('o botão de expandir não é impresso, e o conteúdo pode ser impresso mesmo recolhido', () => {
  assert.ok(botao().classList.contains('nao-imprimir'))
  assert.equal(conteudo().hidden, true) // o CSS de impressão mostra o conteúdo mesmo assim
})

test('com 10 categorias ou menos não há aviso de omissão', async () => {
  resposta = async () => ({ ok: true, status: 200, json: async () => ({ ...DADOS, por_categoria: CATEGORIAS.slice(0, 10) }) })
  await act(async () => { root.render(React.createElement(RelatoriosPage, { chave: 'outra' })); root.unmount() })
  container.innerHTML = ''
  root = createRoot(container)
  await act(async () => { root.render(React.createElement(RelatoriosPage)) })
  await act(async () => {})
  assert.equal(barras().length, 10)
  assert.ok(!container.textContent.includes('Exibindo as'))
})

test('erro da API: sem seção recolhível nem números (mensagem e "Tentar novamente")', async () => {
  resposta = async () => ({ ok: false, status: 500, json: async () => ({ erro: 'Erro interno do servidor' }) })
  root.unmount()
  container.innerHTML = ''
  root = createRoot(container)
  await act(async () => { root.render(React.createElement(RelatoriosPage)) })
  await act(async () => {})
  assert.equal(container.querySelector('.recolhivel'), null)
  assert.ok(container.querySelector('[role="alert"]'))
  assert.ok([...container.querySelectorAll('button')].some((b) => b.textContent.includes('Tentar novamente')))
  assert.ok(!container.textContent.includes('R$'))
})
