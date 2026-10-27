const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, produtoValido } = require('./helpers');

// HOJE_FIXO = 2026-11-10 → vencido < 11-10 · proximo 11-10..11-17 · dentro > 11-17
let api;
before(async () => { api = await iniciarApi(); });
after(async () => { await api.fechar(); });
beforeEach(() => { api.db.exec("DELETE FROM produtos; DELETE FROM sqlite_sequence WHERE name='produtos'"); });

const criar = (extra) => api.req('POST', '/api/produtos', produtoValido(extra));
const codigos = (r) => r.corpo.dados.map((p) => p.codigo);

async function semear() {
  await criar({ nome: 'Leite Integral', codigo: 'LEI1', categoria: 'Laticínios', data_validade: '2026-11-09' }); // vencido
  await criar({ nome: 'Leite Desnatado', codigo: 'LEI2', categoria: 'Laticínios', data_validade: '2026-11-10' }); // proximo (hoje)
  await criar({ nome: 'Queijo Minas', codigo: 'QUE1', categoria: 'Laticínios', data_validade: '2026-11-17' }); // proximo (+7)
  await criar({ nome: 'Iogurte', codigo: 'IOG1', categoria: 'Laticínios', data_validade: '2026-11-18' }); // dentro (+8)
  await criar({ nome: 'Arroz Leite', codigo: 'ARR1', categoria: 'Grãos', data_validade: '2026-11-01' }); // vencido
  await criar({ nome: 'Feijão', codigo: 'FEI1', categoria: 'Grãos', data_validade: '2027-05-01' }); // dentro
}

describe('campo situacao nas respostas (RF05)', () => {
  test('POST, GET por id, PUT e listagem trazem a situação', async () => {
    const c = await criar({ data_validade: '2026-11-09' });
    assert.equal(c.corpo.situacao, 'vencido');
    assert.equal((await api.req('GET', `/api/produtos/${c.corpo.id}`)).corpo.situacao, 'vencido');
    const p = await api.req('PUT', `/api/produtos/${c.corpo.id}`, produtoValido({ data_validade: '2026-11-18' }));
    assert.equal(p.corpo.situacao, 'dentro');
    assert.equal((await api.req('GET', '/api/produtos')).corpo.dados[0].situacao, 'dentro');
  });

  test('cenários 5–8 do PDF pela API', async () => {
    const casos = [['2026-11-09', 'vencido'], ['2026-11-10', 'proximo'], ['2026-11-17', 'proximo'], ['2026-11-18', 'dentro']];
    for (const [i, [data, esperado]] of casos.entries()) {
      const r = await criar({ codigo: `C${i}`, data_validade: data });
      assert.equal(r.corpo.situacao, esperado, data);
    }
  });

  test('o contrato anterior é preservado (campos originais intactos)', async () => {
    const r = await criar();
    for (const campo of ['id', 'nome', 'codigo', 'categoria', 'quantidade', 'preco_unitario', 'data_validade']) {
      assert.ok(campo in r.corpo, campo);
    }
  });
});

describe('filtro por situação (RF06, PDF cenário 12)', () => {
  test('cada situação isolada', async () => {
    await semear();
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?situacao=vencido')), ['ARR1', 'LEI1']);
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?situacao=proximo')), ['LEI2', 'QUE1']);
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?situacao=dentro')), ['IOG1', 'FEI1']);
  });

  test('a situação devolvida é coerente com o filtro aplicado', async () => {
    await semear();
    for (const s of ['vencido', 'proximo', 'dentro']) {
      const r = await api.req('GET', `/api/produtos?situacao=${s}`);
      assert.ok(r.corpo.dados.length > 0);
      assert.ok(r.corpo.dados.every((p) => p.situacao === s), s);
    }
  });

  test('os três filtros juntos cobrem todos os produtos, sem repetição', async () => {
    await semear();
    const todos = [];
    for (const s of ['vencido', 'proximo', 'dentro']) todos.push(...codigos(await api.req('GET', `/api/produtos?situacao=${s}&limite=100`)));
    assert.equal(new Set(todos).size, 6);
    assert.equal(todos.length, api.contar());
  });

  test('parâmetro ausente ou vazio = sem filtro', async () => {
    await semear();
    assert.equal((await api.req('GET', '/api/produtos')).corpo.paginacao.total, 6);
    assert.equal((await api.req('GET', '/api/produtos?situacao=')).corpo.paginacao.total, 6);
  });

  test('situação inválida devolve 400 em JSON', async () => {
    for (const q of ['situacao=atrasado', 'situacao=VENCIDO', 'situacao=vencido&situacao=dentro']) {
      const r = await api.req('GET', `/api/produtos?${q}`);
      assert.equal(r.status, 400, q);
      assert.ok(r.corpo.detalhes.situacao, q);
    }
  });
});

