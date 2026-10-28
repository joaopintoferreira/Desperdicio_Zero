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

// ---- Fase 5: fronteiras ----
test('reaisParaCentavos: entradas ambíguas ou perigosas', () => {
  assert.equal(reaisParaCentavos('1.000'), null) // sem vírgula, 3 casas: recusa em vez de adivinhar 1000 ou 1,000
  assert.equal(reaisParaCentavos('1.000,00'), 100000)
  assert.equal(reaisParaCentavos('1.5'), 150)
  assert.equal(reaisParaCentavos('1,5'), 150)
  assert.equal(reaisParaCentavos('00,50'), 50)
  assert.equal(reaisParaCentavos('0,00'), 0)
  assert.equal(reaisParaCentavos('  12,34  '), 1234)
  assert.equal(reaisParaCentavos('R$12,34'), 1234)
  assert.equal(reaisParaCentavos('99999999999999999999'), null) // acima dos inteiros seguros
  assert.equal(reaisParaCentavos('9007199254740991'), null) // × 100 estoura o limite seguro
  for (const t of ['--1', '1,2e3', '0x10', '1 000', 'NaN', 'Infinity', '٣,٥']) assert.equal(reaisParaCentavos(t), null, t)
})

test('centavosParaReais: limites usados pelo sistema', () => {
  assert.equal(centavosParaReais(1_000_000_000), 'R$ 10.000.000,00') // preço máximo aceito pela API
  assert.equal(centavosParaReais(7400), 'R$ 74,00') // exemplo do PDF
  assert.equal(centavosParaReais(1), 'R$ 0,01')
  assert.equal(centavosParaReais(99), 'R$ 0,99')
  assert.equal(centavosParaReais(100), 'R$ 1,00')
  assert.equal(centavosParaReais(Number.MAX_SAFE_INTEGER), 'R$ 90.071.992.547.409,91')
})

test('centavosParaCampo e volta em muitos valores (sem erro de arredondamento)', () => {
  for (let c = 0; c <= 20000; c += 7) assert.equal(reaisParaCentavos(centavosParaCampo(c)), c)
  assert.equal(centavosParaCampo(5), '0,05')
})

test('formatarData: dias e meses com um dígito e extremos', () => {
  assert.equal(formatarData('2026-01-02'), '02/01/2026')
  assert.equal(formatarData('1900-01-01'), '01/01/1900')
  assert.equal(formatarData('2100-12-31'), '31/12/2100')
})

test('reaisParaCentavos: espaço no meio é erro de digitação e não vira outro valor', () => {
  assert.equal(reaisParaCentavos('5 99'), null) // antes virava 599 (R$ 599,00) em silêncio
  assert.equal(reaisParaCentavos('1 0'), null)
  assert.equal(reaisParaCentavos('R$ 5,99'), 599)
  assert.equal(reaisParaCentavos('R$   5,99'), 599)
})
