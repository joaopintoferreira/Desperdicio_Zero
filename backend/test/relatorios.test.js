// Fase 6 — indicadores por categoria (gráficos e relatório) e exportação CSV.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { iniciarApi, produtoValido, HOJE_FIXO } = require('./helpers');
const { montarCsv, centavosParaDecimal, celula } = require('../src/services/csvService');

// HOJE_FIXO = 2026-11-10 → vencido < 11-10 · a vencer 11-10..11-17 · dentro > 11-17
let api;
before(async () => { api = await iniciarApi(); });
after(async () => { await api.fechar(); });
beforeEach(() => { api.db.exec("DELETE FROM produtos; DELETE FROM sqlite_sequence WHERE name='produtos'"); });

let seq = 0;
const criar = (extra) => api.req('POST', '/api/produtos', produtoValido({ codigo: `R${++seq}`, ...extra }));
const indicadores = async () => (await api.req('GET', '/api/indicadores')).corpo;

// Leitor de CSV de teste: respeita aspas ("" = aspas literais) e quebras de linha dentro de campos.
// `delimitadores` simula o programa de planilha: [';'] (só ponto e vírgula) ou [';', ','] (detecção
// automática, que também trata a vírgula como separador fora das aspas).
function lerCsv(texto, delimitadores = [';']) {
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  const t = texto.replace(/^\uFEFF/, '');
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (aspas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i += 1; } else aspas = false; } else campo += c;
    } else if (c === '"') aspas = true;
    else if (delimitadores.includes(c)) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo.replace(/\r$/, '')); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

