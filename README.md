# Desperdício Zero

Aplicação web Full Stack para **controle de estoque e de validade de produtos**, voltada a pequenos mercados, mercearias e minimercados. Projeto acadêmico.

> **Estado atual: Fases 1 e 2 concluídas e homologadas; Fase 3 (classificação de validade e filtros) implementada e verificada por testes automatizados — a validação manual da Fase 3 está PENDENTE do usuário.** Dashboard e valor em risco (Fase 4) **ainda não existem**.

## Homologação da Fase 2

| Verificação | Estado | Quem/como |
|---|---|---|
| Fase 1 (estrutura, API, banco, health) | Concluída e aprovada | Auditoria e correções registradas no histórico de trabalho |
| CRUD da Fase 2 | Implementado | — |
| Testes do backend (na homologação da Fase 2) | 42/42 aprovados | Automatizado, executado em 2026-10-27 |
| Testes do frontend | 5/5 aprovados | Automatizado (`cd frontend && npm test`), executado em 2026-10-27 |
| Build do frontend | Aprovado | `cd frontend && npm run build`, executado em 2026-10-27 |
| CRUD e persistência no SQLite real | Validados | Execução ponta a ponta com `curl`, incluindo reinício do servidor |
| Interface no navegador | Validada manualmente | **Realizada pelo usuário** (não repetida pelo assistente) |
| Busca, cadastro, edição e exclusão na interface | Validados | **Informado pelo usuário** |
| Responsividade, navegação por teclado, diálogos (Esc), formato `R$ X,XX` | **Não confirmados individualmente** | O usuário informou a validação geral da interface; estes itens não foram listados um a um |

Os testes automatizados do frontend cobrem apenas as funções de moeda e data; os componentes React não têm testes automatizados.

## 1–3. Problema, justificativa e objetivos

**Problema.** O controle manual das datas de validade dificulta identificar a tempo produtos que precisam de atenção; sem acompanhamento, há perdas, desperdício e prejuízo financeiro.

**Justificativa.** O sistema centraliza as informações dos produtos e, nas fases seguintes, destacará os itens prioritários — não é apenas um CRUD. Não promete eliminar o desperdício: fornece informação para reduzi-lo.

**Objetivo geral.** Gerir produtos e datas de validade, contribuindo para um estoque mais eficiente e menos desperdício.

**Objetivos específicos:** cadastrar e gerir produtos · consultar e atualizar o estoque · identificar vencidos e próximos do vencimento · pesquisar e filtrar · apresentar indicadores · estimar o valor em risco · código organizado, testável e de fácil manutenção.

## 4. Público-alvo e contexto

Pequenos mercados, mercearias, minimercados e estabelecimentos com produtos de prazo de validade. Projeto acadêmico de desenvolvimento web Full Stack (interface, regras de negócio, banco de dados, testes e organização de software).

## 5. Funcionalidades

| Estado | Funcionalidade |
|---|---|
| ✅ Implementado e testado | RF01 cadastrar · RF02 listar (ordenado por validade) · RF03 editar com validação · RF04 excluir com confirmação · pesquisa por nome/código · paginação · validação (frontend e backend) |
| ✅ Implementado e testado automaticamente (Fase 3); validação manual pendente | RF05 classificar vencido / a vencer / dentro da validade (`situacao`) · RF06 filtrar por situação e por categoria, combinados com busca e paginação · selo com cor **e** texto |
| ⏳ Pendente (Fase 4) | Dashboard com 4 indicadores · RF07 valor em risco |
| ⏳ Pendente (Fase 5) | Testes de fronteira de validade, responsividade e mensagens refinadas |
| 💡 Opcional (Fase 6) | Exportação CSV, relatório PDF, alerta de estoque baixo |

## 6. Tecnologias e justificativa

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | React 19 + Vite 6 | Stack aprovada; componentes reutilizáveis; build rápido |
| Backend | Node.js 20 + Express 5 | Stack aprovada; API HTTP simples |
| Banco | SQLite3 via `better-sqlite3` | Persistente, sem servidor, API síncrona simples |
| Testes | `node:test` (embutido no Node) | Sem dependência extra |

Nenhuma biblioteca de UI ou de estado foi adicionada. Dependências do frontend: apenas `react`, `react-dom`, `vite`, `@vitejs/plugin-react`.

