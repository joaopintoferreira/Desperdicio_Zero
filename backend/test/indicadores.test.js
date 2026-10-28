const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, produtoValido, HOJE_FIXO } = require('./helpers');
const { centavosSeguros } = require('../src/services/indicadoresService');

// HOJE_FIXO = 2026-11-10 → vencido < 11-10 · a vencer 11-10..11-17 · dentro > 11-17
let api;
before(async () => { api = await iniciarApi(); });
after(async () => { await api.fechar(); });
beforeEach(() => { api.db.exec("DELETE FROM produtos; DELETE FROM sqlite_sequence WHERE name='produtos'"); });

let seq = 0;
const criar = (extra) => api.req('POST', '/api/produtos', produtoValido({ codigo: `P${++seq}`, ...extra }));
const indicadores = async () => {
  const r = await api.req('GET', '/api/indicadores');
  assert.equal(r.status, 200);
  return r.corpo;
};

describe('GET /api/indicadores — contrato', () => {
  test('sem produtos: tudo zero, sem erro (PDF cenário 16)', async () => {
    assert.deepEqual(await indicadores(), {
      total_produtos: 0, produtos_vencidos: 0, produtos_a_vencer: 0, produtos_dentro: 0, valor_em_risco: 0,
      produtos_estoque_baixo: 0, por_categoria: [], janela_alerta_dias: 7, data_referencia: HOJE_FIXO,
    });
  });

  test('só aceita GET; outros métodos caem no 404 em JSON', async () => {
    const r = await api.req('POST', '/api/indicadores', {});
    assert.equal(r.status, 404);
    assert.equal(r.corpo.erro, 'Rota não encontrada');
  });

  test('valor em risco é um inteiro (centavos), nunca decimal', async () => {
    await criar({ quantidade: 3, preco_unitario: 1999, data_validade: '2026-11-12' });
    const { valor_em_risco } = await indicadores();
    assert.ok(Number.isInteger(valor_em_risco));
  });
});

