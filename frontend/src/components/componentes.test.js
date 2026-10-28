// Testes de renderização dos componentes (react-dom/server, sem navegador). Verificam o HTML
// produzido em cada estado a partir das props; cliques e foco dependem de navegador (checklist manual).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'
import Sidebar, { ITENS_MENU } from './Sidebar.jsx'
import Header from './Header.jsx'
import Indicadores from './Indicadores.jsx'
import GraficosIndicadores from './graficos/GraficosIndicadores.jsx'
import RoscaSituacao from './graficos/RoscaSituacao.jsx'
import BarrasValorCategoria from './graficos/BarrasValorCategoria.jsx'
import TabelaCategorias from './TabelaCategorias.jsx'
import AlertaEstoqueBaixo from './AlertaEstoqueBaixo.jsx'
import ProdutoCard from './ProdutoCard.jsx'
import SeloSituacao from './SeloSituacao.jsx'

const noop = () => {}
const DADOS = {
  total_produtos: 4, produtos_vencidos: 1, produtos_a_vencer: 2, produtos_dentro: 1,
  valor_em_risco: 7400, produtos_estoque_baixo: 1, janela_alerta_dias: 7, data_referencia: '2026-11-10',
  por_categoria: [
    { categoria: 'Laticínios', total_produtos: 2, produtos_vencidos: 0, produtos_a_vencer: 2, produtos_dentro: 0, valor_em_risco: 7400 },
    { categoria: 'Grãos', total_produtos: 2, produtos_vencidos: 1, produtos_a_vencer: 0, produtos_dentro: 1, valor_em_risco: 0 },
  ],
}
const estado = (extra) => ({ dados: null, erro: '', carregando: false, recarregar: noop, ...extra })

test('menu: tem Home, Produtos e Relatórios', () => {
  assert.deepEqual(ITENS_MENU.map((i) => i.rotulo), ['Home', 'Produtos', 'Relatórios'])
  const html = render(h(Sidebar, { ativo: 'relatorios', onSelecionar: noop, onFechar: noop }))
  for (const r of ['Home', 'Produtos', 'Relatórios']) assert.ok(html.includes(r), r)
  assert.ok(html.includes('aria-current="page"'))
  assert.equal(html.match(/aria-current="page"/g).length, 1)
})

test('menu hambúrguer: botão real com nome, aria-expanded e aria-controls', () => {
  const fechado = render(h(Header, { titulo: 'Home', menuAberto: false, onAlternarMenu: noop }))
  assert.match(fechado, /<button[^>]*type="button"[^>]*class="menu-botao"/)
  assert.ok(fechado.includes('aria-label="Menu de navegação"'))
  assert.ok(fechado.includes('aria-expanded="false"'))
  assert.ok(fechado.includes('aria-controls="menu-lateral"'))
  const aberto = render(h(Header, { titulo: 'Home', menuAberto: true, onAlternarMenu: noop }))
  assert.ok(aberto.includes('aria-expanded="true"'))
})

test('gaveta: id alvo do aria-controls, botão Fechar e estado aberto/fechado', () => {
  const fechada = render(h(Sidebar, { ativo: 'home', onSelecionar: noop, onFechar: noop, aberto: false }))
  assert.ok(fechada.includes('id="menu-lateral"'))
  assert.ok(fechada.includes('aria-label="Fechar menu"'))
  assert.ok(!fechada.includes('sidebar--aberta'))
  assert.ok(!fechada.includes('sidebar__fundo--visivel'))
  const aberta = render(h(Sidebar, { ativo: 'home', onSelecionar: noop, onFechar: noop, aberto: true }))
  assert.ok(aberta.includes('sidebar--aberta'))
  assert.ok(aberta.includes('sidebar__fundo--visivel'))
})

test('cards: valores e textos a partir dos dados', () => {
  const html = render(h(Indicadores, { estado: estado({ dados: DADOS }) }))
  assert.ok(html.includes('Total de produtos') && html.includes('<dd>4</dd>'))
  assert.ok(html.includes('<dd>1</dd>') && html.includes('<dd>2</dd>'))
  assert.ok(html.includes('R$ 74,00'))
  assert.ok(html.includes('A vencer em 7 dias'))
  assert.ok(html.includes('não é prejuízo confirmado'))
  assert.ok(html.includes('10/11/2026'))
})

test('cards: carregando e erro (sem valores)', () => {
  assert.ok(render(h(Indicadores, { estado: estado({ carregando: true }) })).includes('Carregando indicadores'))
  const erro = render(h(Indicadores, { estado: estado({ erro: 'Servidor fora do ar' }) }))
  assert.ok(erro.includes('role="alert"') && erro.includes('Servidor fora do ar') && erro.includes('Tentar novamente'))
  assert.ok(!erro.includes('R$'))
})

