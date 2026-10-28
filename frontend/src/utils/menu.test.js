import { test } from 'node:test'
import assert from 'node:assert/strict'
import { menuInicial, menuReducer } from './menu.js'

test('começa fechado', () => assert.deepEqual(menuInicial, { aberto: false }))

test('abrir, fechar e alternar', () => {
  assert.equal(menuReducer(menuInicial, { tipo: 'abrir' }).aberto, true)
  assert.equal(menuReducer({ aberto: true }, { tipo: 'fechar' }).aberto, false)
  assert.equal(menuReducer({ aberto: false }, { tipo: 'alternar' }).aberto, true)
  assert.equal(menuReducer({ aberto: true }, { tipo: 'alternar' }).aberto, false)
})

test('abrir é idempotente e fechar também', () => {
  assert.equal(menuReducer({ aberto: true }, { tipo: 'abrir' }).aberto, true)
  assert.equal(menuReducer({ aberto: false }, { tipo: 'fechar' }).aberto, false)
})

test('navegar para outra tela sempre fecha o menu', () => {
  assert.equal(menuReducer({ aberto: true }, { tipo: 'navegou' }).aberto, false)
  assert.equal(menuReducer({ aberto: false }, { tipo: 'navegou' }).aberto, false)
})

test('virar tela grande fecha a gaveta (sem estado aberto pendente)', () => {
  assert.equal(menuReducer({ aberto: true }, { tipo: 'virou-desktop' }).aberto, false)
})

test('ação desconhecida não altera o estado', () => {
  const estado = { aberto: true }
  assert.equal(menuReducer(estado, { tipo: 'qualquer' }), estado)
})