## 7. Arquitetura

```mermaid
flowchart LR
  U[Usuário] --> F[Frontend React<br/>:5173]
  F -- "HTTP / JSON" --> R[Rotas Express]
  subgraph Backend :3001
    R --> C[Controllers] --> S[Services<br/>validação + regras] --> M[Models<br/>SQL parametrizado]
    S --> V[Validators]
  end
  M --> DB[(SQLite<br/>backend/data/produtos.db)]
```

O frontend nunca acessa o arquivo do banco. Regras de negócio ficam **só no backend**; o frontend apenas valida campos vazios/negativos/tipos para melhorar a experiência.

## 8. Estrutura de pastas

```
desperdicio-zero/
├── backend/
│   ├── src/
│   │   ├── app.js                 # fábrica do app Express (CORS, JSON, rotas, erros)
│   │   ├── server.js              # abre o banco e escuta a porta
│   │   ├── erros.js               # ErroApp (status HTTP + detalhes)
│   │   ├── db/                    # connection.js (abre SQLite) e schema.sql
│   │   ├── routes/                # health.js, produtos.js, categorias.js
│   │   ├── controllers/           # camada HTTP
│   │   ├── services/              # produtoService (CRUD, filtros, paginação) e validadeService (RN01–RN03, data local)
│   │   ├── validators/produto.js  # validação de produto e de data real
│   │   └── models/                # acesso ao SQLite
│   ├── test/                      # testes node:test
│   └── data/                      # produtos.db (ignorado pelo git)
├── frontend/
│   ├── src/
│   │   ├── components/            # Sidebar, Header, SeloSituacao, ProdutoCard, ProdutoForm, Modal, ConfirmarExclusao, Icones
│   │   ├── pages/                 # HomePage, ProdutosPage
│   │   ├── services/api.js        # comunicação com a API
│   │   └── utils/                 # moeda.js (reais↔centavos), data.js (apresentação)
│   └── index.html
└── README.md
```

## 9. Modelo de dados — tabela `produtos`

| Campo | Tipo | Restrição |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| nome | TEXT | NOT NULL |
| codigo | TEXT | NOT NULL UNIQUE |
| categoria | TEXT | NOT NULL (campo de texto) |
| quantidade | INTEGER | NOT NULL, CHECK (quantidade >= 0) |
| preco_unitario | INTEGER | NOT NULL, CHECK (>= 0) — **centavos** |
| data_validade | TEXT | NOT NULL — `YYYY-MM-DD` |

Índice `idx_produtos_data_validade` em `data_validade`. O formato da data **não** tem `CHECK` no banco: é validado pela API.

## 10. Regras de negócio

| Código | Regra | Estado |
|---|---|---|
| RN01 | Vencido = `data_validade < hoje` (hoje não é vencido) | ✅ Implementado e testado automaticamente |
| RN02 | A vencer (`proximo`) = `hoje ≤ validade ≤ hoje+7` (limites inclusivos) | ✅ Implementado e testado automaticamente |
| RN03 | Dentro da validade (`dentro`) = `validade > hoje+7` | ✅ Implementado e testado automaticamente |
| RN04 | Valor em risco = Σ(quantidade × preço) dos "próximos"; vencidos fora | ⏳ Fase 4 |
| RN05 | quantidade ≥ 0 e preço ≥ 0, em inteiros (centavos) | ✅ Implementado e testado |
| RN06 | Ordenação por `data_validade ASC, id ASC` (estável) | ✅ Implementado e testado |
| RN07 | MVP só alerta, sem bloqueios | — |

**Como a validade é calculada (Fase 3).** Tudo em `backend/src/services/validadeService.js`; o frontend apenas exibe o campo `situacao`.

- **Constante única:** `JANELA_ALERTA_DIAS = 7` (RN02). A janela não é configurável em tempo de execução (fora do escopo do MVP).
- **Data de hoje:** calculada no backend no fuso **`America/Sao_Paulo`** (padrão), configurável por `APP_TIME_ZONE`. Usa `Intl.DateTimeFormat`, nunca `toISOString()` (que é UTC e daria o dia errado à noite no Brasil).
- **Aritmética de calendário:** `hoje + 7` é somado sobre ano/mês/dia, não em milissegundos; não sofre efeito de horário de verão.
- **Fuso inválido** em `APP_TIME_ZONE` impede a API de iniciar, com mensagem clara (não cai silenciosamente para UTC).
- **Um só conjunto de limites** serve para classificar e para filtrar no SQL (`intervaloSituacao`), então o campo `situacao` e o filtro `?situacao=` nunca divergem.
- Datas inválidas ou fora de `YYYY-MM-DD` real são recusadas.

