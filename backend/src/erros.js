// Erro de aplicação com código HTTP e corpo JSON padronizado.
class ErroApp extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

module.exports = { ErroApp };
