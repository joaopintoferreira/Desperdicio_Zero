// Montagem de CSV (exportação da Fase 6). Pensado para abrir direto no Excel/LibreOffice em pt-BR:
// separador ";", UTF-8 com BOM, quebras CRLF e valores monetários com vírgula decimal.
const BOM = '﻿';
const SEPARADOR = ';';

// Escapa uma célula: aspas duplicadas e campo entre aspas quando necessário. Células de texto que
// começam com = + - @ (ou tab/CR) recebem um apóstrofo para não serem executadas como fórmula.
function celula(valor) {
  let texto = String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// 12345 -> "123,45" (só aritmética inteira, sem ponto flutuante)
function centavosParaDecimal(centavos) {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`;
}

// cabecalho: string[]; linhas: array de arrays de células de texto/número.
// Números inteiros não passam pela proteção contra fórmula (apenas texto).
function montarCsv(cabecalho, linhas) {
  const linha = (cels) => cels.map((c) => (typeof c === 'number' ? String(c) : celula(c))).join(SEPARADOR);
  return BOM + [cabecalho, ...linhas].map(linha).join('\r\n') + '\r\n';
}

module.exports = { montarCsv, centavosParaDecimal, celula };
