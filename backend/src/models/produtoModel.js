// Acesso ao SQLite para a tabela produtos. Só SQL parametrizado; sem regras de negócio.

const COLUNAS = 'id, nome, codigo, categoria, quantidade, preco_unitario, data_validade';
// Ordenação padrão: validade crescente; id desempata (ordenação estável, RN06).
const ORDEM = 'ORDER BY data_validade ASC, id ASC';

// Escapa % e _ para que a busca trate o texto digitado literalmente.
function padraoLike(texto) {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Monta WHERE e parâmetros a partir dos filtros. Usado por listar e contar,
// garantindo que o total sempre corresponda à lista filtrada.
// filtros: { busca?, categoria?, intervalo?: { min, max } } (limites inclusivos, null = aberto)
function montarFiltro({ busca, categoria, intervalo } = {}) {
  const condicoes = [];
  const params = {};
  if (busca) {
    condicoes.push("(nome LIKE @busca ESCAPE '\\' OR codigo LIKE @busca ESCAPE '\\')");
    params.busca = padraoLike(busca);
  }
  if (categoria) {
    condicoes.push('categoria = @categoria');
    params.categoria = categoria;
  }
  if (intervalo) {
    if (intervalo.min !== null) {
      condicoes.push('data_validade >= @dataMin');
      params.dataMin = intervalo.min;
    }
    if (intervalo.max !== null) {
      condicoes.push('data_validade <= @dataMax');
      params.dataMax = intervalo.max;
    }
  }
  return { where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '', params };
}

function criarProdutoModel(db) {
  return {
    listar(filtros, { limite, deslocamento }) {
      const { where, params } = montarFiltro(filtros);
      return db
        .prepare(`SELECT ${COLUNAS} FROM produtos ${where} ${ORDEM} LIMIT @limite OFFSET @deslocamento`)
        .all({ ...params, limite, deslocamento });
    },

    contar(filtros) {
      const { where, params } = montarFiltro(filtros);
      return db.prepare(`SELECT COUNT(*) AS total FROM produtos ${where}`).get(params).total;
    },

    // Categorias distintas realmente cadastradas, em ordem estável.
    listarCategorias() {
      return db
        .prepare('SELECT DISTINCT categoria FROM produtos ORDER BY categoria COLLATE NOCASE ASC, categoria ASC')
        .all()
        .map((linha) => linha.categoria);
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
