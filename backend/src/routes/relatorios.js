const { Router } = require('express');

function criarRelatoriosRouter(controller) {
  const router = Router();
  router.get('/produtos-a-vencer.csv', controller.produtosAVencerCsv);
  return router;
}

module.exports = { criarRelatoriosRouter };
