// Fase 5 — fluxos principais, de ponta a ponta: pela API em memória e pelo processo real do servidor.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { iniciarApi, produtoValido } = require('./helpers');

describe('fluxo principal pela API (relógio fixo em 2026-11-10)', () => {
  let api;
  before(async () => { api = await iniciarApi(); });
  after(async () => { await api.fechar(); });

  test('cadastrar → listar → filtrar → indicadores → editar → buscar → excluir', async () => {
    // 1. cadastro de três produtos em situações diferentes
    const leite = (await api.req('POST', '/api/produtos', produtoValido({ nome: 'Leite', codigo: 'L1', categoria: 'Laticínios', quantidade: 10, preco_unitario: 500, data_validade: '2026-11-12' }))).corpo;
    const arroz = (await api.req('POST', '/api/produtos', produtoValido({ nome: 'Arroz', codigo: 'A1', categoria: 'Grãos', quantidade: 5, preco_unitario: 2000, data_validade: '2026-11-01' }))).corpo;
    await api.req('POST', '/api/produtos', produtoValido({ nome: 'Feijão', codigo: 'F1', categoria: 'Grãos', quantidade: 8, preco_unitario: 300, data_validade: '2027-03-01' }));
    assert.deepEqual([leite.situacao, arroz.situacao], ['proximo', 'vencido']);

    // 2. listagem em ordem de validade (vencido primeiro)
    let lista = (await api.req('GET', '/api/produtos')).corpo;
    assert.deepEqual(lista.dados.map((p) => p.codigo), ['A1', 'L1', 'F1']);

    // 3. filtros e busca
    assert.deepEqual((await api.req('GET', '/api/produtos?situacao=vencido')).corpo.dados.map((p) => p.codigo), ['A1']);
    assert.deepEqual((await api.req('GET', '/api/produtos?categoria=Gr%C3%A3os')).corpo.dados.map((p) => p.codigo), ['A1', 'F1']);
    assert.deepEqual((await api.req('GET', '/api/produtos?busca=le')).corpo.dados.map((p) => p.codigo), ['L1']);
    assert.deepEqual((await api.req('GET', '/api/categorias')).corpo.dados, ['Grãos', 'Laticínios']);

    // 4. indicadores: 3 produtos, 1 vencido, 1 a vencer, valor = 10 × R$ 5,00 = R$ 50,00
    let ind = (await api.req('GET', '/api/indicadores')).corpo;
    assert.deepEqual([ind.total_produtos, ind.produtos_vencidos, ind.produtos_a_vencer, ind.valor_em_risco], [3, 1, 1, 5000]);

    // 5. editar: o arroz vencido ganha nova validade e entra na janela
    const ed = await api.req('PUT', `/api/produtos/${arroz.id}`, produtoValido({ nome: 'Arroz', codigo: 'A1', categoria: 'Grãos', quantidade: 5, preco_unitario: 2000, data_validade: '2026-11-17' }));
    assert.equal(ed.corpo.situacao, 'proximo');
    ind = (await api.req('GET', '/api/indicadores')).corpo;
    assert.deepEqual([ind.produtos_vencidos, ind.produtos_a_vencer, ind.valor_em_risco], [0, 2, 15000]);

    // 6. excluir o leite
    assert.equal((await api.req('DELETE', `/api/produtos/${leite.id}`)).status, 204);
    assert.equal((await api.req('GET', `/api/produtos/${leite.id}`)).status, 404);
    ind = (await api.req('GET', '/api/indicadores')).corpo;
    assert.deepEqual([ind.total_produtos, ind.produtos_a_vencer, ind.valor_em_risco], [2, 1, 10000]);

    // 7. categoria "Laticínios" deixou de existir
    assert.deepEqual((await api.req('GET', '/api/categorias')).corpo.dados, ['Grãos']);
    lista = (await api.req('GET', '/api/produtos')).corpo;
    assert.equal(lista.paginacao.total, 2);
  });

  test('operações inválidas no meio do fluxo não deixam rastros', async () => {
    const antes = JSON.stringify((await api.req('GET', '/api/produtos')).corpo) + JSON.stringify((await api.req('GET', '/api/indicadores')).corpo);
    await api.req('POST', '/api/produtos', produtoValido({ quantidade: -1 }));
    await api.req('POST', '/api/produtos', produtoValido({ codigo: 'A1' })); // duplicado
    await api.req('PUT', '/api/produtos/99999', produtoValido());
    await api.req('DELETE', '/api/produtos/99999');
    const depois = JSON.stringify((await api.req('GET', '/api/produtos')).corpo) + JSON.stringify((await api.req('GET', '/api/indicadores')).corpo);
    assert.equal(depois, antes);
  });
});

