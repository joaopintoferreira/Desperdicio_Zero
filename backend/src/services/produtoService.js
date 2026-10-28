// Regras do CRUD de produtos: valida, traduz erros do banco e aplica paginação.
const { ErroApp } = require('../erros');
const { validarProduto } = require('../validators/produto');
const { SITUACOES, classificar, intervaloSituacao } = require('./validadeService');
const { estoqueBaixo } = require('./estoqueService');

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

const PAGINA_MAXIMA = 1_000_000; // mantém o OFFSET dentro de inteiros seguros do SQLite

// Parâmetro numérico de paginação: só dígitos (rejeita "1e2", "0x10", " 5", "+5") e dentro do limite.
function inteiroPositivo(texto, campo, padrao, max) {
  if (texto === undefined || texto === '') return padrao;
  const n = typeof texto === 'string' && /^\d+$/.test(texto) ? Number(texto) : NaN;
  if (!Number.isSafeInteger(n) || n < 1 || (max && n > max)) {
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

// Lê um parâmetro de query que deve ser texto simples (rejeita repetido, ex.: ?categoria=a&categoria=b).
function textoOpcional(valor, campo) {
  if (valor === undefined) return '';
  if (typeof valor !== 'string') {
    throw new ErroApp(400, 'Parâmetros inválidos', { [campo]: `${campo} deve ser informado uma única vez` });
  }
  return valor.trim();
}

function lerSituacao(valor) {
  const situacao = textoOpcional(valor, 'situacao');
  if (situacao === '') return undefined; // vazio = sem filtro
  if (!SITUACOES.includes(situacao)) {
    throw new ErroApp(400, 'Parâmetros inválidos', {
      situacao: `situacao deve ser um de: ${SITUACOES.join(', ')}`,
    });
  }
  return situacao;
}

function lerEstoque(valor) {
  const estoque = textoOpcional(valor, 'estoque');
  if (estoque === '') return undefined; // vazio = sem filtro
  if (estoque !== 'baixo') {
    throw new ErroApp(400, 'Parâmetros inválidos', { estoque: 'estoque deve ser: baixo' });
  }
  return estoque;
}

// `hoje` é uma função que devolve a data atual 'YYYY-MM-DD' (injetável nos testes).
function criarProdutoService(model, { hoje }) {
  // Acrescenta os campos calculados pelo backend: situação de validade e alerta de estoque baixo.
  const comSituacao = (produto, dataRef) => ({
    ...produto,
    situacao: classificar(produto.data_validade, dataRef),
    estoque_baixo: estoqueBaixo(produto.quantidade, produto.estoque_minimo),
  });

  return {
    listar({ busca, categoria, situacao, estoque, pagina, limite }) {
      const termo = textoOpcional(busca, 'busca');
      const categoriaTxt = textoOpcional(categoria, 'categoria'); // vazio = sem filtro
      const situacaoSel = lerSituacao(situacao);
      const estoqueSel = lerEstoque(estoque);
      const paginaN = inteiroPositivo(pagina, 'pagina', 1, PAGINA_MAXIMA);
      const limiteN = inteiroPositivo(limite, 'limite', LIMITE_PADRAO, LIMITE_MAXIMO);

      // "hoje" é lido uma vez: o filtro e o campo `situacao` usam a mesma data de referência.
      const dataRef = hoje();
      const filtros = {
        busca: termo,
        categoria: categoriaTxt,
        estoqueBaixo: estoqueSel === 'baixo',
        intervalo: situacaoSel ? intervaloSituacao(situacaoSel, dataRef) : undefined,
      };
      const total = model.contar(filtros);
      const dados = model
        .listar(filtros, { limite: limiteN, deslocamento: (paginaN - 1) * limiteN })
        .map((p) => comSituacao(p, dataRef));
      return {
        dados,
        paginacao: { pagina: paginaN, limite: limiteN, total, totalPaginas: Math.ceil(total / limiteN) },
      };
    },

    obter(idTexto) {
      const produto = model.buscarPorId(parseId(idTexto));
      if (!produto) throw new ErroApp(404, 'Produto não encontrado');
      return comSituacao(produto, hoje());
    },

    listarCategorias() {
      return { dados: model.listarCategorias() };
    },

    criar(corpo) {
      const valores = exigirValido(corpo);
      valores.estoque_minimo ??= 0; // ausente = sem alerta
      try {
        return comSituacao(model.buscarPorId(model.inserir(valores)), hoje());
      } catch (err) {
        throw traduzirErroBanco(err);
      }
    },

    atualizar(idTexto, corpo) {
      const id = parseId(idTexto);
      const valores = exigirValido(corpo);
      try {
        // Campo ausente no PUT preserva o limite mínimo já configurado (clientes antigos não o apagam).
        if (valores.estoque_minimo === undefined) {
          const atual = model.buscarPorId(id);
          if (!atual) throw new ErroApp(404, 'Produto não encontrado');
          valores.estoque_minimo = atual.estoque_minimo;
        }
        if (!model.atualizar(id, valores)) throw new ErroApp(404, 'Produto não encontrado');
      } catch (err) {
        throw traduzirErroBanco(err);
      }
      return comSituacao(model.buscarPorId(id), hoje());
    },

    remover(idTexto) {
      if (!model.remover(parseId(idTexto))) throw new ErroApp(404, 'Produto não encontrado');
    },
  };
}

module.exports = { criarProdutoService };
