// Fase 5 — casos de fronteira: datas, valores negativos/limites, campos vazios e parâmetros.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, produtoValido } = require('./helpers');
const { dataValida, LIMITES } = require('../src/validators/produto');

let api;
before(async () => { api = await iniciarApi(); });
after(async () => { await api.fechar(); });
beforeEach(() => { api.db.exec("DELETE FROM produtos; DELETE FROM sqlite_sequence WHERE name='produtos'"); });

let seq = 0;
const novo = (extra) => produtoValido({ codigo: `F${++seq}`, ...extra });
const aceita = async (extra) => {
  const r = await api.req('POST', '/api/produtos', novo(extra));
  assert.equal(r.status, 201, JSON.stringify(r.corpo));
  return r.corpo;
};
const rejeita = async (extra, campo) => {
  const antes = api.contar();
  const r = await api.req('POST', '/api/produtos', novo(extra));
  assert.equal(r.status, 400, JSON.stringify(extra));
  assert.ok(r.corpo.detalhes[campo], `erro esperado em ${campo}: ${JSON.stringify(r.corpo)}`);
  assert.equal(api.contar(), antes, 'nada deve ser gravado');
};

describe('datas — fronteiras do calendário', () => {
  test('limites de ano: 1900-01-01 e 2100-12-31 valem; 1899-12-31 e 2101-01-01 não', () => {
    assert.ok(dataValida('1900-01-01'));
    assert.ok(dataValida('2100-12-31'));
    assert.ok(!dataValida('1899-12-31'));
    assert.ok(!dataValida('2101-01-01'));
  });

  test('regra dos séculos: 2000 é bissexto; 1900 e 2100 não são', () => {
    assert.ok(dataValida('2000-02-29'));
    assert.ok(!dataValida('1900-02-29'));
    assert.ok(!dataValida('2100-02-29'));
    assert.ok(dataValida('2024-02-29'));
    assert.ok(!dataValida('2023-02-29'));
  });

  test('último dia de cada mês é aceito e o dia seguinte é recusado', () => {
    const ultimos = { '01': 31, '02': 28, '03': 31, '04': 30, '05': 31, '06': 30, '07': 31, '08': 31, '09': 30, '10': 31, '11': 30, '12': 31 };
    for (const [mes, ultimo] of Object.entries(ultimos)) {
      assert.ok(dataValida(`2027-${mes}-${String(ultimo).padStart(2, '0')}`), `2027-${mes}-${ultimo}`);
      assert.ok(!dataValida(`2027-${mes}-${String(ultimo + 1).padStart(2, '0')}`), `2027-${mes}-${ultimo + 1}`);
    }
  });

  test('dia 00, mês 00 e mês 13 são recusados', () => {
    for (const d of ['2026-11-00', '2026-00-15', '2026-13-15', '2026-99-99']) assert.ok(!dataValida(d), d);
  });

  test('formatos quase corretos são recusados pela API', async () => {
    const ruins = [' 2026-11-15', '2026-11-15 ', '2026-11-15\n', '2026/11/15', '2026-11-5', '26-11-15', '20261115',
      '2026-11-15T10:00:00Z', '２０２６-11-15', '2026-１1-15', '+2026-11-15'];
    for (const data_validade of ruins) await rejeita({ data_validade }, 'data_validade');
  });

  test('tipos que não são texto são recusados como data', async () => {
    for (const data_validade of [null, 0, 20261115, true, [], {}, ['2026-11-15']]) {
      await rejeita({ data_validade }, 'data_validade');
    }
  });

  test('datas nos extremos aceitos são gravadas e classificadas', async () => {
    assert.equal((await aceita({ data_validade: '1900-01-01' })).situacao, 'vencido');
    assert.equal((await aceita({ data_validade: '2100-12-31' })).situacao, 'dentro');
  });

  test('editar para data inválida mantém a data anterior', async () => {
    const c = await aceita({ data_validade: '2026-11-12' });
    const r = await api.req('PUT', `/api/produtos/${c.id}`, novo({ codigo: c.codigo, data_validade: '2026-02-30' }));
    assert.equal(r.status, 400);
    assert.equal((await api.req('GET', `/api/produtos/${c.id}`)).corpo.data_validade, '2026-11-12');
  });
});

