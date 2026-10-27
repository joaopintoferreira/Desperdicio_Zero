// Utilitários de teste: sobe a API numa porta efêmera com banco SQLite em memória.
const { criarConexao } = require('../src/db/connection');
const { criarApp } = require('../src/app');

async function iniciarApi() {
  const db = criarConexao(':memory:');
  const servidor = await new Promise((resolve) => {
    const s = criarApp(db).listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function req(metodo, caminho, corpo, opcoes = {}) {
    const resp = await fetch(base + caminho, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: opcoes.bruto ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
    });
    const texto = await resp.text();
    return { status: resp.status, corpo: texto ? JSON.parse(texto) : null, headers: resp.headers };
  }

  return {
    db,
    req,
    base,
    contar: () => db.prepare('SELECT COUNT(*) AS n FROM produtos').get().n,
    fechar: () => new Promise((resolve) => { servidor.close(resolve); db.close(); }),
  };
}

const produtoValido = (extra = {}) => ({
  nome: 'Leite Integral 1L',
  codigo: 'LEI001',
  categoria: 'Laticínios',
  quantidade: 10,
  preco_unitario: 599,
  data_validade: '2026-11-15',
  ...extra,
});

module.exports = { iniciarApi, produtoValido };
