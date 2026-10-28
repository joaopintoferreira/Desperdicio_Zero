// Fase 6 — alerta de estoque baixo (limite mínimo por produto) e migração aditiva do banco.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { iniciarApi, produtoValido } = require('./helpers');
const { criarConexao } = require('../src/db/connection');
const { estoqueBaixo } = require('../src/services/estoqueService');

describe('regra de estoque baixo (unidade)', () => {
  test('limite 0 = sem alerta; alerta quando quantidade <= limite (> 0)', () => {
    assert.equal(estoqueBaixo(0, 0), false);
    assert.equal(estoqueBaixo(100, 0), false);
    assert.equal(estoqueBaixo(6, 5), false);
    assert.equal(estoqueBaixo(5, 5), true); // atingiu o mínimo
    assert.equal(estoqueBaixo(4, 5), true);
    assert.equal(estoqueBaixo(0, 5), true);
  });
});

describe('API — estoque mínimo', () => {
  let api;
  before(async () => { api = await iniciarApi(); });
  after(async () => { await api.fechar(); });
  beforeEach(() => { api.db.exec("DELETE FROM produtos; DELETE FROM sqlite_sequence WHERE name='produtos'"); });

  let seq = 0;
  const criar = (extra) => api.req('POST', '/api/produtos', produtoValido({ codigo: `E${++seq}`, ...extra }));

  test('campo ausente = 0 (sem alerta); informado é gravado e devolvido com estoque_baixo', async () => {
    const a = await criar({ quantidade: 3 });
    assert.deepEqual([a.corpo.estoque_minimo, a.corpo.estoque_baixo], [0, false]);
    const b = await criar({ quantidade: 3, estoque_minimo: 5 });
    assert.deepEqual([b.corpo.estoque_minimo, b.corpo.estoque_baixo], [5, true]);
    const c = await criar({ quantidade: 6, estoque_minimo: 5 });
    assert.deepEqual([c.corpo.estoque_minimo, c.corpo.estoque_baixo], [5, false]);
  });

  test('validação: negativo, decimal, texto, null, acima do limite → 400 sem gravar', async () => {
    for (const estoque_minimo of [-1, 1.5, '5', null, true, [], 1_000_001]) {
      const antes = api.contar();
      const r = await criar({ estoque_minimo });
      assert.equal(r.status, 400, JSON.stringify(estoque_minimo));
      assert.ok(r.corpo.detalhes.estoque_minimo);
      assert.equal(api.contar(), antes);
    }
    assert.equal((await criar({ estoque_minimo: 1_000_000 })).status, 201);
  });

  test('PUT sem o campo preserva o limite já configurado; PUT com o campo altera', async () => {
    const p = await criar({ quantidade: 10, estoque_minimo: 8 });
    const semCampo = await api.req('PUT', `/api/produtos/${p.corpo.id}`, produtoValido({ codigo: p.corpo.codigo, quantidade: 7 }));
    assert.deepEqual([semCampo.corpo.estoque_minimo, semCampo.corpo.estoque_baixo], [8, true]);
    const comCampo = await api.req('PUT', `/api/produtos/${p.corpo.id}`, produtoValido({ codigo: p.corpo.codigo, quantidade: 7, estoque_minimo: 0 }));
    assert.deepEqual([comCampo.corpo.estoque_minimo, comCampo.corpo.estoque_baixo], [0, false]);
  });

  test('PUT de id inexistente continua 404 (com ou sem o campo)', async () => {
    assert.equal((await api.req('PUT', '/api/produtos/9999', produtoValido())).status, 404);
    assert.equal((await api.req('PUT', '/api/produtos/9999', produtoValido({ estoque_minimo: 3 }))).status, 404);
  });

  test('editar a quantidade liga e desliga o alerta', async () => {
    const p = await criar({ quantidade: 10, estoque_minimo: 5 });
    const baixo = await api.req('PUT', `/api/produtos/${p.corpo.id}`, produtoValido({ codigo: p.corpo.codigo, quantidade: 2 }));
    assert.equal(baixo.corpo.estoque_baixo, true);
    const ok = await api.req('PUT', `/api/produtos/${p.corpo.id}`, produtoValido({ codigo: p.corpo.codigo, quantidade: 50 }));
    assert.equal(ok.corpo.estoque_baixo, false);
  });

  test('filtro ?estoque=baixo devolve exatamente os produtos com estoque_baixo, combinável com os demais', async () => {
    await criar({ codigo: 'B1', nome: 'Leite A', quantidade: 2, estoque_minimo: 5, categoria: 'X', data_validade: '2026-11-12' });
    await criar({ codigo: 'B2', nome: 'Leite B', quantidade: 5, estoque_minimo: 5, categoria: 'Y', data_validade: '2026-11-01' });
    await criar({ codigo: 'OK', nome: 'Leite C', quantidade: 9, estoque_minimo: 5, categoria: 'X', data_validade: '2026-11-12' });
    await criar({ codigo: 'SEM', nome: 'Leite D', quantidade: 0, estoque_minimo: 0, categoria: 'X', data_validade: '2026-11-12' });
    const cod = async (q) => (await api.req('GET', `/api/produtos?${q}`)).corpo.dados.map((p) => p.codigo);
    assert.deepEqual(await cod('estoque=baixo'), ['B2', 'B1']);
    assert.deepEqual(await cod('estoque=baixo&categoria=X'), ['B1']);
    assert.deepEqual(await cod('estoque=baixo&situacao=vencido'), ['B2']);
    assert.deepEqual(await cod('estoque=baixo&busca=leite&situacao=proximo&categoria=X'), ['B1']);
    const todos = (await api.req('GET', '/api/produtos?limite=100')).corpo.dados;
    assert.deepEqual((await cod('estoque=baixo')).sort(), todos.filter((p) => p.estoque_baixo).map((p) => p.codigo).sort());
    assert.equal((await api.req('GET', '/api/produtos?estoque=baixo')).corpo.paginacao.total, 2);
    assert.equal((await api.req('GET', '/api/produtos?estoque=')).corpo.paginacao.total, 4);
  });

  test('?estoque inválido ou repetido → 400', async () => {
    for (const q of ['estoque=alto', 'estoque=BAIXO', 'estoque=baixo&estoque=baixo']) {
      assert.equal((await api.req('GET', `/api/produtos?${q}`)).status, 400, q);
    }
  });

  test('regra em SQL (filtro, contagem) e em JS (campo) coincidem em todas as combinações', async () => {
    for (let q = 0; q <= 6; q += 1) {
      for (let m = 0; m <= 6; m += 1) await criar({ quantidade: q, estoque_minimo: m });
    }
    const lista = (await api.req('GET', '/api/produtos?limite=100')).corpo.dados;
    const filtrados = (await api.req('GET', '/api/produtos?estoque=baixo&limite=100')).corpo.dados;
    assert.deepEqual(filtrados.map((p) => p.id), lista.filter((p) => p.estoque_baixo).map((p) => p.id));
    for (const p of lista) assert.equal(p.estoque_baixo, estoqueBaixo(p.quantidade, p.estoque_minimo));
    assert.equal((await api.req('GET', '/api/indicadores')).corpo.produtos_estoque_baixo, filtrados.length);
  });

  test('o banco recusa estoque_minimo negativo (CHECK) e usa 0 como padrão', () => {
    const ins = api.db.prepare('INSERT INTO produtos (nome,codigo,categoria,quantidade,preco_unitario,data_validade) VALUES (?,?,?,?,?,?)');
    ins.run('x', 'PADRAO', 'c', 1, 1, '2026-11-12');
    assert.equal(api.db.prepare("SELECT estoque_minimo e FROM produtos WHERE codigo='PADRAO'").get().e, 0);
    assert.throws(() => api.db.prepare("UPDATE produtos SET estoque_minimo = -1 WHERE codigo='PADRAO'").run(), /CHECK/);
  });
});

