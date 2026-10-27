// Regras de validade (RN01–RN03) e data local. Única fonte da regra: o frontend só exibe o resultado.
const { dataValida } = require('../validators/produto');

// Janela de alerta em dias (RN02). Único lugar onde o valor 7 aparece.
const JANELA_ALERTA_DIAS = 7;

const SITUACOES = Object.freeze(['vencido', 'proximo', 'dentro']);

const FUSO_PADRAO = 'America/Sao_Paulo';

const pad = (n, tam = 2) => String(n).padStart(tam, '0');

function exigirData(valor, nome) {
  if (typeof valor !== 'string' || !dataValida(valor)) {
    throw new TypeError(`${nome} inválida: esperado uma data real no formato YYYY-MM-DD`);
  }
}

// Soma dias a uma data de calendário 'YYYY-MM-DD'. Usa Date.UTC apenas como calculadora de
// calendário (sem horário local), então não há efeito de horário de verão nem de fuso.
function somarDias(data, dias) {
  const [ano, mes, dia] = data.split('-').map(Number);
  const r = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return `${pad(r.getUTCFullYear(), 4)}-${pad(r.getUTCMonth() + 1)}-${pad(r.getUTCDate())}`;
}

// Garante que o fuso é um identificador IANA válido; falha com mensagem clara (sem cair em UTC).
function validarFuso(fuso) {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: fuso });
  } catch {
    throw new Error(
      `APP_TIME_ZONE inválido: "${fuso}". Use um identificador IANA, por exemplo "${FUSO_PADRAO}".`,
    );
  }
  return fuso;
}

// Lê APP_TIME_ZONE (padrão America/Sao_Paulo) e o valida.
function fusoConfigurado(env = process.env) {
  return validarFuso(env.APP_TIME_ZONE || FUSO_PADRAO);
}

// Data de hoje ('YYYY-MM-DD') no fuso informado. Não usa toISOString (que é UTC).
function dataHoje(fuso, agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(agora);
  const valor = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

// Faixa de datas (limites inclusivos; null = sem limite) de cada situação, dado "hoje".
// Usada tanto para classificar quanto para filtrar no SQL: as duas coisas nunca divergem.
function intervaloSituacao(situacao, hoje) {
  exigirData(hoje, 'Data de referência');
  const limite = somarDias(hoje, JANELA_ALERTA_DIAS);
  switch (situacao) {
    case 'vencido': return { min: null, max: somarDias(hoje, -1) }; // RN01: data < hoje
    case 'proximo': return { min: hoje, max: limite }; // RN02: hoje <= data <= hoje+7
    case 'dentro': return { min: somarDias(limite, 1), max: null }; // RN03: data > hoje+7
    default: throw new RangeError(`Situação desconhecida: ${situacao}`);
  }
}

// Função pura: classifica uma data de validade em relação à data de referência.
function classificar(dataValidade, hoje) {
  exigirData(dataValidade, 'Data de validade');
  return SITUACOES.find((situacao) => {
    const { min, max } = intervaloSituacao(situacao, hoje);
    return (min === null || dataValidade >= min) && (max === null || dataValidade <= max);
  });
}

module.exports = {
  JANELA_ALERTA_DIAS, SITUACOES, FUSO_PADRAO,
  somarDias, validarFuso, fusoConfigurado, dataHoje, intervaloSituacao, classificar,
};
