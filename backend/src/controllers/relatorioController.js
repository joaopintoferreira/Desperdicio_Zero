// Camada HTTP dos relatórios: devolve o CSV como anexo.
function criarRelatorioController(service) {
  return {
    produtosAVencerCsv: (req, res) => {
      const { nomeArquivo, conteudo } = service.produtosAVencerCsv();
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
      res.send(conteudo);
    },
  };
}

module.exports = { criarRelatorioController };