describe('migração aditiva do banco (cópia temporária; nunca o banco real)', () => {
  const ESQUEMA_ANTIGO = `
    CREATE TABLE produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, codigo TEXT NOT NULL UNIQUE, categoria TEXT NOT NULL,
      quantidade INTEGER NOT NULL CHECK (quantidade >= 0), preco_unitario INTEGER NOT NULL CHECK (preco_unitario >= 0),
      data_validade TEXT NOT NULL);
    CREATE INDEX idx_produtos_data_validade ON produtos (data_validade);`;
  const LINHAS = [
    ['Leite', 'L1', 'Laticínios', 10, 599, '2026-11-15'],
    ['Arroz', 'A1', 'Grãos', 0, 0, '2026-01-01'],
    ['Feijão', 'F1', 'Grãos', 7, 1999, '2027-03-01'],
  ];

  function criarBancoAntigo(dir) {
    const arquivo = path.join(dir, 'antigo.db');
    const db = new Database(arquivo);
    db.exec(ESQUEMA_ANTIGO);
    const ins = db.prepare('INSERT INTO produtos (nome,codigo,categoria,quantidade,preco_unitario,data_validade) VALUES (?,?,?,?,?,?)');
    for (const l of LINHAS) ins.run(...l);
    db.close();
    return arquivo;
  }

  test('adiciona a coluna, preserva todos os dados, grava backup e é idempotente', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-mig-'));
    const silencio = console.log; console.log = () => {};
    try {
      const arquivo = criarBancoAntigo(dir);
      const db = criarConexao(arquivo);
      const cols = db.prepare("PRAGMA table_info('produtos')").all();
      const col = cols.find((c) => c.name === 'estoque_minimo');
      assert.ok(col, 'coluna criada');
      assert.equal(col.notnull, 1);
      assert.equal(col.dflt_value, '0');

      // dados idênticos, e estoque_minimo = 0 em todos
      const linhas = db.prepare('SELECT nome,codigo,categoria,quantidade,preco_unitario,data_validade,estoque_minimo FROM produtos ORDER BY id').all();
      assert.deepEqual(linhas.map((l) => [l.nome, l.codigo, l.categoria, l.quantidade, l.preco_unitario, l.data_validade]), LINHAS);
      assert.ok(linhas.every((l) => l.estoque_minimo === 0));
      assert.throws(() => db.prepare('UPDATE produtos SET estoque_minimo = -1').run(), /CHECK/);
      db.close();

      // backup: existe, tem os dados originais e NÃO tem a coluna nova
      const pasta = path.join(dir, 'backups');
      const backups = fs.readdirSync(pasta);
      assert.equal(backups.length, 1);
      assert.match(backups[0], /^antigo-\d{8}-\d{6}-antes-estoque-minimo\.db$/);
      const bk = new Database(path.join(pasta, backups[0]), { readonly: true });
      assert.equal(bk.prepare('SELECT COUNT(*) n FROM produtos').get().n, 3);
      assert.ok(!bk.prepare("PRAGMA table_info('produtos')").all().some((c) => c.name === 'estoque_minimo'));
      bk.close();

      // segunda abertura: sem nova migração e sem novo backup
      const db2 = criarConexao(arquivo);
      assert.equal(db2.prepare('SELECT COUNT(*) n FROM produtos').get().n, 3);
      db2.close();
      assert.equal(fs.readdirSync(pasta).length, 1);
    } finally {
      console.log = silencio;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('após migrar, a API funciona sobre os dados antigos (situação, indicadores e alerta)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-mig-'));
    const silencio = console.log; console.log = () => {};
    const { criarApp } = require('../src/app');
    try {
      const db = criarConexao(criarBancoAntigo(dir));
      const servidor = await new Promise((r) => { const s = criarApp(db, { hoje: () => '2026-11-10' }).listen(0, '127.0.0.1', () => r(s)); });
      const base = `http://127.0.0.1:${servidor.address().port}/api`;
      const lista = await (await fetch(`${base}/produtos`)).json();
      assert.deepEqual(lista.dados.map((p) => [p.codigo, p.situacao, p.estoque_minimo, p.estoque_baixo]),
        [['A1', 'vencido', 0, false], ['L1', 'proximo', 0, false], ['F1', 'dentro', 0, false]]);
      const ind = await (await fetch(`${base}/indicadores`)).json();
      assert.deepEqual([ind.total_produtos, ind.produtos_vencidos, ind.produtos_a_vencer, ind.valor_em_risco], [3, 1, 1, 5990]);
      await new Promise((r) => servidor.close(r));
      db.close();
    } finally {
      console.log = silencio;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('banco novo já nasce com a coluna e não gera backup', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-mig-'));
    try {
      const db = criarConexao(path.join(dir, 'novo.db'));
      assert.ok(db.prepare("PRAGMA table_info('produtos')").all().some((c) => c.name === 'estoque_minimo'));
      db.close();
      assert.ok(!fs.existsSync(path.join(dir, 'backups')));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
