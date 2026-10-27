// Camada HTTP dos indicadores: delega ao serviço.
function criarIndicadoresController(service) {
  return {
    obter: (req, res) => res.json(service.obter()),
  };
}

module.exports = { criarIndicadoresController };