describe('indicadores por categoria (gráficos e relatório)', () => {
  test('sem produtos: lista vazia e produtos_dentro = 0', async () => {
    const i = await indicadores();
    assert.deepEqual(i.por_categoria, []);
    assert.equal(i.produtos_dentro, 0);
  });

  test('cada categoria traz total, vencidos, a vencer, dentro e valor em risco corretos', async () => {
    await criar({ categoria: 'Laticínios', quantidade: 10, preco_unitario: 500, data_validade: '2026-11-12' }); // a vencer 5000
    await criar({ categoria: 'Laticínios', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-01' }); // vencido
    await criar({ categoria: 'Grãos', quantidade: 8, preco_unitario: 300, data_validade: '2026-11-17' }); // a vencer 2400 (+7)
    await criar({ categoria: 'Grãos', quantidade: 2, preco_unitario: 999, data_validade: '2026-11-18' }); // dentro (+8)
    await criar({ categoria: 'Frios', quantidade: 0, preco_unitario: 800, data_validade: '2026-11-10' }); // a vencer, valor 0
    const { por_categoria } = await indicadores();
    assert.deepEqual(por_categoria, [
      { categoria: 'Laticínios', total_produtos: 2, produtos_vencidos: 1, produtos_a_vencer: 1, produtos_dentro: 0, valor_em_risco: 5000 },
      { categoria: 'Grãos', total_produtos: 2, produtos_vencidos: 0, produtos_a_vencer: 1, produtos_dentro: 1, valor_em_risco: 2400 },
      { categoria: 'Frios', total_produtos: 1, produtos_vencidos: 0, produtos_a_vencer: 1, produtos_dentro: 0, valor_em_risco: 0 },
    ]);
  });

  test('ordem: maior valor em risco primeiro; empate por nome sem diferenciar caixa', async () => {
    await criar({ categoria: 'beta', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    await criar({ categoria: 'Alfa', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    await criar({ categoria: 'Zeta', quantidade: 1, preco_unitario: 900, data_validade: '2026-11-12' });
    assert.deepEqual((await indicadores()).por_categoria.map((c) => c.categoria), ['Zeta', 'Alfa', 'beta']);
  });

  test('a soma das categorias é igual ao total geral e dentro = total − vencidos − a vencer', async () => {
    const datas = ['2026-11-01', '2026-11-09', '2026-11-10', '2026-11-14', '2026-11-17', '2026-11-18', '2027-02-01'];
    for (const [k, data_validade] of datas.entries()) {
      await criar({ categoria: `Cat${k % 3}`, quantidade: k + 1, preco_unitario: 111 * (k + 1), data_validade });
    }
    const i = await indicadores();
    const soma = (campo) => i.por_categoria.reduce((a, c) => a + c[campo], 0);
    assert.equal(soma('total_produtos'), i.total_produtos);
    assert.equal(soma('produtos_vencidos'), i.produtos_vencidos);
    assert.equal(soma('produtos_a_vencer'), i.produtos_a_vencer);
    assert.equal(soma('produtos_dentro'), i.produtos_dentro);
    assert.equal(soma('valor_em_risco'), i.valor_em_risco);
    assert.equal(i.produtos_dentro, i.total_produtos - i.produtos_vencidos - i.produtos_a_vencer);
  });

  test('os cálculos por categoria conferem com um oráculo em BigInt lendo a tabela', async () => {
    const ins = api.db.prepare('INSERT INTO produtos (nome,codigo,categoria,quantidade,preco_unitario,data_validade) VALUES (?,?,?,?,?,?)');
    let n = 0;
    for (const cat of ['A', 'B', 'C', 'D']) {
      for (let d = -5; d <= 12; d += 1) {
        const dia = new Date(Date.UTC(2026, 10, 10 + d)).toISOString().slice(0, 10);
        ins.run('x', `O${n}`, cat, (n * 7) % 50, (n * 331) % 9999, dia);
        n += 1;
      }
    }
    const esperado = {};
    for (const l of api.db.prepare('SELECT categoria c, quantidade q, preco_unitario p, data_validade d FROM produtos').all()) {
      const dias = (Date.parse(l.d) - Date.parse(HOJE_FIXO)) / 86_400_000;
      const e = (esperado[l.c] ??= { v: 0, a: 0, d: 0, valor: 0n });
      if (dias < 0) e.v += 1; else if (dias <= 7) { e.a += 1; e.valor += BigInt(l.q) * BigInt(l.p); } else e.d += 1;
    }
    for (const c of (await indicadores()).por_categoria) {
      const e = esperado[c.categoria];
      assert.deepEqual([c.produtos_vencidos, c.produtos_a_vencer, c.produtos_dentro, BigInt(c.valor_em_risco)], [e.v, e.a, e.d, e.valor], c.categoria);
    }
  });

  test('editar a categoria de um produto move os números entre categorias; excluir remove a categoria', async () => {
    const a = await criar({ categoria: 'X', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    await criar({ categoria: 'Y', quantidade: 1, preco_unitario: 200, data_validade: '2026-11-12' });
    await api.req('PUT', `/api/produtos/${a.corpo.id}`, produtoValido({ codigo: a.corpo.codigo, categoria: 'Y', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' }));
    let cats = (await indicadores()).por_categoria;
    assert.deepEqual(cats.map((c) => [c.categoria, c.valor_em_risco]), [['Y', 300]]);
    await api.req('DELETE', `/api/produtos/${a.corpo.id}`);
    cats = (await indicadores()).por_categoria;
    assert.deepEqual(cats.map((c) => [c.categoria, c.valor_em_risco]), [['Y', 200]]);
  });

  test('os indicadores antigos não mudaram de definição (mesmos valores de antes)', async () => {
    await criar({ quantidade: 10, preco_unitario: 500, data_validade: '2026-11-12' });
    await criar({ quantidade: 8, preco_unitario: 300, data_validade: '2026-11-15' });
    await criar({ quantidade: 5, preco_unitario: 100, data_validade: '2026-11-09' });
    const i = await indicadores();
    assert.deepEqual([i.total_produtos, i.produtos_vencidos, i.produtos_a_vencer, i.valor_em_risco], [3, 1, 2, 7400]);
  });
});

describe('exportação CSV — produtos a vencer (PDF §6.5)', () => {
  const baixar = async () => {
    const resp = await fetch(`${api.base}/api/relatorios/produtos-a-vencer.csv`);
    const bytes = Buffer.from(await resp.arrayBuffer()); // text() descartaria o BOM ao decodificar
    return { status: resp.status, headers: resp.headers, bytes, texto: bytes.toString('utf8') };
  };
  const linhas = (texto) => texto.replace(/^﻿/, '').split('\r\n').filter(Boolean);

  test('cabeçalhos HTTP: CSV UTF-8, anexo com a data de referência no nome', async () => {
    const r = await baixar();
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /^text\/csv; charset=utf-8/);
    assert.equal(r.headers.get('content-disposition'), `attachment; filename="produtos-a-vencer-${HOJE_FIXO}.csv"`);
  });

  test('sem produtos a vencer: só o cabeçalho, com BOM e CRLF', async () => {
    await criar({ data_validade: '2026-11-01' }); // vencido: fora
    await criar({ data_validade: '2026-11-18' }); // dentro: fora
    const { texto, bytes } = await baixar();
    assert.deepEqual([...bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF]); // BOM UTF-8 nos bytes enviados
    assert.deepEqual(linhas(texto), ['Código;Nome;Categoria;Quantidade;Preço unitário (R$);Data de validade;Valor estimado (R$)']);
    assert.ok(texto.endsWith('\r\n'));
  });

  test('só entram os produtos da janela hoje…hoje+7, em ordem de validade e id', async () => {
    await criar({ codigo: 'FORA1', data_validade: '2026-11-09' });
    await criar({ codigo: 'B', nome: 'Beta', data_validade: '2026-11-12' });
    await criar({ codigo: 'A', nome: 'Alfa', data_validade: '2026-11-12' });
    await criar({ codigo: 'HOJE', data_validade: '2026-11-10' });
    await criar({ codigo: 'MAIS7', data_validade: '2026-11-17' });
    await criar({ codigo: 'FORA2', data_validade: '2026-11-18' });
    const cod = linhas((await baixar()).texto).slice(1).map((l) => l.split(';')[0]);
    assert.deepEqual(cod, ['HOJE', 'B', 'A', 'MAIS7']);
  });

  test('valores em reais com vírgula decimal (entre aspas); soma das linhas = valor em risco', async () => {
    await criar({ codigo: 'A', nome: 'A', categoria: 'c', quantidade: 10, preco_unitario: 500, data_validade: '2026-11-12' });
    await criar({ codigo: 'B', nome: 'B', categoria: 'c', quantidade: 3, preco_unitario: 1999, data_validade: '2026-11-13' });
    const { texto } = await baixar();
    const ls = linhas(texto);
    assert.equal(ls[1], 'A;A;c;10;"5,00";2026-11-12;"50,00"');
    assert.equal(ls[2], 'B;B;c;3;"19,99";2026-11-13;"59,97"');
    const reais = lerCsv(texto).slice(1).map((c) => Number(c[6].replace(',', '')));
    assert.equal(reais.reduce((a, v) => a + v, 0), (await indicadores()).valor_em_risco);
  });

  test('textos com ; aspas e quebra de linha são protegidos; fórmulas são neutralizadas', async () => {
    await criar({ codigo: 'Q1', nome: 'Pão; "integral"', categoria: 'a\nb', data_validade: '2026-11-12' });
    await criar({ codigo: 'Q2', nome: '=HYPERLINK("http://x")', categoria: '@soma', data_validade: '2026-11-12' });
    const { texto } = await baixar();
    assert.ok(texto.includes('"Pão; ""integral"""'));
    assert.ok(texto.includes('"a\nb"'));
    assert.ok(texto.includes('"\'=HYPERLINK(""http://x"")"'));
    assert.ok(texto.includes(";'@soma;"));
  });

  test('o CSV reflete alterações e exclusões feitas depois', async () => {
    const p = await criar({ codigo: 'M1', quantidade: 2, preco_unitario: 100, data_validade: '2026-11-12' });
    assert.equal(linhas((await baixar()).texto).length, 2);
    await api.req('DELETE', `/api/produtos/${p.corpo.id}`);
    assert.equal(linhas((await baixar()).texto).length, 1);
  });

  test('só aceita GET (POST cai no 404 em JSON) e não grava nada', async () => {
    await criar({ data_validade: '2026-11-12' });
    const r = await api.req('POST', '/api/relatorios/produtos-a-vencer.csv', {});
    assert.equal(r.status, 404);
    assert.equal(api.contar(), 1);
  });
});

describe('exportação CSV — colunas e vírgula decimal (correção)', () => {
  const baixarTexto = async () => {
    const resp = await fetch(`${api.base}/api/relatorios/produtos-a-vencer.csv`);
    return Buffer.from(await resp.arrayBuffer()).toString('utf8');
  };
  const CABECALHO = ['Código', 'Nome', 'Categoria', 'Quantidade', 'Preço unitário (R$)', 'Data de validade', 'Valor estimado (R$)'];

  test('exemplo Cebola: 25 × R$ 5,99 → preço 5,99 e valor estimado 149,75, em 7 colunas', async () => {
    await criar({ codigo: '1', nome: 'Cebola', categoria: 'Alimento', quantidade: 25, preco_unitario: 599, data_validade: '2026-11-12' });
    const texto = await baixarTexto();
    // linha bruta: os valores com vírgula vão entre aspas
    assert.equal(texto.replace(/^\uFEFF/, '').split('\r\n')[1], '1;Cebola;Alimento;25;"5,99";2026-11-12;"149,75"');
    for (const delims of [[';'], [';', ',']]) {
      const l = lerCsv(texto, delims);
      assert.deepEqual(l[0], CABECALHO, `cabeçalho com ${JSON.stringify(delims)}`);
      assert.deepEqual(l[1], ['1', 'Cebola', 'Alimento', '25', '5,99', '2026-11-12', '149,75'], `linha com ${JSON.stringify(delims)}`);
    }
  });

  test('toda linha tem exatamente 7 colunas, mesmo se o leitor tratar a vírgula como separador', async () => {
    const nomes = ['Simples', 'Arroz, tipo 1', 'Pão; "integral"', 'Açúcar refinado União', 'a\nb', '=SOMA(1;2)', "O'Brien", 'Café, "forte"; 100%'];
    for (const [k, nome] of nomes.entries()) {
      await criar({ codigo: `C${k}`, nome, categoria: k % 2 ? 'Mercearia, geral' : 'Bebidas', quantidade: k * 7 + 1, preco_unitario: 100 + k * 133, data_validade: '2026-11-12' });
    }
    const texto = await baixarTexto();
    for (const delims of [[';'], [';', ',']]) {
      const l = lerCsv(texto, delims);
      assert.equal(l.length, nomes.length + 1);
      for (const [i, cols] of l.entries()) assert.equal(cols.length, 7, `linha ${i} com ${JSON.stringify(delims)}: ${JSON.stringify(cols)}`);
    }
  });

  test('preços e valores com centavos variados ficam inteiros na célula e iguais à conta em centavos', async () => {
    const itens = [[1, 1], [3, 1999], [7, 5], [12, 333], [999, 7], [1, 100000], [2, 99]];
    for (const [k, [quantidade, preco_unitario]] of itens.entries()) {
      await criar({ codigo: `V${k}`, nome: `P${k}`, categoria: 'c', quantidade, preco_unitario, data_validade: '2026-11-12' });
    }
    const l = lerCsv(await baixarTexto(), [';', ',']).slice(1);
    const fmt = (c) => `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`;
    for (const [k, [quantidade, preco]] of itens.entries()) {
      assert.equal(l[k][4], fmt(preco), `preço ${k}`);
      assert.equal(l[k][6], fmt(quantidade * preco), `valor ${k}`);
    }
  });

  test('nome e categoria com ;  "  , quebra de linha e acentos voltam idênticos depois de lidos', async () => {
    const nome = 'Pão de Açúcar; "integral", 500g\nlote 2';
    const categoria = 'Padaria, Confeitaria; “Premium”';
    await criar({ codigo: 'ESC', nome, categoria, quantidade: 2, preco_unitario: 1050, data_validade: '2026-11-12' });
    for (const delims of [[';'], [';', ',']]) {
      const [, cols] = lerCsv(await baixarTexto(), delims);
      assert.equal(cols.length, 7);
      assert.equal(cols[1], nome);
      assert.equal(cols[2], categoria);
      assert.equal(cols[4], '10,50');
      assert.equal(cols[6], '21,00');
    }
  });

  test('BOM UTF-8 preservado e proteção contra fórmulas mantida (com e sem vírgula)', async () => {
    await criar({ codigo: 'F1', nome: '=1+1', categoria: '@x, y', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    await criar({ codigo: 'F2', nome: '-2+3', categoria: '+SOMA(A1,A2)', quantidade: 1, preco_unitario: 100, data_validade: '2026-11-12' });
    const resp = await fetch(`${api.base}/api/relatorios/produtos-a-vencer.csv`);
    const bytes = Buffer.from(await resp.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF]);
    const l = lerCsv(bytes.toString('utf8'), [';', ',']);
    assert.equal(l[1][1], "'=1+1");
    assert.equal(l[1][2], "'@x, y");
    assert.equal(l[2][1], "'-2+3");
    assert.equal(l[2][2], "'+SOMA(A1,A2)");
    for (const cols of l) assert.equal(cols.length, 7);
  });

  test('sem produtos a vencer: cabeçalho com 7 colunas e nenhuma linha de dados', async () => {
    const l = lerCsv(await baixarTexto(), [';', ',']);
    assert.equal(l.length, 1);
    assert.deepEqual(l[0], CABECALHO);
  });
});

describe('csvService — vírgula e número de colunas (unidade)', () => {
  test('célula com vírgula vai entre aspas; sem vírgula/;/aspas/quebra não leva aspas', () => {
    assert.equal(celula('5,99'), '"5,99"');
    assert.equal(celula('149,75'), '"149,75"');
    assert.equal(celula('Arroz, tipo 1'), '"Arroz, tipo 1"');
    assert.equal(celula('simples'), 'simples');
    assert.equal(celula('2026-11-12'), '2026-11-12');
  });
  test('fórmula com vírgula: apóstrofo primeiro e aspas por fora', () => {
    assert.equal(celula('=SOMA(A1,A2)'), '"\'=SOMA(A1,A2)"');
  });
  test('montarCsv recusa linha com número de colunas diferente do cabeçalho', () => {
    assert.throws(() => montarCsv(['a', 'b'], [['1']]), /1 colunas; o cabeçalho tem 2/);
    assert.throws(() => montarCsv(['a', 'b'], [['1', '2', '3']]), /3 colunas/);
    assert.equal(montarCsv(['a', 'b'], [['1,5', 2]]), '\uFEFFa;b\r\n"1,5";2\r\n');
  });
});

describe('csvService (unidade)', () => {
  test('centavosParaDecimal', () => {
    assert.equal(centavosParaDecimal(0), '0,00');
    assert.equal(centavosParaDecimal(5), '0,05');
    assert.equal(centavosParaDecimal(123456), '1234,56');
  });
  test('celula: aspas, separador, quebra de linha e prefixos perigosos', () => {
    assert.equal(celula('simples'), 'simples');
    assert.equal(celula('a;b'), '"a;b"');
    assert.equal(celula('a"b'), '"a""b"');
    for (const c of ['=1+1', '+1', '-1', '@x', '\tx']) assert.ok(celula(c).startsWith("'") || celula(c).startsWith('"\''), c);
  });
  test('montarCsv usa ; e CRLF e não protege números', () => {
    assert.equal(montarCsv(['a', 'b'], [[1, 'x'], [-2, 'y']]), '﻿a;b\r\n1;x\r\n-2;y\r\n');
  });
});
