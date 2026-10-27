// Regras do CRUD de produtos: valida, traduz erros do banco e aplica paginação.
const { ErroApp } = require('../erros');
const { validarProduto } = require('../validators/produto');

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

function inteiroPositivo(texto, campo, padrao, max) {
  if (texto === undefined || texto === '') return padrao;
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 1 || (max && n > max)) {
    const faixa = max ? `entre 1 e ${max}` : 'maior ou igual a 1';
    throw new ErroApp(400, 'Parâmetros inválidos', { [campo]: `${campo} deve ser um inteiro ${faixa}` });
  }
  return n;
}

function parseId(texto) {
  const n = Number(texto);
  if (!/^\d+$/.test(String(texto)) || !Number.isSafeInteger(n) || n < 1) {
    throw new ErroApp(400, 'Identificador inválido', { id: 'id deve ser um inteiro positivo' });
  }
  return n;
}

function exigirValido(corpo) {
  const { erros, valores } = validarProduto(corpo);
  if (Object.keys(erros).length > 0) throw new ErroApp(400, 'Dados inválidos', erros);
  return valores;
}

// Converte violação de UNIQUE do SQLite em 409; demais erros seguem para o handler (500).
function traduzirErroBanco(err) {
  if (err && err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return new ErroApp(409, 'Código já cadastrado', { codigo: 'Já existe um produto com este código' });
  }
  return err;
}

function criarProdutoService(model) {
  return {
    listar({ busca, pagina, limite }) {
      const termo = typeof busca === 'string' ? busca.trim() : '';
      const paginaN = inteiroPositivo(pagina, 'pagina', 1);
      const limiteN = inteiroPositivo(limite, 'limite', LIMITE_PADRAO, LIMITE_MAXIMO);
      const total = model.contar(termo);
      const dados = model.listar({ busca: termo, limite: limiteN, deslocamento: (paginaN - 1) * limiteN });
      return {
        dados,
        paginacao: { pagina: paginaN, limite: limiteN, total, totalPaginas: Math.ceil(total / limiteN) },
      };
    },

    obter(idTexto) {
      const produto = model.buscarPorId(parseId(idTexto));
      if (!produto) throw new ErroApp(404, 'Produto não encontrado');
      return produto;
    },

    criar(corpo) {
      const valores = exigirValido(corpo);
      try {
        return model.buscarPorId(model.inserir(valores));
      } catch (err) {
        throw traduzirErroBanco(err);
      }
    },

    atualizar(idTexto, corpo) {
      const id = parseId(idTexto);
      const valores = exigirValido(corpo);
      try {
        if (!model.atualizar(id, valores)) throw new ErroApp(404, 'Produto não encontrado');
      } catch (err) {
        throw traduzirErroBanco(err);
      }
      return model.buscarPorId(id);
    },

    remover(idTexto) {
      if (!model.remover(parseId(idTexto))) throw new ErroApp(404, 'Produto não encontrado');
    },
  };
}

module.exports = { criarProdutoService };
