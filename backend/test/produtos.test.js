const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, produtoValido } = require('./helpers');

let api;
before(async () => { api = await iniciarApi(); });
after(async () => { await api.fechar(); });
beforeEach(() => { api.db.exec("DELETE FROM produtos; DELETE FROM sqlite_sequence WHERE name='produtos'"); });

// Confere que uma operação inválida foi recusada e a tabela ficou intacta.
async function rejeita(corpo, campo, status = 400) {
  const antes = api.contar();
  const r = await api.req('POST', '/api/produtos', corpo);
  assert.equal(r.status, status);
  if (campo) assert.ok(r.corpo.detalhes[campo], `esperava erro em ${campo}`);
  assert.equal(api.contar(), antes, 'nada deve ser gravado');
  return r;
}

describe('saúde e erros gerais', () => {
  test('GET /api/health devolve 200 e JSON', async () => {
    const r = await api.req('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo, { status: 'ok' });
  });

  test('rota inexistente devolve 404 em JSON', async () => {
    const r = await api.req('GET', '/api/nada');
    assert.equal(r.status, 404);
    assert.equal(r.corpo.erro, 'Rota não encontrada');
  });

  test('JSON malformado devolve 400 em JSON e não grava', async () => {
    const r = await api.req('POST', '/api/produtos', undefined, { bruto: '{nome:' });
    assert.equal(r.status, 400);
    assert.equal(r.corpo.erro, 'JSON inválido');
    assert.equal(api.contar(), 0);
  });

  test('CORS permite a origem local do frontend e não usa curinga', async () => {
    const resp = await fetch(`${api.base}/api/health`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(resp.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const outra = await fetch(`${api.base}/api/health`, { headers: { Origin: 'http://evil.example' } });
    assert.equal(outra.headers.get('access-control-allow-origin'), null);
  });
});

describe('criação (RF01)', () => {
  test('cria produto válido e devolve 201 com id', async () => {
    const r = await api.req('POST', '/api/produtos', produtoValido());
    assert.equal(r.status, 201);
    assert.equal(r.corpo.id, 1);
    // 2026-11-15 está a 5 dias de HOJE_FIXO (2026-11-10): "proximo"
    assert.deepEqual({ ...r.corpo, id: undefined }, { ...produtoValido(), id: undefined, situacao: 'proximo' });
    assert.equal(api.contar(), 1);
  });

  test('aceita quantidade 0 e preço 0 (RN05: >= 0)', async () => {
    const r = await api.req('POST', '/api/produtos', produtoValido({ quantidade: 0, preco_unitario: 0 }));
    assert.equal(r.status, 201);
  });

  test('remove espaços nas pontas dos textos', async () => {
    const r = await api.req('POST', '/api/produtos', produtoValido({ nome: '  Leite  ', codigo: ' L1 ' }));
    assert.equal(r.corpo.nome, 'Leite');
    assert.equal(r.corpo.codigo, 'L1');
  });

  for (const campo of ['nome', 'codigo', 'categoria', 'quantidade', 'preco_unitario', 'data_validade']) {
    test(`campo obrigatório ausente: ${campo}`, async () => {
      const corpo = produtoValido();
      delete corpo[campo];
      await rejeita(corpo, campo);
    });
  }

  test('nome vazio ou só espaços é rejeitado', async () => {
    await rejeita(produtoValido({ nome: '   ' }), 'nome');
  });

  test('corpo vazio devolve 400 com todos os campos', async () => {
    const r = await api.req('POST', '/api/produtos', {});
    assert.equal(r.status, 400);
    assert.equal(Object.keys(r.corpo.detalhes).length, 6);
  });

  test('quantidade negativa é rejeitada', async () => {
    await rejeita(produtoValido({ quantidade: -1 }), 'quantidade');
  });

  test('preço negativo é rejeitado', async () => {
    await rejeita(produtoValido({ preco_unitario: -1 }), 'preco_unitario');
  });

  test('valores não inteiros ou de tipo errado são rejeitados', async () => {
    await rejeita(produtoValido({ quantidade: 1.5 }), 'quantidade');
    await rejeita(produtoValido({ quantidade: '10' }), 'quantidade');
    await rejeita(produtoValido({ preco_unitario: 5.99 }), 'preco_unitario');
    await rejeita(produtoValido({ preco_unitario: 'abc' }), 'preco_unitario');
    await rejeita(produtoValido({ preco_unitario: null }), 'preco_unitario');
    await rejeita(produtoValido({ quantidade: 1e12 }), 'quantidade');
  });

  test('data malformada é rejeitada', async () => {
    for (const d of ['15/11/2026', '2026-1-5', '2026-11-15T00:00', 'amanhã', 20261115]) {
      await rejeita(produtoValido({ data_validade: d }), 'data_validade');
    }
  });

  test('data impossível no calendário é rejeitada', async () => {
    for (const d of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2025-02-29']) {
      await rejeita(produtoValido({ data_validade: d }), 'data_validade');
    }
  });

  test('29 de fevereiro de ano bissexto é aceito', async () => {
    const r = await api.req('POST', '/api/produtos', produtoValido({ data_validade: '2028-02-29' }));
    assert.equal(r.status, 201);
  });

  test('código duplicado devolve 409 e não grava', async () => {
    await api.req('POST', '/api/produtos', produtoValido());
    await rejeita(produtoValido({ nome: 'Outro' }), 'codigo', 409);
    assert.equal(api.contar(), 1);
  });

  test('corpo que não é objeto é rejeitado', async () => {
    const r = await api.req('POST', '/api/produtos', [1, 2]);
    assert.equal(r.status, 400);
  });

  test('tentativa de injeção SQL é tratada como texto', async () => {
    const r = await api.req('POST', '/api/produtos', produtoValido({ nome: "x'); DROP TABLE produtos;--" }));
    assert.equal(r.status, 201);
    assert.equal(api.contar(), 1);
  });
});

describe('consulta, edição e exclusão (RF02–RF04)', () => {
  test('consulta por id', async () => {
    const c = await api.req('POST', '/api/produtos', produtoValido());
    const r = await api.req('GET', `/api/produtos/${c.corpo.id}`);
    assert.equal(r.status, 200);
    assert.equal(r.corpo.codigo, 'LEI001');
  });

  test('id inexistente devolve 404 em GET, PUT e DELETE', async () => {
    assert.equal((await api.req('GET', '/api/produtos/999')).status, 404);
    assert.equal((await api.req('PUT', '/api/produtos/999', produtoValido())).status, 404);
    assert.equal((await api.req('DELETE', '/api/produtos/999')).status, 404);
  });

  test('id inválido devolve 400', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      assert.equal((await api.req('GET', `/api/produtos/${id}`)).status, 400, id);
    }
  });

  test('edição válida altera quantidade e persiste', async () => {
    const c = await api.req('POST', '/api/produtos', produtoValido());
    const r = await api.req('PUT', `/api/produtos/${c.corpo.id}`, produtoValido({ quantidade: 3 }));
    assert.equal(r.status, 200);
    assert.equal(r.corpo.quantidade, 3);
    assert.equal((await api.req('GET', `/api/produtos/${c.corpo.id}`)).corpo.quantidade, 3);
  });

  test('edição inválida não altera o registro', async () => {
    const c = await api.req('POST', '/api/produtos', produtoValido());
    const r = await api.req('PUT', `/api/produtos/${c.corpo.id}`, produtoValido({ quantidade: -5, nome: 'Novo' }));
    assert.equal(r.status, 400);
    const atual = (await api.req('GET', `/api/produtos/${c.corpo.id}`)).corpo;
    assert.equal(atual.quantidade, 10);
    assert.equal(atual.nome, 'Leite Integral 1L');
  });

  test('edição com código de outro produto devolve 409 e não altera', async () => {
    await api.req('POST', '/api/produtos', produtoValido());
    const b = await api.req('POST', '/api/produtos', produtoValido({ codigo: 'B2' }));
    const r = await api.req('PUT', `/api/produtos/${b.corpo.id}`, produtoValido({ codigo: 'LEI001' }));
    assert.equal(r.status, 409);
    assert.equal((await api.req('GET', `/api/produtos/${b.corpo.id}`)).corpo.codigo, 'B2');
  });

  test('edição mantendo o próprio código é permitida', async () => {
    const c = await api.req('POST', '/api/produtos', produtoValido());
    const r = await api.req('PUT', `/api/produtos/${c.corpo.id}`, produtoValido({ nome: 'Renomeado' }));
    assert.equal(r.status, 200);
  });

  test('exclusão devolve 204 e remove o registro', async () => {
    const c = await api.req('POST', '/api/produtos', produtoValido());
    const r = await api.req('DELETE', `/api/produtos/${c.corpo.id}`);
    assert.equal(r.status, 204);
    assert.equal(api.contar(), 0);
    assert.equal((await api.req('GET', `/api/produtos/${c.corpo.id}`)).status, 404);
  });
});

describe('listagem, pesquisa, ordenação e paginação (RF02, RN06)', () => {
  const semear = async () => {
    await api.req('POST', '/api/produtos', produtoValido({ nome: 'Iogurte', codigo: 'IOG1', data_validade: '2026-12-01' }));
    await api.req('POST', '/api/produtos', produtoValido({ nome: 'Leite', codigo: 'LEI1', data_validade: '2026-11-01' }));
    await api.req('POST', '/api/produtos', produtoValido({ nome: 'Queijo', codigo: 'QUE1', data_validade: '2026-11-01' }));
    await api.req('POST', '/api/produtos', produtoValido({ nome: 'Arroz', codigo: 'ARR1', data_validade: '2025-01-10' }));
  };

  test('lista vazia', async () => {
    const r = await api.req('GET', '/api/produtos');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.dados, []);
    assert.equal(r.corpo.paginacao.total, 0);
  });

  test('ordena por validade crescente, com id desempatando', async () => {
    await semear();
    const r = await api.req('GET', '/api/produtos');
    assert.deepEqual(r.corpo.dados.map((p) => p.codigo), ['ARR1', 'LEI1', 'QUE1', 'IOG1']);
  });

  test('pesquisa por nome (parcial, sem diferenciar maiúsculas)', async () => {
    await semear();
    const r = await api.req('GET', '/api/produtos?busca=leit');
    assert.deepEqual(r.corpo.dados.map((p) => p.codigo), ['LEI1']);
  });

  test('pesquisa por código', async () => {
    await semear();
    const r = await api.req('GET', '/api/produtos?busca=QUE1');
    assert.deepEqual(r.corpo.dados.map((p) => p.nome), ['Queijo']);
  });

  test('pesquisa sem resultado e caracteres especiais tratados literalmente', async () => {
    await semear();
    assert.equal((await api.req('GET', '/api/produtos?busca=zzz')).corpo.dados.length, 0);
    assert.equal((await api.req('GET', '/api/produtos?busca=%25')).corpo.dados.length, 0);
    assert.equal((await api.req('GET', '/api/produtos?busca=_')).corpo.dados.length, 0);
  });

  test('paginação respeita limite, página e total', async () => {
    await semear();
    const p1 = await api.req('GET', '/api/produtos?limite=3&pagina=1');
    const p2 = await api.req('GET', '/api/produtos?limite=3&pagina=2');
    assert.equal(p1.corpo.dados.length, 3);
    assert.deepEqual(p2.corpo.dados.map((p) => p.codigo), ['IOG1']);
    assert.deepEqual(p1.corpo.paginacao, { pagina: 1, limite: 3, total: 4, totalPaginas: 2 });
  });

  test('parâmetros de paginação inválidos devolvem 400', async () => {
    for (const q of ['pagina=0', 'limite=0', 'limite=101', 'pagina=x', 'limite=1.5']) {
      assert.equal((await api.req('GET', `/api/produtos?${q}`)).status, 400, q);
    }
  });
});

describe('integridade', () => {
  test('o banco recusa valores negativos mesmo fora da API (CHECK)', () => {
    const ins = (q, p) => api.db
      .prepare('INSERT INTO produtos (nome,codigo,categoria,quantidade,preco_unitario,data_validade) VALUES (?,?,?,?,?,?)')
      .run('a', 'X' + q + p, 'c', q, p, '2026-01-01');
    assert.throws(() => ins(-1, 1), /CHECK/);
    assert.throws(() => ins(1, -1), /CHECK/);
  });

  test('preço é guardado em centavos inteiros e devolvido sem arredondamento', async () => {
    const r = await api.req('POST', '/api/produtos', produtoValido({ preco_unitario: 1999 }));
    assert.equal(r.corpo.preco_unitario, 1999);
    assert.equal(api.db.prepare('SELECT typeof(preco_unitario) t FROM produtos').get().t, 'integer');
  });
});