describe('filtro por categoria (PDF cenário 11)', () => {
  test('categoria isolada, exata', async () => {
    await semear();
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?categoria=Gr%C3%A3os')), ['ARR1', 'FEI1']);
    assert.equal((await api.req('GET', '/api/produtos?categoria=Gr')).corpo.dados.length, 0);
  });

  test('categoria vazia = sem filtro; categoria desconhecida = lista vazia', async () => {
    await semear();
    assert.equal((await api.req('GET', '/api/produtos?categoria=')).corpo.paginacao.total, 6);
    const r = await api.req('GET', '/api/produtos?categoria=Inexistente');
    assert.equal(r.status, 200);
    assert.equal(r.corpo.paginacao.total, 0);
  });

  test('caracteres especiais e injeção SQL são tratados como texto', async () => {
    await semear();
    for (const c of ["'%20OR%201=1--", '%25', '_']) {
      const r = await api.req('GET', `/api/produtos?categoria=${c}`);
      assert.equal(r.status, 200);
      assert.equal(r.corpo.dados.length, 0, c);
    }
    assert.equal(api.contar(), 6);
  });

  test('categoria repetida na query devolve 400', async () => {
    assert.equal((await api.req('GET', '/api/produtos?categoria=a&categoria=b')).status, 400);
  });
});

describe('combinações com busca e paginação', () => {
  test('busca isolada continua funcionando (nome e código)', async () => {
    await semear();
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?busca=leite')), ['ARR1', 'LEI1', 'LEI2']);
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?busca=iog1')), ['IOG1']);
  });

  test('busca + situação', async () => {
    await semear();
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?busca=leite&situacao=vencido')), ['ARR1', 'LEI1']);
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?busca=leite&situacao=proximo')), ['LEI2']);
  });

  test('busca + categoria', async () => {
    await semear();
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?busca=leite&categoria=Gr%C3%A3os')), ['ARR1']);
  });

  test('busca + categoria + situação', async () => {
    await semear();
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?busca=leite&categoria=Latic%C3%ADnios&situacao=vencido')), ['LEI1']);
    assert.equal((await api.req('GET', '/api/produtos?busca=leite&categoria=Gr%C3%A3os&situacao=proximo')).corpo.dados.length, 0);
  });

  test('categoria + situação sem busca', async () => {
    await semear();
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?categoria=Latic%C3%ADnios&situacao=proximo')), ['LEI2', 'QUE1']);
  });

  test('paginação aplica-se depois dos filtros, com total e metadados corretos', async () => {
    await semear();
    const q = 'categoria=Latic%C3%ADnios&limite=2';
    const p1 = await api.req('GET', `/api/produtos?${q}&pagina=1`);
    const p2 = await api.req('GET', `/api/produtos?${q}&pagina=2`);
    const p3 = await api.req('GET', `/api/produtos?${q}&pagina=3`);
    assert.deepEqual(codigos(p1), ['LEI1', 'LEI2']);
    assert.deepEqual(codigos(p2), ['QUE1', 'IOG1']);
    assert.deepEqual(p3.corpo.dados, []);
    assert.deepEqual(p1.corpo.paginacao, { pagina: 1, limite: 2, total: 4, totalPaginas: 2 });
  });

  test('situação + paginação: total reflete só os filtrados', async () => {
    await semear();
    const r = await api.req('GET', '/api/produtos?situacao=dentro&limite=1&pagina=2');
    assert.deepEqual(codigos(r), ['FEI1']);
    assert.deepEqual(r.corpo.paginacao, { pagina: 2, limite: 1, total: 2, totalPaginas: 2 });
  });

  test('ordenação estável por data e id com filtros (mesma data desempata por id)', async () => {
    await criar({ codigo: 'B', data_validade: '2026-11-12' });
    await criar({ codigo: 'A', data_validade: '2026-11-12' });
    await criar({ codigo: 'C', data_validade: '2026-11-11' });
    assert.deepEqual(codigos(await api.req('GET', '/api/produtos?situacao=proximo')), ['C', 'B', 'A']);
  });

  test('filtros não alteram dados (somente leitura)', async () => {
    await semear();
    await api.req('GET', '/api/produtos?situacao=vencido&categoria=Gr%C3%A3os&busca=a');
    assert.equal(api.contar(), 6);
  });
});

describe('GET /api/categorias (D3)', () => {
  test('sem produtos devolve lista vazia', async () => {
    const r = await api.req('GET', '/api/categorias');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { dados: [] });
  });

  test('categorias distintas, sem duplicatas, em ordem estável (sem diferenciar caixa; empate por valor exato)', async () => {
    await semear();
    await criar({ codigo: 'X1', categoria: 'bebidas' });
    await criar({ codigo: 'X2', categoria: 'Bebidas' });
    const r = await api.req('GET', '/api/categorias');
    assert.deepEqual(r.corpo.dados, ['Bebidas', 'bebidas', 'Grãos', 'Laticínios']);
    assert.deepEqual((await api.req('GET', '/api/categorias')).corpo, r.corpo);
  });

  test('reflete só categorias reais: some após excluir o último produto da categoria', async () => {
    const a = await criar({ codigo: 'K1', categoria: 'Temporária' });
    assert.deepEqual((await api.req('GET', '/api/categorias')).corpo.dados, ['Temporária']);
    await api.req('DELETE', `/api/produtos/${a.corpo.id}`);
    assert.deepEqual((await api.req('GET', '/api/categorias')).corpo.dados, []);
  });

  test('categoria nova aparece depois de editar um produto', async () => {
    const a = await criar({ codigo: 'K2', categoria: 'Antiga' });
    await api.req('PUT', `/api/produtos/${a.corpo.id}`, produtoValido({ codigo: 'K2', categoria: 'Nova' }));
    assert.deepEqual((await api.req('GET', '/api/categorias')).corpo.dados, ['Nova']);
  });
});
