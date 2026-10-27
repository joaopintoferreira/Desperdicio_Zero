const { Router } = require('express');

function criarProdutosRouter(controller) {
  const router = Router();
  router.get('/', controller.listar);
  router.get('/:id', controller.obter);
  router.post('/', controller.criar);
  router.put('/:id', controller.atualizar);
  router.delete('/:id', controller.remover);
  return router;
}

module.exports = { criarProdutosRouter };
