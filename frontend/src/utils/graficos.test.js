import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIMITE_CATEGORIAS_GRAFICO, categoriasDoGrafico, formatarPercentual, larguraBarras, percentual, segmentosRosca } from './graficos.js'

test('percentual com 1 casa decimal e total zero', () => {
  assert.equal(percentual(1, 3), 33.3)
  assert.equal(percentual(2, 3), 66.7)
  assert.equal(percentual(3, 3), 100)
  assert.equal(percentual(0, 5), 0)
  assert.equal(percentual(5, 0), 0)
})

test('formatarPercentual usa vírgula decimal pt-BR', () => {
  assert.equal(formatarPercentual(33.3), '33,3%')
  assert.equal(formatarPercentual(100), '100,0%')
  assert.equal(formatarPercentual(0), '0,0%')
})

test('larguraBarras: proporcional ao maior; tudo zero => zeros', () => {
  assert.deepEqual(larguraBarras([5000, 2500, 0]), [100, 50, 0])
  assert.deepEqual(larguraBarras([0, 0]), [0, 0])
  assert.deepEqual(larguraBarras([]), [])
  assert.deepEqual(larguraBarras([7]), [100])
  assert.deepEqual(larguraBarras([1, 3]), [33.3, 100])
})

test('segmentosRosca: comprimentos somam a circunferência e deslocamentos acumulam', () => {
  const { circunferencia, segmentos } = segmentosRosca([
    { chave: 'a', valor: 1 }, { chave: 'b', valor: 1 }, { chave: 'c', valor: 2 },
  ], 50)
  assert.ok(Math.abs(circunferencia - 2 * Math.PI * 50) < 1e-9)
  assert.equal(segmentos.length, 3)
  const soma = segmentos.reduce((s, x) => s + x.comprimento, 0)
  assert.ok(Math.abs(soma - circunferencia) < 1e-9)
  assert.equal(segmentos[0].deslocamento, -0)
  assert.ok(Math.abs(segmentos[1].deslocamento + segmentos[0].comprimento) < 1e-9)
  assert.ok(Math.abs(segmentos[2].comprimento - circunferencia / 2) < 1e-9)
})

test('segmentosRosca: itens zerados não geram segmento; total zero => nenhum', () => {
  assert.deepEqual(segmentosRosca([{ chave: 'a', valor: 0 }, { chave: 'b', valor: 4 }], 10).segmentos.map((s) => s.chave), ['b'])
  assert.equal(segmentosRosca([{ chave: 'a', valor: 0 }], 10).segmentos.length, 0)
})

const cat = (categoria, valor) => ({ categoria, valor_em_risco: valor })

test('o limite do gráfico é 10', () => assert.equal(LIMITE_CATEGORIAS_GRAFICO, 10))

test('categoriasDoGrafico: até 10 categorias mostra todas; mais que isso, as 10 de maior valor', () => {
  const lista = (n) => Array.from({ length: n }, (_, i) => cat(`C${i}`, i * 10))
  assert.equal(categoriasDoGrafico(lista(3)).exibidas.length, 3)
  assert.equal(categoriasDoGrafico(lista(10)).exibidas.length, 10)
  assert.equal(categoriasDoGrafico(lista(10)).omitidas, 0)
  const onze = categoriasDoGrafico(lista(11))
  assert.equal(onze.exibidas.length, 10)
  assert.equal(onze.omitidas, 1)
  assert.deepEqual(onze.exibidas.map((c) => c.valor_em_risco), [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]) // o 0 saiu
  assert.deepEqual(categoriasDoGrafico([]), { exibidas: [], omitidas: 0 })
})

test('categoriasDoGrafico: ordem decrescente; empate pelo nome (sem diferenciar caixa e acento)', () => {
  const r = categoriasDoGrafico([cat('beta', 100), cat('Álcool', 100), cat('alfa', 100), cat('Zeta', 900), cat('Alfa', 100)])
  assert.deepEqual(r.exibidas.map((c) => c.categoria), ['Zeta', 'Álcool', 'Alfa', 'alfa', 'beta'])
})

test('categoriasDoGrafico: determinístico (mesma saída para qualquer ordem de entrada) e sem alterar a entrada', () => {
  const base = [cat('B', 5), cat('A', 5), cat('C', 5), cat('D', 9), cat('E', 0)]
  const esperado = categoriasDoGrafico(base).exibidas.map((c) => c.categoria)
  assert.deepEqual(esperado, ['D', 'A', 'B', 'C', 'E'])
  assert.deepEqual(categoriasDoGrafico([...base].reverse()).exibidas.map((c) => c.categoria), esperado)
  const copia = JSON.stringify(base)
  categoriasDoGrafico(base, 2)
  assert.equal(JSON.stringify(base), copia)
})

test('categoriasDoGrafico: limite personalizado e empate no corte', () => {
  const r = categoriasDoGrafico([cat('B', 7), cat('A', 7), cat('C', 7)], 2)
  assert.deepEqual(r.exibidas.map((c) => c.categoria), ['A', 'B']) // C fica de fora, sempre
  assert.equal(r.omitidas, 1)
})
