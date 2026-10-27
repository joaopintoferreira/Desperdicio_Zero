-- Tabela de produtos (claude.md §6)
-- preco_unitario: inteiro em centavos (ex.: R$ 5,00 = 500)
-- data_validade: texto 'YYYY-MM-DD' (permite comparar e ordenar como string)
CREATE TABLE IF NOT EXISTS produtos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT    NOT NULL,
  codigo         TEXT    NOT NULL UNIQUE,
  categoria      TEXT    NOT NULL,
  quantidade     INTEGER NOT NULL CHECK (quantidade >= 0),
  preco_unitario INTEGER NOT NULL CHECK (preco_unitario >= 0),
  data_validade  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produtos_data_validade ON produtos (data_validade);
