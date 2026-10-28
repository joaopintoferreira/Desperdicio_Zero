// Fase 5 — consistência entre indicadores, classificação e a base de dados (RNF06; PDF cenários 14 e 15).
// O "oráculo" abaixo calcula tudo de outro jeito (diferença de dias com Date.UTC, lendo a tabela direto
// no SQLite), para não repetir a lógica do backend.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, HOJE_FIXO } = require('./helpers');

let api;
before(async () => { api = await iniciarApi(); });
after(async () => { await api.fechar(); });
beforeEach(() => { api.db.exec("DELETE FROM produtos; DELETE FROM sqlite_sequence WHERE name='produtos'"); });

const UM_DIA = 86_400_000;
const utc = (iso) => { const [a, m, d] = iso.split('-').map(Number); return Date.UTC(a, m - 1, d); };

// Situação pela diferença de dias: < 0 vencido · 0..7 a vencer · > 7 dentro.
function situacaoOraculo(validade, hoje) {
  const dias = (utc(validade) - utc(hoje)) / UM_DIA;
  if (dias < 0) return 'vencido';
  return dias <= 7 ? 'proximo' : 'dentro';
}

function indicadoresOraculo(hoje) {
  const linhas = api.db.prepare('SELECT quantidade, preco_unitario, data_validade FROM produtos').all();
  let valor = 0n;
  let vencidos = 0;
  let aVencer = 0;
  for (const l of linhas) {
    const s = situacaoOraculo(l.data_validade, hoje);
    if (s === 'vencido') vencidos += 1;
    if (s === 'proximo') { aVencer += 1; valor += BigInt(l.quantidade) * BigInt(l.preco_unitario); }
  }
  return { total: linhas.length, vencidos, aVencer, valor };
}