describe('valores numéricos — negativos, limites e tipos', () => {
  test('quantidade e preço: zero é aceito, -1 é recusado', async () => {
    await aceita({ quantidade: 0 });
    await aceita({ preco_unitario: 0 });
    await rejeita({ quantidade: -1 }, 'quantidade');
    await rejeita({ preco_unitario: -1 }, 'preco_unitario');
  });

  test('menos zero (-0) não é negativo: é gravado como 0', async () => {
    // JSON.stringify(-0) daria "0"; por isso o corpo é escrito à mão com -0 literal.
    const bruto = JSON.stringify(novo()).replace('"quantidade":10', '"quantidade":-0');
    assert.ok(bruto.includes('-0'));
    const r = await api.req('POST', '/api/produtos', undefined, { bruto });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.quantidade, 0);
  });

  test('limite superior exato é aceito e um acima é recusado', async () => {
    await aceita({ quantidade: LIMITES.quantidadeMax });
    await aceita({ preco_unitario: LIMITES.precoMaxCentavos });
    await rejeita({ quantidade: LIMITES.quantidadeMax + 1 }, 'quantidade');
    await rejeita({ preco_unitario: LIMITES.precoMaxCentavos + 1 }, 'preco_unitario');
  });

  test('valores enormes, decimais e de tipo errado são recusados', async () => {
    for (const quantidade of [1e21, Number.MAX_SAFE_INTEGER, 0.5, -0.5, '5', '', true, false, [], {}, [3], null]) {
      await rejeita({ quantidade }, 'quantidade');
    }
    for (const preco_unitario of [1e21, 0.01, 5.99, '599', '5,99', true, [], {}, null]) {
      await rejeita({ preco_unitario }, 'preco_unitario');
    }
  });

  test('número escrito como 1e3 no JSON vira 1000 e é aceito (é inteiro)', async () => {
    const r = await api.req('POST', '/api/produtos', undefined, {
      bruto: JSON.stringify(novo()).replace('"quantidade":10', '"quantidade":1e3'),
    });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.quantidade, 1000);
  });
});

describe('campos de texto — vazios, espaços, tamanhos e tipos', () => {
  for (const campo of ['nome', 'codigo', 'categoria']) {
    test(`${campo}: vazio, só espaços, tabulação e quebra de linha são recusados`, async () => {
      for (const v of ['', ' ', '   ', '\t', '\n', ' \t\n ']) await rejeita({ [campo]: v }, campo);
    });

    test(`${campo}: null, número, booleano, lista e objeto são recusados`, async () => {
      for (const v of [null, 0, 123, true, false, [], ['x'], {}, { a: 1 }]) await rejeita({ [campo]: v }, campo);
    });
  }

  test('tamanhos máximos: exatos passam, um a mais não', async () => {
    await aceita({ nome: 'n'.repeat(LIMITES.nome) });
    await aceita({ codigo: 'c'.repeat(LIMITES.codigo) });
    await aceita({ categoria: 'k'.repeat(LIMITES.categoria) });
    await rejeita({ nome: 'n'.repeat(LIMITES.nome + 1) }, 'nome');
    await rejeita({ codigo: 'c'.repeat(LIMITES.codigo + 1) }, 'codigo');
    await rejeita({ categoria: 'k'.repeat(LIMITES.categoria + 1) }, 'categoria');
  });

  test('espaços nas pontas não contam no limite e são removidos', async () => {
    const p = await aceita({ nome: ` ${'n'.repeat(LIMITES.nome)} ` });
    assert.equal(p.nome.length, LIMITES.nome);
  });

  test('acentos, emoji e caracteres especiais são preservados', async () => {
    const p = await aceita({ nome: 'Pão de Açúcar “integral” 🍞 <b>&</b>', categoria: 'Padaria/Confeitaria' });
    assert.equal((await api.req('GET', `/api/produtos/${p.id}`)).corpo.nome, 'Pão de Açúcar “integral” 🍞 <b>&</b>');
  });

  test('código duplicado ignora espaços das pontas (" X " conflita com "X")', async () => {
    await aceita({ codigo: 'DUP' });
    const antes = api.contar();
    const r = await api.req('POST', '/api/produtos', produtoValido({ codigo: '  DUP  ' }));
    assert.equal(r.status, 409);
    assert.equal(api.contar(), antes);
  });

  test('código diferencia maiúsculas de minúsculas (comportamento atual, documentado)', async () => {
    await aceita({ codigo: 'abc' });
    await aceita({ codigo: 'ABC' });
    assert.equal(api.contar(), 2);
  });
});