describe('RN04 — fórmula e critérios de inclusão (PDF cenário 15)', () => {
  test('exemplo do PDF: A 10×R$5,00 + B 8×R$3,00 = R$ 74,00', async () => {
    await criar({ nome: 'A', quantidade: 10, preco_unitario: 500, data_validade: '2026-11-12' });
    await criar({ nome: 'B', quantidade: 8, preco_unitario: 300, data_validade: '2026-11-15' });
    const i = await indicadores();
    assert.equal(i.valor_em_risco, 7400);
    assert.equal(i.produtos_a_vencer, 2);
  });

  test('janela inclusiva: hoje e hoje+7 entram; ontem e hoje+8 não', async () => {
    await criar({ quantidade: 1, preco_unitario: 100, data_validade: '2026-11-09' }); // ontem: vencido
    await criar({ quantidade: 1, preco_unitario: 200, data_validade: '2026-11-10' }); // hoje
    await criar({ quantidade: 1, preco_unitario: 400, data_validade: '2026-11-17' }); // +7
    await criar({ quantidade: 1, preco_unitario: 800, data_validade: '2026-11-18' }); // +8: dentro
    const i = await indicadores();
    assert.equal(i.valor_em_risco, 600);
    assert.equal(i.produtos_a_vencer, 2);
    assert.equal(i.produtos_vencidos, 1);
    assert.equal(i.total_produtos, 4);
  });

  test('vencidos e dentro da validade não entram no valor em risco', async () => {
    await criar({ quantidade: 100, preco_unitario: 10000, data_validade: '2020-01-01' });
    await criar({ quantidade: 100, preco_unitario: 10000, data_validade: '2030-01-01' });
    const i = await indicadores();
    assert.equal(i.valor_em_risco, 0);
    assert.equal(i.produtos_a_vencer, 0);
    assert.equal(i.produtos_vencidos, 1);
    assert.equal(i.total_produtos, 2);
  });

  test('quantidade zero: conta como "a vencer" e soma R$ 0,00', async () => {
    await criar({ quantidade: 0, preco_unitario: 999, data_validade: '2026-11-11' });
    const i = await indicadores();
    assert.equal(i.produtos_a_vencer, 1);
    assert.equal(i.valor_em_risco, 0);
  });

  test('preço zero: conta como "a vencer" e soma R$ 0,00', async () => {
    await criar({ quantidade: 50, preco_unitario: 0, data_validade: '2026-11-11' });
    const i = await indicadores();
    assert.equal(i.produtos_a_vencer, 1);
    assert.equal(i.valor_em_risco, 0);
  });

  test('vários produtos: agregado confere com cálculo independente em BigInt', async () => {
    const itens = [[3, 3333], [7, 1999], [1, 1], [12, 5], [999, 7], [0, 500], [4, 0]];
    for (const [quantidade, preco_unitario] of itens) {
      await criar({ quantidade, preco_unitario, data_validade: '2026-11-14' });
    }
    const esperado = itens.reduce((acc, [q, p]) => acc + BigInt(q) * BigInt(p), 0n);
    const i = await indicadores();
    assert.equal(BigInt(i.valor_em_risco), esperado);
    assert.equal(i.produtos_a_vencer, itens.length);
  });

  test('precisão em centavos: soma de valores que em ponto flutuante falhariam', async () => {
    // 0,10 + 0,20 em float = 0.30000000000000004; em centavos inteiros = 30 exato
    await criar({ quantidade: 1, preco_unitario: 10, data_validade: '2026-11-11' });
    await criar({ quantidade: 1, preco_unitario: 20, data_validade: '2026-11-11' });
    assert.equal((await indicadores()).valor_em_risco, 30);
  });

  test('categorias distintas somam juntas (indicador é geral, não por categoria)', async () => {
    await criar({ categoria: 'Laticínios', quantidade: 2, preco_unitario: 500, data_validade: '2026-11-11' });
    await criar({ categoria: 'Grãos', quantidade: 3, preco_unitario: 400, data_validade: '2026-11-12' });
    assert.equal((await indicadores()).valor_em_risco, 2200);
  });
});

