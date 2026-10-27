const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const { criarProdutosRouter } = require('./routes/produtos');
const { criarCategoriasRouter } = require('./routes/categorias');
const { criarIndicadoresRouter } = require('./routes/indicadores');
const { criarIndicadoresController } = require('./controllers/indicadoresController');
const { criarIndicadoresService } = require('./services/indicadoresService');
const { criarProdutoController } = require('./controllers/produtoController');
const { criarProdutoService } = require('./services/produtoService');
const { criarProdutoModel } = require('./models/produtoModel');
const { ErroApp } = require('./erros');
const { fusoConfigurado, validarFuso, dataHoje } = require('./services/validadeService');

// Origens autorizadas (CORS): variável CORS_ORIGINS, separadas por vírgula.
// Padrão: apenas o frontend local de desenvolvimento.
function origensPermitidas() {
  const bruto = process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173';
  return bruto.split(',').map((o) => o.trim()).filter(Boolean);
}

// Fábrica do app: recebe a conexão SQLite, o que permite testar sem abrir porta
// nem tocar no banco real. Opções (úteis em testes):
//   hoje: () => 'YYYY-MM-DD'  data de referência da regra de validade
//   fuso: identificador IANA   (padrão: APP_TIME_ZONE ou America/Sao_Paulo)
// Fuso inválido lança erro aqui, na inicialização.
function criarApp(db, opcoes = {}) {
  const fuso = opcoes.fuso !== undefined ? validarFuso(opcoes.fuso) : fusoConfigurado();
  const hoje = opcoes.hoje ?? (() => dataHoje(fuso));
  const app = express();

  app.use(cors({ origin: origensPermitidas() }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRoutes);

  const model = criarProdutoModel(db);
  const service = criarProdutoService(model, { hoje });
  const controller = criarProdutoController(service);
  app.use('/api/produtos', criarProdutosRouter(controller));
  app.use('/api/categorias', criarCategoriasRouter(controller));
  const indicadores = criarIndicadoresController(criarIndicadoresService(model, { hoje }));
  app.use('/api/indicadores', criarIndicadoresRouter(indicadores));

  app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
  });

  // Handler central: sempre JSON; não expõe detalhes internos em erros 5xx.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ErroApp) {
      const corpo = { erro: err.message };
      if (err.detalhes) corpo.detalhes = err.detalhes;
      return res.status(err.status).json(corpo);
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ erro: 'JSON inválido' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ erro: 'Corpo da requisição muito grande' });
    }
    console.error(err);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  });

  return app;
}

module.exports = { criarApp };
