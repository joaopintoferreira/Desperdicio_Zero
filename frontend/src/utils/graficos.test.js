import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatarPercentual, larguraBarras, percentual, segmentosRosca } from './graficos.js'

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
