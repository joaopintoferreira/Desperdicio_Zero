import { useCallback, useEffect, useRef, useState } from 'react'
import { atualizarProduto, criarProduto, excluirProduto, listarCategorias, listarProdutos } from '../services/api'
import { ROTULOS_SITUACAO } from '../components/SeloSituacao'
import IndicadoresAutonomo from '../components/IndicadoresAutonomo'
import ProdutoCard from '../components/ProdutoCard'
import ProdutoForm from '../components/ProdutoForm'
import ConfirmarExclusao from '../components/ConfirmarExclusao'
import { IconeBusca } from '../components/Icones'

const POR_PAGINA = 10

export default function ProdutosPage() {
  const [entrada, setEntrada] = useState('')
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [estoque, setEstoque] = useState('')
  const [categorias, setCategorias] = useState([])
  const [erroCategorias, setErroCategorias] = useState('')
  const [pagina, setPagina] = useState(1)
  const [versaoIndicadores, setVersaoIndicadores] = useState(0) // muda a cada alteração, para recarregar os indicadores
  const [resultado, setResultado] = useState(null) // { dados, paginacao }
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [formulario, setFormulario] = useState(null) // null | { produto? }
  const [excluindo, setExcluindo] = useState(null)

  // Espera o usuário parar de digitar antes de consultar a API.
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(entrada.trim())
      setPagina(1)
    }, 300)
    return () => clearTimeout(t)
  }, [entrada])

  // Só a resposta da consulta mais recente é usada: digitar rápido na busca não deixa
  // uma resposta antiga (que chegou depois) sobrescrever a atual.
  const ultimaConsulta = useRef(0)

  const carregar = useCallback(async () => {
    const consulta = ++ultimaConsulta.current
    setCarregando(true)
    setErro('')
    try {
      const r = await listarProdutos({ busca, categoria, situacao, estoque, pagina, limite: POR_PAGINA })
      if (consulta === ultimaConsulta.current) setResultado(r)
    } catch (err) {
      if (consulta !== ultimaConsulta.current) return
      setResultado(null)
      setErro(err.message)
    } finally {
      if (consulta === ultimaConsulta.current) setCarregando(false)
    }
  }, [busca, categoria, situacao, estoque, pagina])

  useEffect(() => { carregar() }, [carregar])

  // Categorias vêm da API (nunca de uma lista fixa). Recarrega após salvar/excluir,
  // pois categorias podem surgir ou desaparecer; se a escolhida sumiu, limpa o filtro.
  const categoriaAtual = useRef(categoria)
  categoriaAtual.current = categoria

  const carregarCategorias = useCallback(async () => {
    try {
      const { dados } = await listarCategorias()
      setCategorias(dados)
      setErroCategorias('')
      if (categoriaAtual.current && !dados.includes(categoriaAtual.current)) {
        setCategoria('')
        setPagina(1)
      }
    } catch (err) {
      setCategorias([])
      setErroCategorias(`Não foi possível carregar as categorias. ${err.message}`)
    }
  }, [])

  useEffect(() => { carregarCategorias() }, [carregarCategorias])

  const alterarSituacao = (valor) => { setSituacao(valor); setPagina(1) }
  const alterarCategoria = (valor) => { setCategoria(valor); setPagina(1) }
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
    setVersaoIndicadores((v) => v + 1)
    await Promise.all([carregar(), carregarCategorias()])
  }

  async function confirmarExclusao() {
    await excluirProduto(excluindo.id)
    setExcluindo(null)
    setMensagem('Produto excluído com sucesso.')
    setVersaoIndicadores((v) => v + 1)
    // Se a página ficou vazia após excluir o último item, volta uma página.
    if (resultado.dados.length === 1 && pagina > 1) setPagina(pagina - 1)
    else await carregar()
    await carregarCategorias()
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
          <button
            type="button"
            className="btn"
            onClick={() => { carregar(); setVersaoIndicadores((v) => v + 1) }}
            disabled={carregando}
          >
            Atualizar
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
        </div>
        {erro && <p role="alert" className="msg msg--erro">{erro}</p>}
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
        <IndicadoresAutonomo versao={versaoIndicadores} />
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
