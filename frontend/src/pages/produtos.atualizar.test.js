// Botão "Atualizar" da tela Produtos: interação real (jsdom) com uma API simulada.
// A API simulada registra cada requisição e permite controlar quando (e se) cada resposta chega.
import { test, before, after, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

let dom, React, act, createRoot, ProdutosPage, container, root
let chamadas // URLs requisitadas, na ordem
let rotas // { '/api/produtos': (url) => resposta | Promise, ... }
let estado // dados "do banco" simulado

const resp = (corpo, status = 200) => ({ ok: status < 400, status, json: async () => corpo })
const produto = (id, nome = `Produto ${id}`, extra = {}) => ({
  id, nome, codigo: `C${id}`, categoria: 'Alimento', quantidade: 5, preco_unitario: 599, data_validade: '2026-11-12',
  estoque_minimo: 0, situacao: 'proximo', estoque_baixo: false, ...extra,
})
const indicadoresDe = (total) => ({
  total_produtos: total, produtos_vencidos: 1, produtos_a_vencer: 2, produtos_dentro: total - 3, valor_em_risco: 7400,
  produtos_estoque_baixo: 0, por_categoria: [], janela_alerta_dias: 7, data_referencia: '2026-11-10',
})
// Lista paginada coerente com a URL pedida e com `estado.total`.
function listaPelaUrl(url) {
  const limite = Number(url.searchParams.get('limite'))
  const pagina = Number(url.searchParams.get('pagina'))
  const total = estado.total
  const inicio = (pagina - 1) * limite
  const dados = Array.from({ length: Math.max(0, Math.min(limite, total - inicio)) }, (_, i) => produto(inicio + i + 1))
  return resp({ dados, paginacao: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) } })
}
const diferida = () => { let resolver; const promessa = new Promise((r) => { resolver = r }); return { promessa, resolver } }

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/' })
  globalThis.window = dom.window
  globalThis.document = dom.window.document
  globalThis.navigator = dom.window.navigator
  globalThis.HTMLElement = dom.window.HTMLElement
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.fetch = (url) => {
    chamadas.push(String(url))
    const u = new URL(String(url))
    return rotas[u.pathname](u)
  }
  React = await import('react')
  act = React.act
  ;({ createRoot } = await import('react-dom/client'))
  ProdutosPage = (await import('./ProdutosPage.jsx')).default
})
after(() => { dom.window.close() })

async function montar() {
  chamadas = []
  estado = { total: 25, indicadores: indicadoresDe(10), categorias: ['Alimento', 'Bebidas'] }
  rotas = {
    '/api/produtos': (u) => listaPelaUrl(u),
    '/api/indicadores': () => resp(estado.indicadores),
    '/api/categorias': () => resp({ dados: estado.categorias }),
  }
  container = document.getElementById('app')
  container.innerHTML = ''
  root = createRoot(container)
  await act(async () => { root.render(React.createElement(ProdutosPage)) })
  await assentar()
}
beforeEach(montar)
afterEach(async () => { await act(async () => { root.unmount() }) })

const assentar = async () => { await act(async () => {}); await act(async () => {}) }
const esperar = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const clicar = (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
const digitar = (el, valor) => act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, valor)
  el.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
const escolher = (el, valor) => act(async () => {
  el.value = valor
  el.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
})

const campoBusca = () => container.querySelector('#busca')
const sel = (id) => container.querySelector(`#filtro-${id}`)
const botaoAtualizar = () => container.querySelector('.btn--atualizar')
const botaoPorTexto = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === t)
const doEndpoint = (caminho) => chamadas.filter((c) => new URL(c).pathname === caminho)
const parametros = (url) => Object.fromEntries(new URL(url).searchParams)
const ultimaLista = () => parametros(doEndpoint('/api/produtos').at(-1))
const nomesNaTela = () => [...container.querySelectorAll('.produto__info strong')].map((e) => e.textContent)
const textoPagina = () => container.querySelector('.paginacao span')?.textContent

test('ao abrir a tela: uma consulta de lista, uma de indicadores e uma de categorias (sem duplicar)', () => {
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.equal(doEndpoint('/api/indicadores').length, 1)
  assert.equal(doEndpoint('/api/categorias').length, 1)
})