**Decisões registradas.** (1) O PDF chama as RNs de "propostas a confirmar" e o `claude.md` de "definidas"; o usuário decidiu adotá-las como definidas. (2) Textos de dias restantes ("vence em 3 dias") ficaram fora do escopo. (3) O PDF deixa em aberto se quantidade 0 é permitida; `claude.md` fixa `≥ 0` — adotado `≥ 0`.

## 11. API

Base: `http://localhost:3001/api`. Corpo e respostas em JSON. Erros: `{ "erro": "mensagem", "detalhes": { "campo": "mensagem" } }`.

| Método | Rota | Descrição | Sucesso | Erros |
|---|---|---|---|---|
| GET | `/health` | Verifica a API | 200 `{"status":"ok"}` | — |
| GET | `/produtos?busca=&categoria=&situacao=&pagina=1&limite=20` | Lista ordenada; `busca` filtra nome ou código (parcial); `categoria` filtra por igualdade exata; `situacao` = `vencido`, `proximo` ou `dentro`; `limite` 1–100. Parâmetro vazio = sem filtro. Os filtros combinam-se (E) e valem antes da paginação | 200 `{dados, paginacao:{pagina,limite,total,totalPaginas}}` | 400 parâmetros inválidos (inclui `situacao` fora da lista e parâmetro repetido) |
| GET | `/categorias` | Categorias distintas realmente cadastradas, em ordem alfabética estável | 200 `{"dados": ["Grãos", "Laticínios"]}` (lista vazia sem produtos) | — |
| GET | `/produtos/:id` | Consulta um produto | 200 | 400 id inválido · 404 |
| POST | `/produtos` | Cria | 201 produto criado | 400 dados inválidos · 409 código duplicado |
| PUT | `/produtos/:id` | Atualiza (todos os campos) | 200 | 400 · 404 · 409 |
| DELETE | `/produtos/:id` | Exclui | 204 | 400 · 404 |

Qualquer rota inexistente: **404** JSON. JSON malformado: **400** JSON. Corpo > 100 kb: 413. Falha interna: 500 genérico (sem detalhes internos).

Todas as respostas de produto (`GET`, `POST`, `PUT`) incluem **`situacao`** (`vencido`, `proximo` ou `dentro`), calculada pelo backend e **não aceita na entrada**. Exemplo, com hoje = 2026-11-10:
```json
{ "id": 3, "nome": "Queijo Minas", "codigo": "QUE1", "categoria": "Laticínios",
  "quantidade": 10, "preco_unitario": 599, "data_validade": "2026-11-17", "situacao": "proximo" }
```
Erro de filtro: `GET /api/produtos?situacao=atrasado` → 400 `{"erro":"Parâmetros inválidos","detalhes":{"situacao":"situacao deve ser um de: vencido, proximo, dentro"}}`.

Corpo de `POST`/`PUT`:
```json
{ "nome": "Leite Integral 1L", "codigo": "LEI001", "categoria": "Laticínios",
  "quantidade": 10, "preco_unitario": 599, "data_validade": "2026-11-15" }
```
`quantidade` e `preco_unitario` devem ser **números inteiros** (o preço em centavos: R$ 5,99 = 599); `data_validade` deve ser uma data real `YYYY-MM-DD` (2026-02-30 é rejeitada).

```bash
curl -X POST localhost:3001/api/produtos -H 'Content-Type: application/json' \
  -d '{"nome":"Leite","codigo":"LEI001","categoria":"Laticínios","quantidade":10,"preco_unitario":599,"data_validade":"2026-11-15"}'
curl "localhost:3001/api/produtos?busca=leit&limite=5"
curl "localhost:3001/api/produtos?situacao=proximo&categoria=Latic%C3%ADnios&pagina=1"
curl localhost:3001/api/categorias
curl -X DELETE localhost:3001/api/produtos/1
```

## 12–14. Pré-requisitos, instalação e configuração