describe('corpo da requisição', () => {
  test('campos desconhecidos são ignorados e `situacao` enviada não é gravada nem obedecida', async () => {
    const r = await api.req('POST', '/api/produtos', novo({ situacao: 'vencido', id: 999, extra: 'x', data_validade: '2026-11-18' }));
    assert.equal(r.status, 201);
    assert.equal(r.corpo.situacao, 'dentro'); // calculada pelo backend
    assert.notEqual(r.corpo.id, 999);
    assert.ok(!('extra' in r.corpo));
  });

  test('corpo ausente, nulo, texto e lista devolvem 400 sem gravar', async () => {
    for (const bruto of [undefined, 'null', '"texto"', '[]', '123']) {
      const r = await api.req('POST', '/api/produtos', undefined, { bruto });
      assert.equal(r.status, 400, String(bruto));
    }
    assert.equal(api.contar(), 0);
  });

  test('corpo grande demais devolve 413 em JSON', async () => {
    const r = await api.req('POST', '/api/produtos', novo({ nome: 'x'.repeat(200_000) }));
    assert.equal(r.status, 413);
    assert.equal(api.contar(), 0);
  });

  test('várias falhas juntas são todas informadas de uma vez', async () => {
    const r = await api.req('POST', '/api/produtos', { nome: '', codigo: '', categoria: '', quantidade: -1, preco_unitario: -1, data_validade: '2026-02-30' });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.corpo.detalhes).sort(), ['categoria', 'codigo', 'data_validade', 'nome', 'preco_unitario', 'quantidade']);
  });
});

describe('parâmetros de consulta e identificadores', () => {
  test('paginação: valores absurdos devolvem 400, nunca 500 (bug corrigido na Fase 5)', async () => {
    for (const q of ['pagina=1e20', 'pagina=99999999999999999999', 'pagina=1000001', 'limite=0x10', 'limite=1e2',
      'pagina=%205', 'pagina=-1', 'pagina=+1', 'pagina=1.0', 'limite=%20', 'pagina=abc']) {
      assert.equal((await api.req('GET', `/api/produtos?${q}`)).status, 400, q);
    }
  });

  test('paginação: limites exatos são aceitos', async () => {
    for (const q of ['pagina=1', 'pagina=1000000', 'limite=1', 'limite=100']) {
      assert.equal((await api.req('GET', `/api/produtos?${q}`)).status, 200, q);
    }
  });

  test('página além do fim devolve lista vazia e metadados coerentes', async () => {
    await aceita();
    const r = await api.req('GET', '/api/produtos?pagina=50&limite=10');
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.dados, []);
    assert.deepEqual(r.corpo.paginacao, { pagina: 50, limite: 10, total: 1, totalPaginas: 1 });
  });

  test('busca repetida na query devolve 400; busca muito longa devolve 200', async () => {
    assert.equal((await api.req('GET', '/api/produtos?busca=a&busca=b')).status, 400);
    assert.equal((await api.req('GET', `/api/produtos?busca=${'a'.repeat(10_000)}`)).status, 200);
  });

  test('busca com espaços só e vazia equivale a sem busca', async () => {
    await aceita();
    for (const q of ['busca=', 'busca=%20%20']) assert.equal((await api.req('GET', `/api/produtos?${q}`)).corpo.paginacao.total, 1, q);
  });

  test('ids inválidos ou fora do intervalo seguro devolvem 400; inexistentes devolvem 404', async () => {
    for (const id of ['99999999999999999999', '1e2', '0x1', '%201', '01a', '-1', '0', '1.0']) {
      assert.equal((await api.req('GET', `/api/produtos/${id}`)).status, 400, id);
    }
    assert.equal((await api.req('GET', '/api/produtos/9007199254740991')).status, 404);
  });

  test('ids com zeros à esquerda apontam para o mesmo produto', async () => {
    const p = await aceita();
    assert.equal((await api.req('GET', `/api/produtos/00${p.id}`)).status, 200);
  });
});

describe('injeção e segurança básica', () => {
  test('texto com aspas e SQL em todos os campos de texto e filtros não altera a base', async () => {
    const sql = "x'); DROP TABLE produtos; --";
    await aceita({ nome: sql, categoria: sql });
    for (const q of [`busca=${encodeURIComponent(sql)}`, `categoria=${encodeURIComponent(sql)}`]) {
      assert.equal((await api.req('GET', `/api/produtos?${q}`)).status, 200);
    }
    assert.equal(api.contar(), 1);
  });
});
