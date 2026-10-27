// Indicadores do dashboard (PDF §6.3) e valor em risco (RN04). O frontend só exibe estes números.
//
// RN04: valor em risco = Σ (quantidade × preco_unitario) dos produtos na janela de alerta
//       (hoje ≤ data_validade ≤ hoje + 7), em centavos inteiros. Não inclui vencidos nem
//       produtos dentro da validade. É uma estimativa, não um prejuízo confirmado.
const { ErroApp } = require('../erros');
const { JANELA_ALERTA_DIAS, intervaloSituacao } = require('./validadeService');

// Converte a soma (BigInt) para Number sem perder precisão; acima do limite seguro recusa.
function centavosSeguros(valor) {
  if (valor > BigInt(Number.MAX_SAFE_INTEGER)) {
    console.error('Valor em risco excede o limite de inteiros seguros; resposta recusada.');
    throw new ErroApp(500, 'Erro interno do servidor'); // a resposta não expõe o motivo
  }
  return Number(valor);
}

// `hoje` devolve a data atual 'YYYY-MM-DD' (a mesma usada pela classificação de validade).
function criarIndicadoresService(model, { hoje }) {
  return {
    obter() {
      const dataRef = hoje(); // lida uma vez: os quatro números usam a mesma data
      const todos = model.agregar({});
      const vencidos = model.agregar({ intervalo: intervaloSituacao('vencido', dataRef) });
      const aVencer = model.agregar({ intervalo: intervaloSituacao('proximo', dataRef) });

      return {
        total_produtos: todos.produtos, // produtos diferentes cadastrados
        produtos_vencidos: vencidos.produtos,
        produtos_a_vencer: aVencer.produtos,
        valor_em_risco: centavosSeguros(aVencer.valorCentavos), // centavos inteiros
        janela_alerta_dias: JANELA_ALERTA_DIAS,
        data_referencia: dataRef,
      };
    },
  };
}

module.exports = { criarIndicadoresService, centavosSeguros };
