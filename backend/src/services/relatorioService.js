// Relatórios exportáveis (Fase 6): lista de produtos a vencer em CSV (PDF §6.5).
const { intervaloSituacao } = require('./validadeService');
const { montarCsv, centavosParaDecimal } = require('./csvService');

const CABECALHO = [
  'Código', 'Nome', 'Categoria', 'Quantidade', 'Preço unitário (R$)', 'Data de validade', 'Valor estimado (R$)',
];

// `hoje` devolve a data atual 'YYYY-MM-DD' (a mesma da classificação de validade).
function criarRelatorioService(model, { hoje }) {
  return {
    // Produtos na janela de alerta (situação "a vencer": hoje … hoje+7), por data de validade e id.
    // O valor estimado de cada linha é quantidade × preço; a soma das linhas é o valor em risco (RN04).
    produtosAVencerCsv() {
      const dataRef = hoje();
      const produtos = model.listarTodos({ intervalo: intervaloSituacao('proximo', dataRef) });
      const linhas = produtos.map((p) => [
        p.codigo, p.nome, p.categoria, p.quantidade,
        centavosParaDecimal(p.preco_unitario), p.data_validade,
        centavosParaDecimal(p.quantidade * p.preco_unitario),
      ]);
      return { nomeArquivo: `produtos-a-vencer-${dataRef}.csv`, conteudo: montarCsv(CABECALHO, linhas) };
    },
  };
}

module.exports = { criarRelatorioService, CABECALHO };
