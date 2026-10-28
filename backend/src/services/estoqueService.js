// Alerta de estoque baixo (PDF §6.5, Fase 6): "limite mínimo definido para cada produto".
//
// Regra adotada: há alerta quando o produto tem limite mínimo (> 0) e a quantidade em estoque é
// menor ou igual a esse limite. Limite 0 significa "sem alerta".
function estoqueBaixo(quantidade, estoqueMinimo) {
  return estoqueMinimo > 0 && quantidade <= estoqueMinimo;
}

module.exports = { estoqueBaixo };
