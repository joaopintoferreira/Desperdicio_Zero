const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

// Arquivo do banco fica em backend/data (ignorado pelo git).
// DB_PATH permite apontar para outro arquivo (ou ':memory:' nos testes).
const DB_PATH_PADRAO = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'produtos.db');

const pad = (n) => String(n).padStart(2, '0');

function carimbo(agora = new Date()) {
  return `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}-${pad(agora.getHours())}${pad(agora.getMinutes())}${pad(agora.getSeconds())}`;
}

// Migração aditiva da Fase 6: adiciona `estoque_minimo` a bancos criados antes dela.
// Não apaga nem altera dados: produtos existentes ficam com 0 (sem alerta). Antes de alterar,
// grava uma cópia consistente do banco em <pasta do banco>/backups/ (VACUUM INTO).
// Idempotente: se a coluna já existe, não faz nada e não cria backup.
function migrarEstoqueMinimo(db, caminho) {
  const colunas = db.prepare("PRAGMA table_info('produtos')").all().map((c) => c.name);
  if (colunas.includes('estoque_minimo')) return null;

  let backup = null;
  if (caminho !== ':memory:') {
    const pasta = path.join(path.dirname(path.resolve(caminho)), 'backups');
    fs.mkdirSync(pasta, { recursive: true });
    backup = path.join(pasta, `${path.basename(caminho, path.extname(caminho))}-${carimbo()}-antes-estoque-minimo.db`);
    db.prepare('VACUUM INTO ?').run(backup);
    console.log(`Migração: backup do banco gravado em ${backup}`);
  }

  db.exec('ALTER TABLE produtos ADD COLUMN estoque_minimo INTEGER NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0)');
  return backup;
}

function criarConexao(caminho = DB_PATH_PADRAO) {
  if (caminho !== ':memory:') {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
  }

  const db = new Database(caminho);
  db.pragma('foreign_keys = ON');

  // Cria o esquema se ainda não existir (não altera dados existentes).
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  migrarEstoqueMinimo(db, caminho);

  return db;
}

module.exports = { criarConexao, migrarEstoqueMinimo };
