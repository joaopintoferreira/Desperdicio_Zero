import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criarControleDeConsulta } from './consulta.js'

test('só a consulta mais recente é a atual', () => {
  const c = criarControleDeConsulta()
  const a = c.iniciar()
  assert.equal(c.atual(a), true)
  const b = c.iniciar()
  assert.equal(c.atual(a), false)
  assert.equal(c.atual(b), true)
})

test('resposta antiga que chega depois NÃO substitui a mais nova (simulação)', async () => {
  const c = criarControleDeConsulta()
  let tela = null
  const buscar = (valor, atrasoMs) => new Promise((r) => setTimeout(() => r(valor), atrasoMs))
  async function carregar(valor, atrasoMs) {
    const id = c.iniciar()
    const r = await buscar(valor, atrasoMs)
    if (c.atual(id)) tela = r
  }
  // a primeira consulta demora mais e termina DEPOIS da segunda
  await Promise.all([carregar('antiga', 40), carregar('nova', 5)])
  assert.equal(tela, 'nova')
})

test('sequência normal: cada resposta aplica quando ainda é a última', async () => {
  const c = criarControleDeConsulta()
  const id1 = c.iniciar()
  assert.equal(c.atual(id1), true)
  const id2 = c.iniciar()
  assert.equal(c.atual(id2), true)
})
