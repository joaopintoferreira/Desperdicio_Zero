import { useCallback, useEffect, useRef, useState } from 'react'
import { atualizarProduto, criarProduto, excluirProduto, listarCategorias, listarProdutos } from '../services/api'
import { ROTULOS_SITUACAO } from '../components/SeloSituacao'
import Indicadores from '../components/Indicadores'
import ProdutoCard from '../components/ProdutoCard'
import ProdutoForm from '../components/ProdutoForm'
import ConfirmarExclusao from '../components/ConfirmarExclusao'
import { IconeBusca } from '../components/Icones'
import useIndicadores from '../hooks/useIndicadores'
import { criarControleDeConsulta } from '../utils/consulta'

const POR_PAGINA = 10

export default function ProdutosPage() {
  const [entrada, setEntrada] = useState('') // o que está escrito no campo (valor visível)
  const [busca, setBusca] = useState('') // texto já aplicado à consulta (após o atraso de 300 ms)
  const [situacao, setSituacao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estoque, setEstoque] = useState('')
  const [categorias, setCategorias] = useState([])
  const [erroCategorias, setErroCategorias] = useState('')
  const [carregandoCategorias, setCarregandoCategorias] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [versaoLista, setVersaoLista] = useState(0) // muda para forçar nova consulta com os mesmos filtros
  const [resultado, setResultado] = useState(null) // { dados, paginacao }
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false) // operação do botão "Atualizar" em andamento
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [aviso, setAviso] = useState('')
  const [formulario, setFormulario] = useState(null) // null | { produto? }
  const [excluindo, setExcluindo] = useState(null)
  const indicadores = useIndicadores() // indicadores do estoque inteiro (não dependem dos filtros)

  const buscaAplicada = useRef(busca)
  buscaAplicada.current = busca
  const temporizador = useRef(null)

  // Pesquisa automática: espera o usuário parar de digitar (300 ms) antes de consultar a API.
  // Só reinicia a página quando o texto realmente mudou.
  useEffect(() => {
    temporizador.current = setTimeout(() => {
      const nova = entrada.trim()
      if (nova !== buscaAplicada.current) {
        setBusca(nova)
        setPagina(1)
      }
    }, 300)
    return () => clearTimeout(temporizador.current)
  }, [entrada])

  // Só a resposta da consulta mais recente é usada: digitar rápido, filtrar ou clicar em Atualizar
  // não deixa uma resposta antiga (que chegou depois) sobrescrever a atual.
  const controleLista = useRef(criarControleDeConsulta())

  const consultar = useCallback(async (filtros) => {
    const id = controleLista.current.iniciar()
    setCarregando(true)
    setErro('')
    let corrigindoPagina = false
    try {
      const r = await listarProdutos({ ...filtros, limite: POR_PAGINA })
      if (!controleLista.current.atual(id)) return
      const p = r.paginacao
      if (p.totalPaginas >= 1 && p.pagina > p.totalPaginas) {
        // A página pedida deixou de existir (ex.: produtos excluídos por fora): vai para a última
        // página válida, mantendo busca e filtros. O efeito abaixo refaz a consulta.
        corrigindoPagina = true
        setPagina(p.totalPaginas)
        return
      }
      setResultado(r)
    } catch (err) {
      if (!controleLista.current.atual(id)) return
      setResultado(null) // sem dados antigos apresentados como atuais quando a consulta falha
      setErro(err.message)
    } finally {
      if (controleLista.current.atual(id) && !corrigindoPagina) setCarregando(false)
    }
  }, [])

  // Único caminho para consultar a lista: muda busca, filtro, página ou versaoLista => uma consulta.
  useEffect(() => {
    consultar({ busca, categoria, situacao, estoque, pagina })
  }, [consultar, busca, categoria, situacao, estoque, pagina, versaoLista])

  // Categorias vêm da API (nunca de uma lista fixa). Recarregam ao atualizar, salvar e excluir.
  const categoriaAtual = useRef(categoria)
  categoriaAtual.current = categoria
  const categoriasAtuais = useRef(categorias)
  categoriasAtuais.current = categorias
  const controleCategorias = useRef(criarControleDeConsulta())

  const carregarCategorias = useCallback(async () => {
    const id = controleCategorias.current.iniciar()
    setCarregandoCategorias(true)
    try {
      const { dados } = await listarCategorias()
      if (!controleCategorias.current.atual(id)) return
      setCategorias(dados)
      setErroCategorias('')
      const selecionada = categoriaAtual.current
      if (selecionada && !dados.includes(selecionada)) {
        // A categoria escolhida deixou de existir: remove só esse filtro e avisa.
        setCategoria('')
        setPagina(1)
        setAviso(`A categoria “${selecionada}” não existe mais; o filtro de categoria foi removido.`)
      }
    } catch (err) {
      if (!controleCategorias.current.atual(id)) return
      // Mantém as opções que já estavam na tela (não apaga em silêncio) e explica o que houve.
      setErroCategorias(
        categoriasAtuais.current.length > 0
          ? `Não foi possível atualizar as categorias; exibindo as últimas carregadas. ${err.message}`
          : `Não foi possível carregar as categorias. ${err.message}`,
      )
    } finally {
      if (controleCategorias.current.atual(id)) setCarregandoCategorias(false)
    }
  }, [])

  useEffect(() => { carregarCategorias() }, [carregarCategorias])

  // Botão "Atualizar": recarrega lista, indicadores e categorias em paralelo, mantendo busca, filtros e
  // página. Usa o texto visível no campo (não o valor atrasado) e cancela o atraso pendente, para não
  // haver segunda consulta nem reinício da página. A lista é consultada pelo mesmo efeito de sempre.
  function atualizar() {
    if (atualizando) return // evita cliques repetidos durante a operação
    clearTimeout(temporizador.current)
    setAtualizando(true)
    setAviso('')
    setMensagem('')
    const visivel = entrada.trim()
    if (visivel !== busca) { // pesquisa digitada há menos de 300 ms: é uma pesquisa nova
      setBusca(visivel)
      setPagina(1)
    }
    setVersaoLista((v) => v + 1)
    setCarregando(true)
    indicadores.recarregar()
    carregarCategorias()
  }

  // Termina a operação do botão quando as três consultas acabaram.
  useEffect(() => {
    if (!atualizando || carregando || indicadores.carregando || carregandoCategorias) return
    setAtualizando(false)
    if (!erro && !indicadores.erro && !erroCategorias) setMensagem('Dados atualizados.')
  }, [atualizando, carregando, indicadores.carregando, carregandoCategorias, erro, indicadores.erro, erroCategorias])

  const alterarSituacao = (valor) => { setSituacao(valor); setPagina(1) }
  const alterarCategoria = (valor) => { setCategoria(valor); setPagina(1); setAviso('') }
  const alterarEstoque = (valor) => { setEstoque(valor); setPagina(1) }
  const filtrando = Boolean(busca || categoria || situacao || estoque)

  async function salvar(dados) {
    if (formulario.produto) {
      await atualizarProduto(formulario.produto.id, dados)
      setMensagem('Produto atualizado com sucesso.')
    } else {
      await criarProduto(dados)
      setMensagem('Produto cadastrado com sucesso.')
    }
    setFormulario(null)
    indicadores.recarregar()
    setVersaoLista((v) => v + 1)
    carregarCategorias()
  }

  async function confirmarExclusao() {
    await excluirProduto(excluindo.id)
    setExcluindo(null)
    setMensagem('Produto excluído com sucesso.')
    indicadores.recarregar()
    setVersaoLista((v) => v + 1) // se a página ficar vazia, consultar() volta para a última válida
    carregarCategorias()
  }

  const dados = resultado?.dados ?? []
  const pag = resultado?.paginacao

  return (
    <>
      <section className="painel" aria-labelledby="titulo-lista">
        <div className="barra">
          <h2 id="titulo-lista">Produtos</h2>
          <button type="button" className="btn btn--primario" onClick={() => { setMensagem(''); setFormulario({}) }}>
            Novo produto
          </button>
        </div>

        <div className="busca">
          <IconeBusca />
          <label htmlFor="busca" className="sr-only">Pesquisar por nome ou código</label>
          <input
            id="busca"
            type="search"
            placeholder="Pesquisar por nome ou código"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
          />
          {/* aria-disabled (e não disabled) mantém o foco do teclado no botão durante a atualização. */}
          <button
            type="button"
            className="btn btn--atualizar"
            onClick={atualizar}
            aria-disabled={atualizando}
            aria-busy={atualizando}
          >
            {atualizando && <span className="spinner" aria-hidden="true" />}
            <span>{atualizando ? 'Atualizando…' : 'Atualizar'}</span>
          </button>
        </div>

        <div className="filtros">
          <div className="filtro">
            <label htmlFor="filtro-situacao">Situação</label>
            <select id="filtro-situacao" value={situacao} onChange={(e) => alterarSituacao(e.target.value)}>
              <option value="">Todas as situações</option>
              {Object.entries(ROTULOS_SITUACAO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>{rotulo}</option>
              ))}
            </select>
          </div>
          <div className="filtro">
            <label htmlFor="filtro-estoque">Estoque</label>
            <select id="filtro-estoque" value={estoque} onChange={(e) => alterarEstoque(e.target.value)}>
              <option value="">Todos</option>
              <option value="baixo">Estoque baixo</option>
            </select>
          </div>
          <div className="filtro">
            <label htmlFor="filtro-categoria">Categoria</label>
            <select
              id="filtro-categoria"
              value={categoria}
              onChange={(e) => alterarCategoria(e.target.value)}
              aria-describedby={erroCategorias ? 'erro-categorias' : undefined}
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {erroCategorias && <p id="erro-categorias" role="alert" className="msg msg--erro">{erroCategorias}</p>}

        <div aria-live="polite">
          {mensagem && <p className="msg msg--ok">{mensagem}</p>}
          {aviso && <p className="msg msg--aviso">{aviso}</p>}
          <span className="sr-only">{atualizando ? 'Atualizando dados…' : ''}</span>
        </div>
        {erro && <p role="alert" className="msg msg--erro">{erro} Use “Atualizar” para tentar novamente.</p>}
        {carregando && !resultado && <p className="vazio">Carregando produtos…</p>}

        {!erro && resultado && dados.length === 0 && (
          <p className="vazio">
            {filtrando ? 'Nenhum produto encontrado para a pesquisa e os filtros aplicados.' : 'Nenhum produto cadastrado.'}
          </p>
        )}

        {dados.length > 0 && (
          <ul className="lista" aria-busy={carregando}>
            {dados.map((p) => (
              <ProdutoCard
                key={p.id}
                produto={p}
                onEditar={(produto) => { setMensagem(''); setFormulario({ produto }) }}
                onExcluir={setExcluindo}
              />
            ))}
          </ul>
        )}

        {pag && pag.totalPaginas > 1 && (
          <nav className="paginacao" aria-label="Paginação">
            <button type="button" className="btn" disabled={pag.pagina <= 1} onClick={() => setPagina(pag.pagina - 1)}>Anterior</button>
            <span>Página {pag.pagina} de {pag.totalPaginas}</span>
            <button type="button" className="btn" disabled={pag.pagina >= pag.totalPaginas} onClick={() => setPagina(pag.pagina + 1)}>Próxima</button>
          </nav>
        )}
      </section>

      {/* Resumo do estoque: os mesmos indicadores da Home, sempre do estoque inteiro (não dos filtros). */}
      <aside className="painel" aria-labelledby="titulo-resumo">
        <h2 id="titulo-resumo">Resumo do estoque</h2>
        <Indicadores estado={indicadores} />
      </aside>

      {formulario && (
        <ProdutoForm produto={formulario.produto} onSalvar={salvar} onCancelar={() => setFormulario(null)} />
      )}
      {excluindo && (
        <ConfirmarExclusao produto={excluindo} onConfirmar={confirmarExclusao} onCancelar={() => setExcluindo(null)} />
      )}
    </>
  )
}