test('1) Atualizar mantém busca, filtros e página', async () => {
  await digitar(campoBusca(), 'abc')
  await esperar(400)
  await escolher(sel('situacao'), 'proximo')
  await escolher(sel('categoria'), 'Alimento')
  await escolher(sel('estoque'), 'baixo')
  await clicar(botaoPorTexto('Próxima'))
  assert.equal(textoPagina(), 'Página 2 de 3')

  chamadas.length = 0
  await clicar(botaoAtualizar())
  await assentar()

  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.deepEqual(ultimaLista(), { pagina: '2', limite: '10', busca: 'abc', categoria: 'Alimento', situacao: 'proximo', estoque: 'baixo' })
  assert.equal(campoBusca().value, 'abc')
  assert.equal(sel('situacao').value, 'proximo')
  assert.equal(sel('categoria').value, 'Alimento')
  assert.equal(sel('estoque').value, 'baixo')
  assert.equal(textoPagina(), 'Página 2 de 3')
})

test('2) clicar logo após digitar pesquisa o texto visível (sem espaços), numa única consulta', async () => {
  chamadas.length = 0
  await digitar(campoBusca(), '  xyz  ')
  await clicar(botaoAtualizar()) // antes dos 300 ms
  await assentar()
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.equal(ultimaLista().busca, 'xyz')
  await esperar(450) // o atraso da pesquisa automática não pode gerar outra consulta
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.equal(campoBusca().value, '  xyz  ') // o que foi digitado não é apagado nem reescrito
})

test('2b) pesquisa nova (texto mudou) volta à página 1; o texto igual ao aplicado não reinicia a página', async () => {
  await digitar(campoBusca(), 'abc')
  await esperar(400)
  await clicar(botaoPorTexto('Próxima'))
  assert.equal(textoPagina(), 'Página 2 de 3')

  // mesmo texto aplicado (só espaço a mais): página preservada, uma consulta, nenhuma depois do atraso
  chamadas.length = 0
  await digitar(campoBusca(), 'abc ')
  await clicar(botaoAtualizar())
  await assentar()
  await esperar(450)
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.equal(ultimaLista().pagina, '2')
  assert.equal(textoPagina(), 'Página 2 de 3')

  // texto diferente: é uma pesquisa nova => página 1
  chamadas.length = 0
  await digitar(campoBusca(), 'abcd')
  await clicar(botaoAtualizar())
  await assentar()
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.deepEqual([ultimaLista().busca, ultimaLista().pagina], ['abcd', '1'])
})

test('3) sem consultas duplicadas: uma de cada tipo por atualização', async () => {
  chamadas.length = 0
  await clicar(botaoAtualizar())
  await assentar()
  await esperar(450)
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.equal(doEndpoint('/api/indicadores').length, 1)
  assert.equal(doEndpoint('/api/categorias').length, 1)
})

test('4) recarrega os indicadores do estoque inteiro (não afetados pelos filtros)', async () => {
  const total = () => container.querySelector('.indicadores dd').textContent
  assert.equal(total(), '10')
  await escolher(sel('situacao'), 'vencido')
  chamadas.length = 0
  estado.indicadores = indicadoresDe(17)
  await clicar(botaoAtualizar())
  await assentar()
  assert.equal(total(), '17')
  assert.equal(parametros(doEndpoint('/api/indicadores')[0]).situacao, undefined) // sem filtros na consulta
})

test('5) recarrega as categorias do seletor', async () => {
  const opcoes = () => [...sel('categoria').options].map((o) => o.textContent)
  assert.deepEqual(opcoes(), ['Todas as categorias', 'Alimento', 'Bebidas'])
  estado.categorias = ['Alimento', 'Bebidas', 'Limpeza']
  await clicar(botaoAtualizar())
  await assentar()
  assert.deepEqual(opcoes(), ['Todas as categorias', 'Alimento', 'Bebidas', 'Limpeza'])
})

test('6) preserva a categoria selecionada quando ela ainda existe', async () => {
  await escolher(sel('categoria'), 'Bebidas')
  estado.categorias = ['Bebidas', 'Frios']
  chamadas.length = 0
  await clicar(botaoAtualizar())
  await assentar()
  assert.equal(sel('categoria').value, 'Bebidas')
  assert.equal(ultimaLista().categoria, 'Bebidas')
  assert.equal(container.querySelector('.msg--aviso'), null)
})

test('7) categoria removida por fora: só esse filtro sai, o usuário é avisado e os demais filtros ficam', async () => {
  await escolher(sel('categoria'), 'Bebidas')
  await escolher(sel('situacao'), 'proximo')
  estado.categorias = ['Alimento']
  chamadas.length = 0
  await clicar(botaoAtualizar())
  await assentar()
  assert.equal(sel('categoria').value, '')
  assert.equal(sel('situacao').value, 'proximo')
  const aviso = container.querySelector('.msg--aviso')
  assert.ok(aviso && aviso.textContent.includes('Bebidas') && aviso.textContent.includes('não existe mais'))
  assert.equal(ultimaLista().categoria, undefined)
  assert.equal(ultimaLista().situacao, 'proximo')
  assert.equal(ultimaLista().pagina, '1')
})

