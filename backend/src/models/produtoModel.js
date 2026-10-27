// Acesso ao SQLite para a tabela produtos. Só SQL parametrizado; sem regras de negócio.

const COLUNAS = 'id, nome, codigo, categoria, quantidade, preco_unitario, data_validade';
// Ordenação padrão: validade crescente; id desempata (ordenação estável, RN06).
const ORDEM = 'ORDER BY data_validade ASC, id ASC';

// Escapa % e _ para que a busca trate o texto digitado literalmente.
function padraoLike(texto) {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function criarProdutoModel(db) {
  const where = (busca) => (busca ? "WHERE nome LIKE @p ESCAPE '\\' OR codigo LIKE @p ESCAPE '\\'" : '');
  const params = (busca) => (busca ? { p: padraoLike(busca) } : {});

  return {
    listar({ busca, limite, deslocamento }) {
      return db
        .prepare(`SELECT ${COLUNAS} FROM produtos ${where(busca)} ${ORDEM} LIMIT @limite OFFSET @deslocamento`)
        .all({ ...params(busca), limite, deslocamento });
    },

    contar(busca) {
      return db.prepare(`SELECT COUNT(*) AS total FROM produtos ${where(busca)}`).get(params(busca)).total;
    },

    buscarPorId(id) {
      return db.prepare(`SELECT ${COLUNAS} FROM produtos WHERE id = ?`).get(id);
    },

    inserir(p) {
      const info = db
        .prepare(
          `INSERT INTO produtos (nome, codigo, categoria, quantidade, preco_unitario, data_validade)
           VALUES (@nome, @codigo, @categoria, @quantidade, @preco_unitario, @data_validade)`,
        )
        .run(p);
      return Number(info.lastInsertRowid);
    },

    atualizar(id, p) {
      const info = db
        .prepare(
          `UPDATE produtos SET nome=@nome, codigo=@codigo, categoria=@categoria,
             quantidade=@quantidade, preco_unitario=@preco_unitario, data_validade=@data_validade
           WHERE id=@id`,
        )
        .run({ ...p, id });
      return info.changes > 0;
    },

    remover(id) {
      return db.prepare('DELETE FROM produtos WHERE id = ?').run(id).changes > 0;
    },
  };
}

module.exports = { criarProdutoModel };
