const { Router } = require('express');

function criarIndicadoresRouter(controller) {
  const router = Router();
  router.get('/', controller.obter);
  return router;
}

module.exports = { criarIndicadoresRouter };
