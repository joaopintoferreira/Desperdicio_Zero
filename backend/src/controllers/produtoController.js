// Camada HTTP: extrai parâmetros da requisição e delega ao serviço.
function criarProdutoController(service) {
  return {
    listar: (req, res) => res.json(service.listar(req.query)),
    obter: (req, res) => res.json(service.obter(req.params.id)),
    criar: (req, res) => res.status(201).json(service.criar(req.body)),
    atualizar: (req, res) => res.json(service.atualizar(req.params.id, req.body)),
    remover: (req, res) => {
      service.remover(req.params.id);
      res.status(204).end();
    },
  };
}

module.exports = { criarProdutoController };