test('8) página que deixou de existir: vai para a última válida, sem limpar busca nem filtros', async () => {
  await digitar(campoBusca(), 'abc')
  await esperar(400)
  await escolher(sel('situacao'), 'proximo')
  await clicar(botaoPorTexto('Próxima'))
  await clicar(botaoPorTexto('Próxima'))
  assert.equal(textoPagina(), 'Página 3 de 3')

  estado.total = 15 // exclusões externas: agora são 2 páginas
  chamadas.length = 0
  await clicar(botaoAtualizar())
  await assentar()
  assert.deepEqual(doEndpoint('/api/produtos').map((c) => parametros(c).pagina), ['3', '2'])
  assert.equal(textoPagina(), 'Página 2 de 2')
  assert.equal(container.querySelectorAll('.produto').length, 5)
  assert.equal(campoBusca().value, 'abc')
  assert.equal(sel('situacao').value, 'proximo')
  assert.ok(!container.textContent.includes('Nenhum produto'))
  assert.equal(botaoAtualizar().getAttribute('aria-disabled'), 'false')
})

test('8b) tudo excluído por fora: mostra "nenhum produto" sem repetir consultas', async () => {
  await clicar(botaoPorTexto('Próxima'))
  estado.total = 0
  chamadas.length = 0
  await clicar(botaoAtualizar())
  await assentar()
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.ok(container.textContent.includes('Nenhum produto cadastrado'))
})

test('9) mostra carregamento, mantém o foco e impede cliques repetidos', async () => {
  const dLista = diferida(); const dInd = diferida(); const dCat = diferida()
  rotas['/api/produtos'] = () => dLista.promessa
  rotas['/api/indicadores'] = () => dInd.promessa
  rotas['/api/categorias'] = () => dCat.promessa
  const botao = botaoAtualizar()
  botao.focus()
  chamadas.length = 0

  await clicar(botao)
  assert.equal(botao.getAttribute('aria-disabled'), 'true')
  assert.equal(botao.getAttribute('aria-busy'), 'true')
  assert.ok(botao.querySelector('.spinner'))
  assert.equal(botao.textContent.trim(), 'Atualizando…')
  assert.equal(document.activeElement, botao, 'o foco continua no botão')

  await clicar(botao)
  await clicar(botao)
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.equal(doEndpoint('/api/indicadores').length, 1)
  assert.equal(doEndpoint('/api/categorias').length, 1)

  // a página não é bloqueada: os campos continuam editáveis
  assert.equal(campoBusca().disabled, false)
  assert.equal(sel('situacao').disabled, false)

  await act(async () => { dLista.resolver(listaPelaUrl(new URL('http://x/api/produtos?pagina=1&limite=10'))) })
  assert.equal(botao.getAttribute('aria-disabled'), 'true', 'ainda faltam duas consultas')
  await act(async () => { dInd.resolver(resp(estado.indicadores)) })
  await act(async () => { dCat.resolver(resp({ dados: estado.categorias })) })
  await assentar()

  assert.equal(botao.getAttribute('aria-disabled'), 'false')
  assert.equal(botao.querySelector('.spinner'), null)
  assert.equal(botao.textContent.trim(), 'Atualizar')
  assert.ok(container.textContent.includes('Dados atualizados.'))
})

test('10a) falha na lista: mensagem clara, sem dados antigos, e o botão permite tentar de novo', async () => {
  assert.ok(nomesNaTela().length > 0)
  rotas['/api/produtos'] = () => Promise.reject(new TypeError('fetch failed'))
  await clicar(botaoAtualizar())
  await assentar()
  const alerta = [...container.querySelectorAll('[role="alert"]')].find((a) => a.textContent.includes('Não foi possível comunicar'))
  assert.ok(alerta && alerta.textContent.includes('Atualizar'))
  assert.equal(nomesNaTela().length, 0, 'não mostra a lista antiga como se fosse nova')
  assert.equal(botaoAtualizar().getAttribute('aria-disabled'), 'false')
  assert.ok(!container.textContent.includes('Dados atualizados.'))

  rotas['/api/produtos'] = (u) => listaPelaUrl(u) // nova tentativa
  await clicar(botaoAtualizar())
  await assentar()
  assert.ok(nomesNaTela().length > 0)
  assert.equal(container.querySelector('.painel [role="alert"]'), null)
  assert.ok(container.textContent.includes('Dados atualizados.'))
})

