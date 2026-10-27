const { Router } = require('express');

function criarCategoriasRouter(controller) {
  const router = Router();
  router.get('/', controller.categorias);
  return router;
}

module.exports = { criarCategoriasRouter };