- Node.js 20 (testado com v20.20.2) e npm 10 (testado com 10.8.2).
- Instalação (cada pasta separadamente):

```bash
cd backend  && npm install
cd frontend && npm install
```

| Variável | Onde | Padrão | Função |
|---|---|---|---|
| `PORT` | backend | `3001` | Porta da API |
| `DB_PATH` | backend | `backend/data/produtos.db` | Arquivo SQLite (`:memory:` aceito) |
| `CORS_ORIGINS` | backend | `http://localhost:5173,http://127.0.0.1:5173` | Origens permitidas, separadas por vírgula. Origens não listadas não recebem cabeçalho CORS |
| `APP_TIME_ZONE` | backend | `America/Sao_Paulo` | Fuso usado para "hoje" na regra de validade (identificador IANA). Inválido = a API não inicia |
| `VITE_API_URL` | frontend | `http://localhost:3001/api` | URL da API |

O banco e a tabela são criados automaticamente ao iniciar o backend; dados existentes não são alterados.

## 15–16. Execução, testes e build

Terminais separados:

```bash
cd backend  && npm start        # API em http://localhost:3001  (npm run dev recarrega ao editar)
cd frontend && npm run dev      # UI em http://localhost:5173
```
```bash
cd backend  && npm test         # 88 testes (API, validade, filtros, persistência)
cd frontend && npm test         # 5 testes (conversão de moeda e data)
cd frontend && npm run build    # build de produção em frontend/dist
```

## 18. Validação e tratamento de erros

- **Servidor (definitiva):** campos obrigatórios; textos com limite de tamanho; `quantidade`/`preco_unitario` inteiros ≥ 0 e dentro de limite; data real `YYYY-MM-DD` (confere o dia no calendário, anos 1900–2100); código único (violação de UNIQUE do SQLite vira 409); id inteiro positivo. Falha de validação **não grava** nada.
- **Cliente (conveniência):** campos vazios, valores negativos e tipos; o preço é digitado em reais e convertido para centavos inteiros sem ponto flutuante antes do envio. Erros do servidor por campo são exibidos junto ao campo.
- Todo SQL usa parâmetros; a busca escapa `%` e `_`.

## 19. Testes e resultados obtidos

Última execução (2026-10-27, Node 20.20.2), na conclusão da Fase 3:

| Comando | Resultado |
|---|---|
| `cd backend && npm test` | **88 de 88 passaram** (42 da Fase 2 + 46 da Fase 3) |
| `cd frontend && npm test` | **5 de 5 passaram** |
| `cd frontend && npm run build` | ✅ concluído |
| Ponta a ponta com o banco SQLite real (curl), na Fase 2: criar → editar → reiniciar → consultar → excluir | ✅ dados persistiram após reinício; 400 e 404 em JSON conferidos |
| Fase 3 com o **relógio real**, banco temporário (curl): produtos com validade ontem, hoje, +7 e +8 dias em São Paulo | ✅ `vencido`, `proximo`, `proximo`, `dentro`; filtros e `/categorias` coerentes |
| `APP_TIME_ZONE=Marte/Olimpo node src/server.js` | ✅ a API não inicia; mensagem clara e código de saída 1 |

**Testes novos da Fase 3** (`backend/test/validade.test.js` e `filtros.test.js`, data de referência fixa em 2026-11-10, nunca o relógio real): limites ontem/hoje/+7/+8 (cenários PDF 5–8) e o exemplo do PDF (hoje = 10/10); virada de mês e de ano; 29/02 bissexto e ano não bissexto; datas inválidas; instante que cruza a meia-noite UTC e ainda é outro dia em São Paulo; fuso padrão, configurado e inválido; `situacao` em POST/GET/PUT/listagem; cada filtro isolado e todas as combinações com busca e paginação; total e metadados; 400 para situação inválida ou repetida; coerência `situacao` × filtro; ordenação estável; `/api/categorias` (vazia, distintas, ordem, reflexo de edição e exclusão). A interface React **não** tem testes automatizados.

Testes do backend usam banco `:memory:` ou arquivo temporário, nunca `backend/data`.

## 13. Rastreabilidade (documentos → implementação)

