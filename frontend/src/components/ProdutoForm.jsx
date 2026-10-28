import { useState } from 'react'
import Modal from './Modal'
import { ErroApi } from '../services/api'
import { centavosParaCampo, reaisParaCentavos } from '../utils/moeda'

const CAMPOS = [
  { nome: 'nome', rotulo: 'Nome', tipo: 'text' },
  { nome: 'codigo', rotulo: 'Código', tipo: 'text' },
  { nome: 'categoria', rotulo: 'Categoria', tipo: 'text' },
  { nome: 'quantidade', rotulo: 'Quantidade', tipo: 'number', min: 0, step: 1, inputMode: 'numeric' },
  { nome: 'estoque_minimo', rotulo: 'Estoque mínimo (alerta)', tipo: 'number', min: 0, step: 1, inputMode: 'numeric', dica: '0 = sem alerta' },
  { nome: 'preco', rotulo: 'Preço unitário (R$)', tipo: 'text', inputMode: 'decimal', dica: 'Ex.: 5,99' },
  { nome: 'data_validade', rotulo: 'Data de validade', tipo: 'date' },
]

function valoresIniciais(produto) {
  if (!produto) return { nome: '', codigo: '', categoria: '', quantidade: '', estoque_minimo: '0', preco: '', data_validade: '' }
  return {
    nome: produto.nome,
    codigo: produto.codigo,
    categoria: produto.categoria,
    quantidade: String(produto.quantidade),
    estoque_minimo: String(produto.estoque_minimo ?? 0),
    preco: centavosParaCampo(produto.preco_unitario),
    data_validade: produto.data_validade,
  }
}

// Validação de UX (campos vazios, negativos, tipos). A validação definitiva é do servidor.
function validarLocal(v) {
  const e = {}
  for (const c of ['nome', 'codigo', 'categoria']) if (!v[c].trim()) e[c] = 'Campo obrigatório'
  if (v.quantidade === '') e.quantidade = 'Campo obrigatório'
  else if (!/^\d+$/.test(v.quantidade)) e.quantidade = 'Informe um número inteiro maior ou igual a 0'
  if (v.estoque_minimo !== '' && !/^\d+$/.test(v.estoque_minimo)) e.estoque_minimo = 'Informe um número inteiro maior ou igual a 0'
  if (!v.preco.trim()) e.preco = 'Campo obrigatório'
  else if (reaisParaCentavos(v.preco) === null) e.preco = 'Informe um valor válido, sem negativos (ex.: 5,99)'
  if (!v.data_validade) e.data_validade = 'Campo obrigatório'
  return e
}

export default function ProdutoForm({ produto, onSalvar, onCancelar }) {
  const [valores, setValores] = useState(() => valoresIniciais(produto))
  const [erros, setErros] = useState({})
  const [erroGeral, setErroGeral] = useState('')
  const [enviando, setEnviando] = useState(false)

  const alterar = (campo) => (ev) => setValores((v) => ({ ...v, [campo]: ev.target.value }))

  async function enviar(ev) {
    ev.preventDefault()
    const locais = validarLocal(valores)
    setErros(locais)
    setErroGeral('')
    if (Object.keys(locais).length > 0) return

    setEnviando(true)
    try {
      await onSalvar({
        nome: valores.nome.trim(),
        codigo: valores.codigo.trim(),
        categoria: valores.categoria.trim(),
        quantidade: Number(valores.quantidade),
        estoque_minimo: valores.estoque_minimo === '' ? 0 : Number(valores.estoque_minimo),
        preco_unitario: reaisParaCentavos(valores.preco), // reais -> centavos inteiros
        data_validade: valores.data_validade,
      })
    } catch (err) {
      if (err instanceof ErroApi && err.detalhes) {
        // Erros do servidor por campo (o campo de preço no formulário é "preco").
        const { preco_unitario, ...resto } = err.detalhes
        setErros(preco_unitario ? { ...resto, preco: preco_unitario } : resto)
      }
      setErroGeral(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={produto ? 'Editar produto' : 'Novo produto'} onFechar={onCancelar}>
      <form onSubmit={enviar} noValidate>
        {CAMPOS.map(({ nome, rotulo, dica, ...input }) => (
          <div className="campo" key={nome}>
            <label htmlFor={`campo-${nome}`}>{rotulo}</label>
            <input
              id={`campo-${nome}`}
              type={input.tipo}
              min={input.min}
              step={input.step}
              inputMode={input.inputMode}
              value={valores[nome]}
              onChange={alterar(nome)}
              placeholder={dica}
              aria-invalid={erros[nome] ? 'true' : undefined}
              aria-describedby={erros[nome] ? `erro-${nome}` : undefined}
            />
            {erros[nome] && <span id={`erro-${nome}`} className="campo__erro">{erros[nome]}</span>}
          </div>
        ))}
        {erroGeral && <p role="alert" className="msg msg--erro">{erroGeral}</p>}
        <div className="modal__acoes">
          <button type="button" className="btn" onClick={onCancelar} disabled={enviando}>Cancelar</button>
          <button type="submit" className="btn btn--primario" disabled={enviando}>
            {enviando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