// Gerador pseudoaleatório com semente fixa (mulberry32): o teste é reproduzível.
function gerador(semente) {
  let a = semente;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const somar = (iso, dias) => new Date(utc(iso) + dias * UM_DIA).toISOString().slice(0, 10);

function semear(n, semente) {
  const rnd = gerador(semente);
  const ins = api.db.prepare('INSERT INTO produtos (nome,codigo,categoria,quantidade,preco_unitario,data_validade) VALUES (?,?,?,?,?,?)');
  const cats = ['Laticínios', 'Grãos', 'Bebidas', 'Frios', 'Padaria'];
  for (let i = 0; i < n; i += 1) {
    const offset = Math.floor(rnd() * 41) - 15; // de −15 a +25 dias: cruza as duas fronteiras
    const quantidade = rnd() < 0.1 ? 0 : Math.floor(rnd() * 500);
    const preco = rnd() < 0.1 ? 0 : Math.floor(rnd() * 100_000);
    ins.run(`Produto ${i}`, `S${semente}-${i}`, cats[Math.floor(rnd() * cats.length)], quantidade, preco, somar(HOJE_FIXO, offset));
  }
}

describe('indicadores × base de dados', () => {
  for (const semente of [1, 2, 3, 42, 2026]) {
    test(`300 produtos pseudoaleatórios (semente ${semente}): API = oráculo`, async () => {
      semear(300, semente);
      const esperado = indicadoresOraculo(HOJE_FIXO);
      const r = await api.req('GET', '/api/indicadores');
      assert.equal(r.status, 200);
      assert.equal(r.corpo.total_produtos, esperado.total);
      assert.equal(r.corpo.produtos_vencidos, esperado.vencidos);
      assert.equal(r.corpo.produtos_a_vencer, esperado.aVencer);
      assert.equal(BigInt(r.corpo.valor_em_risco), esperado.valor);
      assert.ok(esperado.vencidos > 0 && esperado.aVencer > 0, 'a amostra deve cruzar as fronteiras');
    });
  }

  test('o campo situacao de cada produto da API é igual ao do oráculo (todas as páginas)', async () => {
    semear(250, 7);
    let pagina = 1;
    let visto = 0;
    for (;;) {
      const r = await api.req('GET', `/api/produtos?pagina=${pagina}&limite=100`);
      for (const p of r.corpo.dados) {
        assert.equal(p.situacao, situacaoOraculo(p.data_validade, HOJE_FIXO), `${p.codigo} ${p.data_validade}`);
        visto += 1;
      }
      if (pagina >= r.corpo.paginacao.totalPaginas) break;
      pagina += 1;
    }
    assert.equal(visto, 250);
  });

  test('cada filtro de situação devolve exatamente os produtos do oráculo', async () => {
    semear(250, 11);
    for (const s of ['vencido', 'proximo', 'dentro']) {
      const esperados = api.db.prepare('SELECT codigo, data_validade FROM produtos ORDER BY data_validade, id').all()
        .filter((l) => situacaoOraculo(l.data_validade, HOJE_FIXO) === s).map((l) => l.codigo);
      const r = await api.req('GET', `/api/produtos?situacao=${s}&limite=100`);
      assert.equal(r.corpo.paginacao.total, esperados.length, s);
      assert.deepEqual(r.corpo.dados.map((p) => p.codigo), esperados.slice(0, 100), s);
    }
  });

  test('em todas as datas de −3 a +12 dias, a fronteira da classificação coincide com o oráculo', async () => {
    for (let off = -3; off <= 12; off += 1) {
      api.db.exec('DELETE FROM produtos');
      api.db.prepare('INSERT INTO produtos (nome,codigo,categoria,quantidade,preco_unitario,data_validade) VALUES (?,?,?,?,?,?)')
        .run('x', 'F', 'c', 2, 150, somar(HOJE_FIXO, off));
      const i = (await api.req('GET', '/api/indicadores')).corpo;
      const emRisco = off >= 0 && off <= 7;
      assert.equal(i.valor_em_risco, emRisco ? 300 : 0, `offset ${off}`);
      assert.equal(i.produtos_a_vencer, emRisco ? 1 : 0, `offset ${off}`);
      assert.equal(i.produtos_vencidos, off < 0 ? 1 : 0, `offset ${off}`);
    }
  });

  test('após uma sequência de criar, editar e excluir pela API, os indicadores seguem o oráculo', async () => {
    const corpo = (n, extra) => ({ nome: `P${n}`, codigo: `Q${n}`, categoria: 'c', quantidade: 3, preco_unitario: 111, data_validade: somar(HOJE_FIXO, 2), ...extra });
    const ids = [];
    for (let n = 0; n < 6; n += 1) ids.push((await api.req('POST', '/api/produtos', corpo(n, { data_validade: somar(HOJE_FIXO, n * 3 - 4) }))).corpo.id);
    const confere = async () => {
      const e = indicadoresOraculo(HOJE_FIXO);
      const i = (await api.req('GET', '/api/indicadores')).corpo;
      assert.deepEqual([i.total_produtos, i.produtos_vencidos, i.produtos_a_vencer, BigInt(i.valor_em_risco)],
        [e.total, e.vencidos, e.aVencer, e.valor]);
    };
    await confere();
    await api.req('PUT', `/api/produtos/${ids[0]}`, corpo(0, { quantidade: 9, preco_unitario: 1, data_validade: somar(HOJE_FIXO, 1) }));
    await confere();
    await api.req('DELETE', `/api/produtos/${ids[2]}`);
    await confere();
    await api.req('PUT', `/api/produtos/${ids[5]}`, corpo(5, { data_validade: somar(HOJE_FIXO, -1) }));
    await confere();
  });

  test('a tabela vazia dá zeros e o oráculo concorda', async () => {
    const e = indicadoresOraculo(HOJE_FIXO);
    assert.deepEqual(e, { total: 0, vencidos: 0, aVencer: 0, valor: 0n });
    assert.equal((await api.req('GET', '/api/indicadores')).corpo.valor_em_risco, 0);
  });
});
