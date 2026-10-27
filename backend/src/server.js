const { criarConexao } = require('./db/connection');
const { criarApp } = require('./app');

const PORT = process.env.PORT || 3001;

const app = criarApp(criarConexao()); // abre o banco e garante a tabela

app.listen(PORT, () => {
  console.log(`API Desperdício Zero em http://localhost:${PORT}`);
});
