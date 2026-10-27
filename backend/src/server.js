const { criarConexao } = require('./db/connection');
const { criarApp } = require('./app');

const PORT = process.env.PORT || 3001;

let app;
try {
  app = criarApp(criarConexao()); // abre o banco, garante a tabela e valida APP_TIME_ZONE
} catch (err) {
  console.error(`Falha ao iniciar a API: ${err.message}`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`API Desperdício Zero em http://localhost:${PORT}`);
});