test('gráficos: estados carregando, erro, vazio e com dados', () => {
  assert.ok(render(h(GraficosIndicadores, { estado: estado({ carregando: true }) })).includes('Carregando gráficos'))
  const erro = render(h(GraficosIndicadores, { estado: estado({ erro: 'falhou' }) }))
  assert.ok(erro.includes('role="alert"') && erro.includes('Tentar novamente') && !erro.includes('<svg'))
  const vazio = render(h(GraficosIndicadores, { estado: estado({ dados: { ...DADOS, total_produtos: 0, produtos_vencidos: 0, produtos_a_vencer: 0, produtos_dentro: 0, valor_em_risco: 0, por_categoria: [] } }) }))
  assert.ok(vazio.includes('Nenhum produto cadastrado') && !vazio.includes('<svg'))
  const ok = render(h(GraficosIndicadores, { estado: estado({ dados: DADOS }) }))
  assert.ok(ok.includes('Situação dos produtos') && ok.includes('Valor estimado em risco por categoria') && ok.includes('<svg'))
})

test('rosca: legenda em texto com contagens e percentuais; resumo acessível; segmentos', () => {
  const html = render(h(RoscaSituacao, { vencidos: 1, aVencer: 2, dentro: 1, janelaDias: 7 }))
  assert.ok(html.includes('role="img"'))
  assert.ok(html.includes('Vencidos: 1 (25,0%)'))
  assert.ok(html.includes('A vencer em 7 dias: 2 (50,0%)'))
  assert.ok(html.includes('Dentro da validade: 1 (25,0%)'))
  for (const s of ['vencido', 'proximo', 'dentro']) assert.ok(html.includes(`data-segmento="${s}"`), s)
  assert.ok(html.includes('>4</text>'))
})

test('rosca: situação com 0 produtos não gera segmento, mas aparece na legenda com 0', () => {
  const html = render(h(RoscaSituacao, { vencidos: 0, aVencer: 3, dentro: 0, janelaDias: 7 }))
  assert.ok(!html.includes('data-segmento="vencido"') && !html.includes('data-segmento="dentro"'))
  assert.ok(html.includes('data-segmento="proximo"'))
  assert.ok(html.includes('Vencidos: 0 (0,0%)'))
})

test('barras: valor em R$ por categoria, larguras proporcionais e nota de estimativa', () => {
  const html = render(h(BarrasValorCategoria, { categorias: DADOS.por_categoria, valorTotal: 7400, janelaDias: 7 }))
  assert.ok(html.includes('Laticínios') && html.includes('R$ 74,00'))
  assert.ok(html.includes('Grãos') && html.includes('R$ 0,00'))
  assert.ok(html.includes('data-largura="100"') && html.includes('data-largura="0"'))
  assert.ok(html.includes('não é prejuízo confirmado'))
})

test('barras: valor total zero mostra mensagem em vez de barras vazias', () => {
  const html = render(h(BarrasValorCategoria, { categorias: [], valorTotal: 0, janelaDias: 7 }))
  assert.ok(html.includes('Nenhum valor em risco') && html.includes('R$ 0,00'))
  assert.ok(!html.includes('barras__linha'))
})

test('tabela do relatório: linhas, totais por categoria e estado vazio', () => {
  const html = render(h(TabelaCategorias, { categorias: DADOS.por_categoria, janelaDias: 7 }))
  assert.ok(html.includes('<caption>Indicadores por categoria</caption>'))
  assert.ok(html.includes('scope="row">Laticínios') && html.includes('R$ 74,00'))
  assert.ok(render(h(TabelaCategorias, { categorias: [], janelaDias: 7 })).includes('Nenhum produto cadastrado'))
})

test('alerta de estoque baixo: texto, singular/plural e ausência quando 0', () => {
  assert.equal(render(h(AlertaEstoqueBaixo, { quantidade: 0 })), '')
  assert.equal(render(h(AlertaEstoqueBaixo, {})), '')
  assert.ok(render(h(AlertaEstoqueBaixo, { quantidade: 1 })).includes('1 produto está com estoque baixo'))
  assert.ok(render(h(AlertaEstoqueBaixo, { quantidade: 3 })).includes('3 produtos estão com estoque baixo'))
})

test('card de produto: selo de situação, selo de estoque baixo e mínimo', () => {
  const base = { id: 1, nome: 'Leite', codigo: 'L1', categoria: 'Laticínios', quantidade: 2, preco_unitario: 599, data_validade: '2026-11-12', situacao: 'proximo' }
  const baixo = render(h(ProdutoCard, { produto: { ...base, estoque_minimo: 5, estoque_baixo: true }, onEditar: noop, onExcluir: noop }))
  assert.ok(baixo.includes('A vencer') && baixo.includes('Estoque baixo') && baixo.includes('mínimo 5') && baixo.includes('R$ 5,99'))
  const normal = render(h(ProdutoCard, { produto: { ...base, estoque_minimo: 0, estoque_baixo: false }, onEditar: noop, onExcluir: noop }))
  assert.ok(!normal.includes('Estoque baixo') && !normal.includes('mínimo'))
  assert.equal(render(h(SeloSituacao, { situacao: 'inexistente' })), '')
})
