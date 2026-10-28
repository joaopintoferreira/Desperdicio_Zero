// Acesso ao SQLite para a tabela produtos. Só SQL parametrizado; sem regras de negócio.

const COLUNAS = 'id, nome, codigo, categoria, quantidade, preco_unitario, data_validade, estoque_minimo';
// Ordenação padrão: validade crescente; id desempata (ordenação estável, RN06).
const ORDEM = 'ORDER BY data_validade ASC, id ASC';

// Escapa % e _ para que a busca trate o texto digitado literalmente.
function padraoLike(texto) {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Condições de um intervalo de datas (limites inclusivos, null = aberto) com parâmetros nomeados.
function condicoesIntervalo(intervalo, prefixo, params) {
  const c = [];
  if (intervalo.min !== null) { c.push(`data_validade >= @${prefixo}Min`); params[`${prefixo}Min`] = intervalo.min; }
  if (intervalo.max !== null) { c.push(`data_validade <= @${prefixo}Max`); params[`${prefixo}Max`] = intervalo.max; }
  return c;
}

// Monta WHERE e parâmetros a partir dos filtros. Usado por listar, contar e agregar,
// garantindo que o total sempre corresponda à lista filtrada.
// filtros: { busca?, categoria?, intervalo?: { min, max }, estoqueBaixo? }
function montarFiltro({ busca, categoria, intervalo, estoqueBaixo } = {}) {
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
  if (intervalo) condicoes.push(...condicoesIntervalo(intervalo, 'data', params));
  // Mesma regra de services/estoqueService.js (estoqueBaixo), expressa em SQL.
  if (estoqueBaixo) condicoes.push('(estoque_minimo > 0 AND quantidade <= estoque_minimo)');
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

    // Todos os produtos que atendem ao filtro, sem paginação (exportação).
    listarTodos(filtros) {
      const { where, params } = montarFiltro(filtros);
      return db.prepare(`SELECT ${COLUNAS} FROM produtos ${where} ${ORDEM}`).all(params);
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

    // Agregado dos produtos que atendem ao filtro: quantos são e o somatório de quantidade × preço
    // (em centavos). A soma sai como BigInt para não perder precisão antes de o serviço validar.
    agregar(filtros) {
      const { where, params } = montarFiltro(filtros);
      const linha = db
        .prepare(
          `SELECT COUNT(*) AS produtos,
                  COALESCE(SUM(quantidade * preco_unitario), 0) AS valor_centavos
           FROM produtos ${where}`,
        )
        .safeIntegers(true)
        .get(params);
      return { produtos: Number(linha.produtos), valorCentavos: linha.valor_centavos };
    },

    // Contagens por situação e valor em risco, agrupados por categoria. Os intervalos de cada
    // situação vêm do serviço de validade (os mesmos usados em filtros e indicadores).
    // `valorCentavos` é o somatório de quantidade × preço dos produtos da situação `proximo`.
    agregarPorCategoria({ vencido, proximo, dentro }) {
      const params = {};
      const e = (cond) => (cond.length ? cond.join(' AND ') : '1');
      const cV = e(condicoesIntervalo(vencido, 'v', params));
      const cP = e(condicoesIntervalo(proximo, 'p', params));
      const cD = e(condicoesIntervalo(dentro, 'd', params));
      return db
        .prepare(
          `SELECT categoria,
                  COUNT(*) AS produtos,
                  SUM(CASE WHEN ${cV} THEN 1 ELSE 0 END) AS vencidos,
                  SUM(CASE WHEN ${cP} THEN 1 ELSE 0 END) AS a_vencer,
                  SUM(CASE WHEN ${cD} THEN 1 ELSE 0 END) AS dentro,
                  COALESCE(SUM(CASE WHEN ${cP} THEN quantidade * preco_unitario END), 0) AS valor_centavos
           FROM produtos
           GROUP BY categoria
           ORDER BY valor_centavos DESC, categoria COLLATE NOCASE ASC, categoria ASC`,
        )
        .safeIntegers(true)
        .all(params)
        .map((l) => ({
          categoria: l.categoria,
          produtos: Number(l.produtos),
          vencidos: Number(l.vencidos),
          aVencer: Number(l.a_vencer),
          dentro: Number(l.dentro),
          valorCentavos: l.valor_centavos,
        }));
    },

    buscarPorId(id) {
      return db.prepare(`SELECT ${COLUNAS} FROM produtos WHERE id = ?`).get(id);
    },

    inserir(p) {
      const info = db
        .prepare(
          `INSERT INTO produtos (nome, codigo, categoria, quantidade, preco_unitario, data_validade, estoque_minimo)
           VALUES (@nome, @codigo, @categoria, @quantidade, @preco_unitario, @data_validade, @estoque_minimo)`,
        )
        .run(p);
      return Number(info.lastInsertRowid);
    },

    atualizar(id, p) {
      const info = db
        .prepare(
          `UPDATE produtos SET nome=@nome, codigo=@codigo, categoria=@categoria,
             quantidade=@quantidade, preco_unitario=@preco_unitario, data_validade=@data_validade,
             estoque_minimo=@estoque_minimo
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
