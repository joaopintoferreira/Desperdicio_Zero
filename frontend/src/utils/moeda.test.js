import { test } from 'node:test'
import assert from 'node:assert/strict'
import { centavosParaReais, centavosParaCampo, reaisParaCentavos } from './moeda.js'
import { formatarData } from './data.js'

test('centavosParaReais formata como R$ X,XX', () => {
  assert.equal(centavosParaReais(0), 'R$ 0,00')
  assert.equal(centavosParaReais(5), 'R$ 0,05')
  assert.equal(centavosParaReais(599), 'R$ 5,99')
  assert.equal(centavosParaReais(500), 'R$ 5,00')
  assert.equal(centavosParaReais(123456), 'R$ 1.234,56')
})

test('reaisParaCentavos converte sem erro de ponto flutuante', () => {
  assert.equal(reaisParaCentavos('5,99'), 599)
  assert.equal(reaisParaCentavos('5.99'), 599)
  assert.equal(reaisParaCentavos('0,1'), 10)
  assert.equal(reaisParaCentavos('19,90'), 1990)
  assert.equal(reaisParaCentavos('1.234,56'), 123456)
  assert.equal(reaisParaCentavos('R$ 7'), 700)
  assert.equal(reaisParaCentavos('0'), 0)
  assert.equal(reaisParaCentavos('1,15'), 115) // 1.15*100 em float daria 114.99999
})

test('reaisParaCentavos rejeita entradas inválidas', () => {
  for (const t of ['', 'abc', '-5', '5,999', '1,2,3', '5,', ',5', '1e3']) {
    assert.equal(reaisParaCentavos(t), null, `"${t}"`)
  }
})

test('ida e volta campo <-> centavos', () => {
  for (const c of [0, 1, 99, 100, 1990, 123456]) {
    assert.equal(reaisParaCentavos(centavosParaCampo(c)), c)
  }
})

test('formatarData converte YYYY-MM-DD para DD/MM/AAAA', () => {
  assert.equal(formatarData('2026-11-05'), '05/11/2026')
})
