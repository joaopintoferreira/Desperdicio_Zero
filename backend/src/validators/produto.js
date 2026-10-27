// Validação dos dados de produto (RN05, formato de data do claude.md §6).
// Devolve os valores já normalizados e um objeto { campo: mensagem } com os erros.

const LIMITES = {
  nome: 120,
  codigo: 50,
  categoria: 60,
  quantidadeMax: 1_000_000,
  precoMaxCentavos: 1_000_000_000, // R$ 10.000.000,00
  anoMin: 1900,
  anoMax: 2100,
};

// Aceita só datas reais em YYYY-MM-DD (rejeita, por ex., 2026-02-30).
function dataValida(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (ano < LIMITES.anoMin || ano > LIMITES.anoMax) return false;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

function validarTexto(valor, campo, rotulo, max, erros) {
  if (typeof valor !== 'string' || valor.trim() === '') {
    erros[campo] = `${rotulo} é obrigatório`;
    return undefined;
  }
  const limpo = valor.trim();
  if (limpo.length > max) {
    erros[campo] = `${rotulo} deve ter no máximo ${max} caracteres`;
    return undefined;
  }
  return limpo;
}

function validarInteiro(valor, campo, rotulo, max, erros) {
  if (valor === undefined || valor === null || valor === '') {
    erros[campo] = `${rotulo} é obrigatório`;
  } else if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    erros[campo] = `${rotulo} deve ser um número inteiro`;
  } else if (valor < 0) {
    erros[campo] = `${rotulo} não pode ser negativo`;
  } else if (valor > max) {
    erros[campo] = `${rotulo} excede o limite permitido`;
  }
  return valor;
}

function validarProduto(corpo) {
  const erros = {};
  const b = corpo && typeof corpo === 'object' && !Array.isArray(corpo) ? corpo : {};

  const nome = validarTexto(b.nome, 'nome', 'Nome', LIMITES.nome, erros);
  const codigo = validarTexto(b.codigo, 'codigo', 'Código', LIMITES.codigo, erros);
  const categoria = validarTexto(b.categoria, 'categoria', 'Categoria', LIMITES.categoria, erros);
  const quantidade = validarInteiro(b.quantidade, 'quantidade', 'Quantidade', LIMITES.quantidadeMax, erros);
  const preco_unitario = validarInteiro(
    b.preco_unitario, 'preco_unitario', 'Preço unitário (em centavos)', LIMITES.precoMaxCentavos, erros,
  );

  let data_validade;
  if (typeof b.data_validade !== 'string' || b.data_validade === '') {
    erros.data_validade = 'Data de validade é obrigatória';
  } else if (!dataValida(b.data_validade)) {
    erros.data_validade = 'Data de validade deve ser uma data real no formato YYYY-MM-DD';
  } else {
    data_validade = b.data_validade;
  }

  return {
    erros,
    valores: { nome, codigo, categoria, quantidade, preco_unitario, data_validade },
  };
}

module.exports = { validarProduto, dataValida, LIMITES };
