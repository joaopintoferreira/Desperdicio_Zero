import { useCallback, useEffect, useState } from 'react'
import { atualizarProduto, criarProduto, excluirProduto, listarProdutos } from '../services/api'
import ProdutoCard from '../components/ProdutoCard'
import ProdutoForm from '../components/ProdutoForm'
import ConfirmarExclusao from '../components/ConfirmarExclusao'
import { IconeBusca } from '../components/Icones'

const POR_PAGINA = 10

export default function ProdutosPage() {
  const [entrada, setEntrada] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
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

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      setResultado(await listarProdutos({ busca, pagina, limite: POR_PAGINA }))
    } catch (err) {
      setResultado(null)
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [busca, pagina])

  useEffect(() => { carregar() }, [carregar])

  async function salvar(dados) {
    if (formulario.produto) {
      await atualizarProduto(formulario.produto.id, dados)
      setMensagem('Produto atualizado com sucesso.')
    } else {
      await criarProduto(dados)
      setMensagem('Produto cadastrado com sucesso.')
    }
    setFormulario(null)
    await carregar()
  }

  async function confirmarExclusao() {
    await excluirProduto(excluindo.id)
    setExcluindo(null)
    setMensagem('Produto excluído com sucesso.')
    // Se a página ficou vazia após excluir o último item, volta uma página.
    if (resultado.dados.length === 1 && pagina > 1) setPagina(pagina - 1)
    else await carregar()
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
          <button type="button" className="btn" onClick={carregar} disabled={carregando}>Atualizar</button>
        </div>

        <div aria-live="polite">
          {mensagem && <p className="msg msg--ok">{mensagem}</p>}
        </div>
        {erro && <p role="alert" className="msg msg--erro">{erro}</p>}
        {carregando && !resultado && <p className="vazio">Carregando produtos…</p>}

        {!erro && resultado && dados.length === 0 && (
          <p className="vazio">
            {busca ? 'Nenhum produto encontrado para a pesquisa.' : 'Nenhum produto cadastrado.'}
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

      {/* Resumo e indicadores reais: Fase 4. */}
      <aside className="painel" aria-labelledby="titulo-resumo">
        <h2 id="titulo-resumo">Resumo do estoque</h2>
        <p className="vazio">Os indicadores serão exibidos nas próximas fases.</p>
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