describe('processo real do servidor (server.js) com banco temporário', () => {
  const raiz = path.join(__dirname, '..');
  let dir;
  before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dz-srv-')); });
  after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const portaLivre = () => new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });

  async function iniciar(env) {
    const porta = await portaLivre();
    const filho = spawn(process.execPath, ['src/server.js'], {
      cwd: raiz, env: { ...process.env, PORT: String(porta), DB_PATH: path.join(dir, 'real.db'), ...env },
    });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('servidor não iniciou')), 10_000);
      filho.stdout.on('data', (d) => { if (String(d).includes('http://localhost')) { clearTimeout(t); resolve(); } });
      filho.on('exit', (c) => { clearTimeout(t); reject(new Error(`servidor saiu com código ${c}`)); });
    });
    const base = `http://127.0.0.1:${porta}/api`;
    const parar = () => new Promise((resolve) => { filho.once('exit', resolve); filho.kill(); });
    return { base, parar };
  }

  test('inicia, responde ao health e persiste dados após reiniciar o processo', async () => {
    let srv = await iniciar();
    try {
      const h = await fetch(`${srv.base}/health`);
      assert.equal(h.status, 200);
      assert.deepEqual(await h.json(), { status: 'ok' });
      const c = await fetch(`${srv.base}/produtos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(produtoValido({ codigo: 'PERSIST' })) });
      assert.equal(c.status, 201);
    } finally { await srv.parar(); }

    srv = await iniciar(); // novo processo, mesmo arquivo de banco
    try {
      const r = await (await fetch(`${srv.base}/produtos?busca=PERSIST`)).json();
      assert.equal(r.paginacao.total, 1);
      assert.match(r.dados[0].situacao, /^(vencido|proximo|dentro)$/); // relógio real: só o formato é conferido
      const ind = await (await fetch(`${srv.base}/indicadores`)).json();
      assert.equal(ind.total_produtos, 1);
      assert.match(ind.data_referencia, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(ind.janela_alerta_dias, 7);
    } finally { await srv.parar(); }
  });

  test('APP_TIME_ZONE inválido impede a inicialização com mensagem clara e código 1', () => {
    const r = spawnSync(process.execPath, ['src/server.js'], {
      cwd: raiz, encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, PORT: '0', DB_PATH: path.join(dir, 'tz.db'), APP_TIME_ZONE: 'Marte/Olimpo' },
    });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /APP_TIME_ZONE inválido: "Marte\/Olimpo"/);
  });

  test('APP_TIME_ZONE válido é aceito e o servidor inicia', async () => {
    const srv = await iniciar({ APP_TIME_ZONE: 'America/Manaus' });
    try {
      assert.equal((await fetch(`${srv.base}/health`)).status, 200);
    } finally { await srv.parar(); }
  });

  test('CORS: origem local do frontend é aceita e origem estranha não recebe cabeçalho', async () => {
    const srv = await iniciar();
    try {
      const ok = await fetch(`${srv.base}/health`, { headers: { Origin: 'http://localhost:5173' } });
      assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      const mau = await fetch(`${srv.base}/health`, { headers: { Origin: 'http://evil.example' } });
      assert.equal(mau.headers.get('access-control-allow-origin'), null);
    } finally { await srv.parar(); }
  });

  test('CORS_ORIGINS configura outra origem autorizada', async () => {
    const srv = await iniciar({ CORS_ORIGINS: 'http://exemplo.local:8080' });
    try {
      const r = await fetch(`${srv.base}/health`, { headers: { Origin: 'http://exemplo.local:8080' } });
      assert.equal(r.headers.get('access-control-allow-origin'), 'http://exemplo.local:8080');
      const antigo = await fetch(`${srv.base}/health`, { headers: { Origin: 'http://localhost:5173' } });
      assert.equal(antigo.headers.get('access-control-allow-origin'), null);
    } finally { await srv.parar(); }
  });
});
