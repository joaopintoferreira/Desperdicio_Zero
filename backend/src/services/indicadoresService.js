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
      const dataRef = hoje(); // lida uma vez: todos os números usam a mesma data
      const intervalos = {
        vencido: intervaloSituacao('vencido', dataRef),
        proximo: intervaloSituacao('proximo', dataRef),
        dentro: intervaloSituacao('dentro', dataRef),
      };
      const todos = model.agregar({});
      const vencidos = model.agregar({ intervalo: intervalos.vencido });
      const aVencer = model.agregar({ intervalo: intervalos.proximo });
      const dentro = model.agregar({ intervalo: intervalos.dentro });
      const estoqueBaixo = model.agregar({ estoqueBaixo: true });

      return {
        total_produtos: todos.produtos, // produtos diferentes cadastrados
        produtos_vencidos: vencidos.produtos,
        produtos_a_vencer: aVencer.produtos,
        produtos_dentro: dentro.produtos,
        valor_em_risco: centavosSeguros(aVencer.valorCentavos), // centavos inteiros
        produtos_estoque_baixo: estoqueBaixo.produtos, // alerta da Fase 6
        // Mesmos indicadores por categoria (para gráficos e relatório); a soma das categorias
        // é igual ao total geral. Ordem: maior valor em risco primeiro, depois nome.
        por_categoria: model.agregarPorCategoria(intervalos).map((c) => ({
          categoria: c.categoria,
          total_produtos: c.produtos,
          produtos_vencidos: c.vencidos,
          produtos_a_vencer: c.aVencer,
          produtos_dentro: c.dentro,
          valor_em_risco: centavosSeguros(c.valorCentavos),
        })),
        janela_alerta_dias: JANELA_ALERTA_DIAS,
        data_referencia: dataRef,
      };
    },
  };
}

module.exports = { criarIndicadoresService, centavosSeguros };