test('10b) falha nos indicadores: erro com "Tentar novamente" no painel; a lista é atualizada mesmo assim', async () => {
  rotas['/api/indicadores'] = () => resp({ erro: 'Erro interno do servidor' }, 500)
  estado.total = 12
  await clicar(botaoAtualizar())
  await assentar()
  const painel = container.querySelector('aside')
  assert.ok(painel.textContent.includes('Não foi possível carregar os indicadores'))
  assert.ok([...painel.querySelectorAll('button')].some((b) => b.textContent === 'Tentar novamente'))
  assert.equal(painel.querySelector('dd'), null, 'sem números antigos')
  assert.equal(textoPagina(), 'Página 1 de 2')
  assert.equal(botaoAtualizar().getAttribute('aria-disabled'), 'false')
  assert.ok(!container.textContent.includes('Dados atualizados.'))

  rotas['/api/indicadores'] = () => resp(estado.indicadores)
  await clicar([...painel.querySelectorAll('button')].find((b) => b.textContent === 'Tentar novamente'))
  await assentar()
  assert.equal(container.querySelector('.indicadores dd').textContent, '10')
})

test('10c) falha nas categorias: mantém as opções que já existiam e atualiza lista e indicadores', async () => {
  rotas['/api/categorias'] = () => Promise.reject(new TypeError('fetch failed'))
  estado.indicadores = indicadoresDe(31)
  estado.total = 12
  await clicar(botaoAtualizar())
  await assentar()
  assert.deepEqual([...sel('categoria').options].map((o) => o.textContent), ['Todas as categorias', 'Alimento', 'Bebidas'])
  const msg = container.querySelector('#erro-categorias')
  assert.ok(msg && msg.textContent.includes('exibindo as últimas carregadas'))
  assert.equal(container.querySelector('.indicadores dd').textContent, '31')
  assert.equal(textoPagina(), 'Página 1 de 2')
  assert.equal(botaoAtualizar().getAttribute('aria-disabled'), 'false')

  rotas['/api/categorias'] = () => resp({ dados: estado.categorias })
  await clicar(botaoAtualizar())
  await assentar()
  assert.equal(container.querySelector('#erro-categorias'), null)
})

test('11) respostas antigas não substituem as mais novas (consultas concorrentes)', async () => {
  const a = diferida(); const b = diferida()
  const fila = [a, b]
  rotas['/api/produtos'] = () => fila.shift().promessa
  await clicar(botaoAtualizar()) // consulta A (fica pendente)
  await escolher(sel('situacao'), 'vencido') // consulta B, mais nova
  assert.equal(doEndpoint('/api/produtos').length, 3) // abertura + A + B
  const lista = (nome) => resp({ dados: [produto(1, nome)], paginacao: { pagina: 1, limite: 10, total: 1, totalPaginas: 1 } })
  await act(async () => { b.resolver(lista('Resultado da consulta nova')) })
  await act(async () => { a.resolver(lista('Resultado da consulta antiga')) }) // chega depois, mas é antiga
  await assentar()
  assert.deepEqual(nomesNaTela(), ['Resultado da consulta nova'])
})

test('12) pesquisa automática e filtros continuam funcionando normalmente', async () => {
  chamadas.length = 0
  await digitar(campoBusca(), 'leite')
  assert.equal(doEndpoint('/api/produtos').length, 0, 'ainda dentro dos 300 ms')
  await esperar(400)
  assert.equal(doEndpoint('/api/produtos').length, 1)
  assert.deepEqual([ultimaLista().busca, ultimaLista().pagina], ['leite', '1'])

  await clicar(botaoPorTexto('Próxima'))
  assert.equal(ultimaLista().pagina, '2')
  await escolher(sel('situacao'), 'vencido') // filtro volta à página 1
  assert.deepEqual([ultimaLista().situacao, ultimaLista().pagina, ultimaLista().busca], ['vencido', '1', 'leite'])
  await escolher(sel('categoria'), 'Bebidas')
  assert.equal(ultimaLista().categoria, 'Bebidas')
  await escolher(sel('estoque'), 'baixo')
  assert.equal(ultimaLista().estoque, 'baixo')
  await escolher(sel('situacao'), '')
  assert.equal(ultimaLista().situacao, undefined)
  // o texto digitado repetido sem mudar não gera nova consulta nem reinicia a página
  await clicar(botaoPorTexto('Próxima'))
  const antes = doEndpoint('/api/produtos').length
  await digitar(campoBusca(), 'leite ')
  await esperar(450)
  assert.equal(doEndpoint('/api/produtos').length, antes)
  assert.equal(textoPagina(), 'Página 2 de 3')
})