describe('RNF06 — consistência com os dados persistidos', () => {
  test('editar quantidade e preço atualiza o valor em risco', async () => {
    const c = await criar({ quantidade: 10, preco_unitario: 500, data_validade: '2026-11-12' });
    assert.equal((await indicadores()).valor_em_risco, 5000);
    await api.req('PUT', `/api/produtos/${c.corpo.id}`, produtoValido({
      codigo: c.corpo.codigo, quantidade: 4, preco_unitario: 250, data_validade: '2026-11-12',
    }));
    assert.equal((await indicadores()).valor_em_risco, 1000);
  });

  test('editar a validade move o produto entre as contagens', async () => {
    const c = await criar({ quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    const dados = (data) => produtoValido({ codigo: c.corpo.codigo, quantidade: 1, preco_unitario: 100, data_validade: data });
    let i = await indicadores();
    assert.deepEqual([i.produtos_vencidos, i.produtos_a_vencer], [0, 1]);
    await api.req('PUT', `/api/produtos/${c.corpo.id}`, dados('2026-11-01'));
    i = await indicadores();
    assert.deepEqual([i.produtos_vencidos, i.produtos_a_vencer, i.valor_em_risco], [1, 0, 0]);
    await api.req('PUT', `/api/produtos/${c.corpo.id}`, dados('2026-11-18'));
    i = await indicadores();
    assert.deepEqual([i.produtos_vencidos, i.produtos_a_vencer, i.valor_em_risco], [0, 0, 0]);
  });

  test('excluir um produto atualiza total, contagens e valor', async () => {
    const a = await criar({ quantidade: 2, preco_unitario: 100, data_validade: '2026-11-12' });
    await criar({ quantidade: 3, preco_unitario: 100, data_validade: '2026-11-13' });
    assert.equal((await indicadores()).valor_em_risco, 500);
    await api.req('DELETE', `/api/produtos/${a.corpo.id}`);
    const i = await indicadores();
    assert.deepEqual([i.total_produtos, i.produtos_a_vencer, i.valor_em_risco], [1, 1, 300]);
  });

  test('cadastro inválido ou duplicado não altera os indicadores', async () => {
    await criar({ codigo: 'FIXO', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    const antes = await indicadores();
    await api.req('POST', '/api/produtos', produtoValido({ codigo: 'FIXO' })); // 409
    await api.req('POST', '/api/produtos', produtoValido({ codigo: 'Z', quantidade: -1 })); // 400
    assert.deepEqual(await indicadores(), antes);
  });

  test('API de listagem e indicadores concordam (cenário 14)', async () => {
    const datas = ['2026-11-01', '2026-11-09', '2026-11-10', '2026-11-13', '2026-11-17', '2026-11-18', '2027-03-01'];
    for (const [k, data_validade] of datas.entries()) {
      await criar({ quantidade: k + 1, preco_unitario: 150 * (k + 1), data_validade });
    }
    const i = await indicadores();
    const lista = async (q) => (await api.req('GET', `/api/produtos?${q}&limite=100`)).corpo;

    const total = (await api.req('GET', '/api/produtos?limite=100')).corpo.paginacao.total;
    const venc = await lista('situacao=vencido');
    const prox = await lista('situacao=proximo');
    assert.equal(i.total_produtos, total);
    assert.equal(i.produtos_vencidos, venc.paginacao.total);
    assert.equal(i.produtos_a_vencer, prox.paginacao.total);
    assert.equal(
      i.valor_em_risco,
      prox.dados.reduce((soma, p) => soma + p.quantidade * p.preco_unitario, 0),
    );
    assert.equal(i.total_produtos, venc.paginacao.total + prox.paginacao.total
      + (await lista('situacao=dentro')).paginacao.total);
  });

  test('filtros de listagem não alteram os indicadores (são sempre do estoque inteiro)', async () => {
    await criar({ categoria: 'A', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    await criar({ categoria: 'B', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    const antes = await indicadores();
    await api.req('GET', '/api/produtos?categoria=A&situacao=proximo&busca=x');
    assert.deepEqual(await indicadores(), antes);
    assert.equal(antes.valor_em_risco, 200);
  });
});

describe('limites e erros', () => {
  test('centavosSeguros converte valores seguros e recusa os que perderiam precisão', () => {
    assert.equal(centavosSeguros(0n), 0);
    assert.equal(centavosSeguros(BigInt(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
    assert.throws(() => centavosSeguros(BigInt(Number.MAX_SAFE_INTEGER) + 1n), /Erro interno/);
  });

  test('soma acima do limite seguro devolve 500 genérico em JSON (sem detalhes internos)', async () => {
    const ins = api.db.prepare(
      'INSERT INTO produtos (nome,codigo,categoria,quantidade,preco_unitario,data_validade) VALUES (?,?,?,?,?,?)',
    );
    // 10 × (1.000.000 × 1.000.000.000) = 1e16 > 2^53
    for (let k = 0; k < 10; k += 1) ins.run('x', `G${k}`, 'c', 1_000_000, 1_000_000_000, '2026-11-12');
    const silencio = console.error;
    console.error = () => {};
    try {
      const r = await api.req('GET', '/api/indicadores');
      assert.equal(r.status, 500);
      assert.deepEqual(r.corpo, { erro: 'Erro interno do servidor' });
    } finally {
      console.error = silencio;
    }
  });

  test('o maior valor por produto ainda cabe com folga (1 produto no limite)', async () => {
    await criar({ quantidade: 1_000_000, preco_unitario: 1_000_000_000, data_validade: '2026-11-12' });
    assert.equal((await indicadores()).valor_em_risco, 1_000_000_000_000_000);
  });

  test('os indicadores não gravam nada', async () => {
    await criar({ data_validade: '2026-11-12' });
    await indicadores();
    assert.equal(api.contar(), 1);
  });
});