| Requisito | Implementação | Teste | Estado |
|---|---|---|---|
| RF01 cadastrar | `POST /produtos`, `ProdutoForm` | criação válida, campos ausentes (cenários PDF 1, 2) | ✅ testado (API) |
| RF02 listar por validade | `GET /produtos` | ordenação estável, lista vazia (PDF 13, 16) | ✅ testado (API) |
| RF03 atualizar com validação | `PUT /produtos/:id` | edição válida/ inválida (PDF 9) | ✅ testado (API) |
| RF04 excluir com confirmação | `DELETE`, `ConfirmarExclusao` | exclusão, 404 (PDF 10) | ✅ API testada · confirmação na UI validada manualmente pelo usuário (informado) |
| Preço negativo / quantidade negativa | validador + `CHECK` | PDF 3 e 4 | ✅ testado |
| Pesquisa nome/código | `?busca=` | busca isolada e combinada | ✅ testado (API) |
| RN05, RN06 | validador, `ORDER BY` | sim | ✅ |
| RNF04 validação front + back | `validators`, `ProdutoForm` | back testado; front não automatizado | ⚠️ parcial |
| RNF06 consistência indicadores | — | — | ⏳ Fase 4 |
| RF05 classificar vencidos e próximos; RN01, RN02, RN03 | `validadeService.classificar`, campo `situacao`, `SeloSituacao` | `validade.test.js`, `filtros.test.js` (PDF cenários 5, 6, 7, 8) | ✅ testado (API). Selo na UI: **validação manual pendente** |
| PDF §6.1 cor + texto | `SeloSituacao` (texto "Vencido", "A vencer", "Dentro da validade" + cor) | — (sem teste de componente) | ⏳ validação manual pendente |
| RF06 filtrar por situação (PDF cenário 12) | `?situacao=`, seletor "Situação" | situação isolada, combinada, inválida | ✅ API testada · UI: validação manual pendente |
| RF06 filtrar por categoria (PDF cenário 11) | `?categoria=`, `GET /categorias`, seletor "Categoria" | categoria isolada, combinada, lista de categorias | ✅ API testada · UI: validação manual pendente |
| Ordenação com filtros (PDF cenário 13; RN06) | `ORDER BY data_validade ASC, id ASC` | desempate por id com filtro | ✅ testado |
| Data local (decisão D1) | `dataHoje`, `APP_TIME_ZONE` | fronteira UTC × São Paulo, fuso inválido | ✅ testado |
| RF07, RN04, cenários PDF 14, 15 | — | — | ⏳ Fase 4 |
| RNF08 responsividade | CSS com `@media` | — | ⚠️ não confirmada individualmente (validação geral da UI feita pelo usuário) |
| RNF05 segurança básica | sem credenciais; CORS restrito | CORS testado | ✅ |

## 20. Uso da interface

**Home:** apresentação (indicadores virão na Fase 4). **Produtos:** lista à esquerda com busca (por nome ou código, com atraso de 300 ms), seletores **Situação** (Todas, Vencido, A vencer, Dentro da validade) e **Categoria** (Todas + as categorias reais cadastradas, carregadas da API), botão **Atualizar**, **Novo produto**, **Editar** e **Excluir** (pede confirmação) em cada item; paginação de 10 em 10. Cada produto mostra um selo com a situação (texto + cor). Mudar busca ou filtro volta à página 1; os filtros são enviados ao backend, não aplicados no navegador. À direita, painel de resumo reservado para a Fase 4. Preços aparecem como `R$ X,XX`. Diálogos fecham com Esc.

### Lista de verificação manual da Fase 3 (a ser executada pelo usuário)

**Estado: PENDENTE — nenhuma etapa abaixo foi marcada como concluída.**

Use produtos de teste (e apague-os depois) e anote a data de hoje (fuso de São Paulo):

