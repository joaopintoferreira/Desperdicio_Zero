const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  JANELA_ALERTA_DIAS, SITUACOES, somarDias, fusoConfigurado, dataHoje, intervaloSituacao, classificar,
} = require('../src/services/validadeService');
const { criarConexao } = require('../src/db/connection');
const { criarApp } = require('../src/app');

describe('classificar — limites (RN01–RN03; PDF cenários 5–8)', () => {
  const hoje = '2026-11-10';

  test('a janela de alerta é 7 dias', () => assert.equal(JANELA_ALERTA_DIAS, 7));
  test('ontem: vencido (cenário 5)', () => assert.equal(classificar('2026-11-09', hoje), 'vencido'));
  test('hoje: proximo, não vencido (cenário 6)', () => assert.equal(classificar('2026-11-10', hoje), 'proximo'));
  test('hoje + 7: proximo (cenário 7)', () => assert.equal(classificar('2026-11-17', hoje), 'proximo'));
  test('hoje + 8: dentro (cenário 8)', () => assert.equal(classificar('2026-11-18', hoje), 'dentro'));
  test('exemplo do PDF (hoje = 10/10): 9 vencido, 10/13/17 a vencer, 18 dentro', () => {
    const r = ['09', '10', '13', '17', '18'].map((d) => classificar(`2026-10-${d}`, '2026-10-10'));
    assert.deepEqual(r, ['vencido', 'proximo', 'proximo', 'proximo', 'dentro']);
  });
  test('muito vencido e muito distante', () => {
    assert.equal(classificar('2000-01-01', hoje), 'vencido');
    assert.equal(classificar('2099-12-31', hoje), 'dentro');
  });

  test('virada de mês: 25/11 + 7 = 02/12', () => {
    assert.equal(classificar('2026-12-02', '2026-11-25'), 'proximo');
    assert.equal(classificar('2026-12-03', '2026-11-25'), 'dentro');
    assert.equal(classificar('2026-11-24', '2026-11-25'), 'vencido');
  });
  test('virada de ano: 28/12 + 7 = 04/01', () => {
    assert.equal(classificar('2027-01-04', '2026-12-28'), 'proximo');
    assert.equal(classificar('2027-01-05', '2026-12-28'), 'dentro');
    assert.equal(classificar('2026-12-27', '2026-12-28'), 'vencido');
  });
  test('ano bissexto: 29/02/2028 existe e entra na soma', () => {
    assert.equal(somarDias('2028-02-24', 5), '2028-02-29');
    assert.equal(somarDias('2028-02-24', 6), '2028-03-01');
    assert.equal(classificar('2028-02-29', '2028-02-22'), 'proximo'); // hoje + 7
    assert.equal(classificar('2028-03-01', '2028-02-22'), 'dentro'); // hoje + 8
  });
  test('ano não bissexto: fevereiro termina em 28', () => {
    assert.equal(somarDias('2027-02-28', 1), '2027-03-01');
    assert.equal(classificar('2027-03-07', '2027-02-28'), 'proximo');
    assert.equal(classificar('2027-03-08', '2027-02-28'), 'dentro');
  });
  test('soma de dias negativa e zero', () => {
    assert.equal(somarDias('2026-03-01', -1), '2026-02-28');
    assert.equal(somarDias('2026-11-10', 0), '2026-11-10');
  });

  test('datas inválidas são recusadas (validade e referência)', () => {
    for (const d of ['2026-02-30', '2026-13-01', '10/11/2026', '', 'abc', null, undefined, 20261110]) {
      assert.throws(() => classificar(d, hoje), TypeError, String(d));
      assert.throws(() => classificar('2026-11-10', d), TypeError, String(d));
    }
  });
  test('situação desconhecida em intervaloSituacao lança erro', () => {
    assert.throws(() => intervaloSituacao('atrasado', hoje), RangeError);
  });
  test('os intervalos cobrem todas as datas sem lacuna nem sobreposição', () => {
    const ints = SITUACOES.map((s) => intervaloSituacao(s, hoje));
    assert.equal(ints[0].min, null);
    assert.equal(somarDias(ints[0].max, 1), ints[1].min);
    assert.equal(somarDias(ints[1].max, 1), ints[2].min);
    assert.equal(ints[2].max, null);
  });
});

describe('data local e fuso (D1)', () => {
  test('instante 02:30 UTC de 10/11 ainda é dia 09/11 em America/Sao_Paulo', () => {
    const agora = new Date('2026-11-10T02:30:00Z');
    assert.equal(dataHoje('America/Sao_Paulo', agora), '2026-11-09');
    assert.equal(agora.toISOString().slice(0, 10), '2026-11-10'); // o erro que se evita
    assert.equal(dataHoje('UTC', agora), '2026-11-10');
  });
  test('03:00 UTC já é meia-noite local do dia 10', () => {
    assert.equal(dataHoje('America/Sao_Paulo', new Date('2026-11-10T03:00:00Z')), '2026-11-10');
    assert.equal(dataHoje('America/Sao_Paulo', new Date('2026-11-10T02:59:59Z')), '2026-11-09');
  });
  test('na meia-noite UTC a classificação usa o dia local', () => {
    const hoje = dataHoje('America/Sao_Paulo', new Date('2026-11-10T00:30:00Z')); // 21:30 do dia 9
    assert.equal(hoje, '2026-11-09');
    assert.equal(classificar('2026-11-09', hoje), 'proximo'); // com UTC seria "vencido"
  });
  test('virada de ano: 01/01 00:30 UTC ainda é 31/12 em São Paulo', () => {
    assert.equal(dataHoje('America/Sao_Paulo', new Date('2027-01-01T00:30:00Z')), '2026-12-31');
  });
  test('fuso padrão e configuração por APP_TIME_ZONE', () => {
    assert.equal(fusoConfigurado({}), 'America/Sao_Paulo');
    assert.equal(fusoConfigurado({ APP_TIME_ZONE: '' }), 'America/Sao_Paulo');
    assert.equal(fusoConfigurado({ APP_TIME_ZONE: 'America/Manaus' }), 'America/Manaus');
  });
  test('fuso inválido falha com erro claro, sem cair em UTC', () => {
    assert.throws(() => fusoConfigurado({ APP_TIME_ZONE: 'Marte/Olimpo' }), /APP_TIME_ZONE inválido: "Marte\/Olimpo"/);
    assert.throws(() => criarApp(criarConexao(':memory:'), { fuso: 'Marte/Olimpo' }), /APP_TIME_ZONE inválido/);
  });
});
