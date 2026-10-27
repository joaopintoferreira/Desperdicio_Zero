const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

// Arquivo do banco fica em backend/data (ignorado pelo git).
// DB_PATH permite apontar para outro arquivo (ou ':memory:' nos testes).
const DB_PATH_PADRAO = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'produtos.db');

function criarConexao(caminho = DB_PATH_PADRAO) {
  if (caminho !== ':memory:') {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new Database(caminho);
  db.pragma('foreign_keys = ON');

  // Cria o esquema se ainda não existir (não altera dados existentes).
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  return db;
}

module.exports = { criarConexao };
