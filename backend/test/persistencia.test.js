const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarConexao } = require('../src/db/connection');
const { criarProdutoModel } = require('../src/models/produtoModel');
const { produtoValido } = require('./helpers');

test('dados persistem após fechar e reabrir o arquivo do banco', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-'));
  const arquivo = path.join(dir, 'teste.db');
  try {
    const db1 = criarConexao(arquivo);
    const id = criarProdutoModel(db1).inserir(produtoValido());
    db1.close();

    const db2 = criarConexao(arquivo); // reabrir não apaga nem recria dados
    assert.equal(criarProdutoModel(db2).buscarPorId(id).codigo, 'LEI001');
    db2.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