- [ ] Cadastrar um produto com validade **ontem** → selo "Vencido".
- [ ] Cadastrar um produto com validade **hoje** → selo "A vencer" (hoje não é vencido).
- [ ] Cadastrar um produto com validade **daqui a 7 dias** → selo "A vencer".
- [ ] Cadastrar um produto com validade **daqui a 8 dias** → selo "Dentro da validade".
- [ ] Filtro **Situação** = Vencido / A vencer / Dentro da validade mostra só os produtos correspondentes; "Todas as situações" mostra todos.
- [ ] Filtro **Categoria**: a lista contém só categorias de produtos cadastrados; escolher uma mostra só os produtos dela; "Todas as categorias" limpa o filtro.
- [ ] Combinar busca + situação + categoria devolve só os produtos que atendem aos três.
- [ ] Com mais de 10 resultados filtrados, "Anterior/Próxima" e "Página X de Y" estão corretos.
- [ ] Estando na página 2 ou mais, alterar busca, situação ou categoria volta à página 1.
- [ ] Excluir o último produto de uma categoria faz a categoria sumir da lista (e o filtro é limpo se ela estava selecionada).
- [ ] Parar o backend: aparecem mensagens de erro, sem opções de categoria inventadas.
- [ ] Legibilidade: o selo é compreensível sem enxergar a cor (o texto basta) e tem contraste adequado; Tab alcança os seletores e a seleção funciona pelo teclado.
- [ ] Editar o produto de validade ontem para daqui a 8 dias atualiza o selo.

## 21. Resolução de problemas

| Sintoma | Causa e solução |
|---|---|
| `npm install` do frontend falha com `Cannot read properties of null (reading 'edgesOut')` | O npm 10 falhou com Vite 8 + plugin-react 6 (reproduzido isoladamente). Por isso as versões estão **fixadas** em `frontend/package.json` (Vite ~6.4, plugin-react ~4.7, React ~19.1). Não rode `npm update` sem testar. |
| `npm install` parece travado | Há outro `npm install` rodando na mesma pasta (`pgrep -fa "npm install"`); encerre-o. Instalações sobrepostas travam. |
| Tela mostra "Não foi possível comunicar com o servidor" | Backend desligado ou porta diferente: inicie com `npm start` e confira `VITE_API_URL`. |
| Erro de CORS no navegador | A origem do frontend não está em `CORS_ORIGINS`. |
| `EADDRINUSE` | Porta 3001 ocupada; defina `PORT`. |
| `better-sqlite3` não compila/instala | Use Node 20 e `npm install` novamente (baixa binário pré-compilado). |

## 22. Limitações conhecidas

- A interface foi validada manualmente pelo usuário, mas **não por testes automatizados**: os componentes React não têm testes. Responsividade, teclado e diálogos não foram confirmados individualmente.
- O filtro de categoria é por igualdade exata (diferencia maiúsculas e acentos; "Bebidas" e "bebidas" são categorias distintas).
- A janela de 7 dias é uma constante; não é configurável sem alterar o código.
- Busca por texto não ignora acentos (`LIKE` do SQLite só ignora maiúsculas ASCII).
- `data_validade` não tem `CHECK` de formato no banco; a validação é da API.
- Sem autenticação, vendas, notificações, IA ou app móvel (fora de escopo).

## 23. Fases seguintes

3. ✅ Classificação de validade (RN01–RN03), selo com texto e cor, filtros por situação e categoria — implementada; validação manual pendente.
4. Dashboard com 4 indicadores e valor em risco (RN04), painel direito.
5. Testes de fronteira adicionais, responsividade, consistência dos indicadores.
6. Opcionais: CSV, PDF, estoque baixo.

### Critérios de aceitação da Fase 3
- RN01–RN03 implementadas só no backend; cenários 5, 6, 7 e 8 do PDF cobertos por testes — ✅ automatizado.
- `situacao` presente em listagem, consulta, criação e edição — ✅ automatizado.
- Filtros por situação e categoria combinam com busca e paginação, com total correto — ✅ automatizado.
- `GET /api/categorias` reflete só categorias reais — ✅ automatizado.
- Data local em `America/Sao_Paulo`, configurável e validada — ✅ automatizado.
- Selo com cor e texto, filtros na interface, volta à página 1 — implementado; ⏳ validação manual pendente.
- Sem valor em risco, indicadores, texto de dias restantes ou mudança de esquema — ✅.

## 24. Apresentação/demonstração

Roteiro sugerido: (1) mostrar a arquitetura (diagrama acima); (2) cadastrar um produto e tentar um com preço negativo; (3) pesquisar por nome e por código; (4) editar quantidade; (5) excluir com confirmação; (6) reiniciar o backend e mostrar que os dados persistem; (7) executar `npm test`. Referência visual: sidebar escura, cabeçalho claro, lista à esquerda e resumo à direita (aproveitando só o layout; vendas, lojas, carrinho e código de barras estão fora de escopo).
