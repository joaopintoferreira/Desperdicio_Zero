import { useCallback, useEffect, useRef, useState } from 'react'
import { obterIndicadores } from '../services/api'
import { criarControleDeConsulta } from '../utils/consulta'

// Carrega os indicadores do estoque (uma única chamada serve cards, gráficos e relatório).
// `versao` muda quando produtos são alterados, para recarregar. Respostas antigas que chegam
// fora de ordem são ignoradas.
export default function useIndicadores(versao = 0) {
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const controle = useRef(criarControleDeConsulta())

  const recarregar = useCallback(async () => {
    const id = controle.current.iniciar()
    setCarregando(true)
    try {
      const r = await obterIndicadores()
      if (!controle.current.atual(id)) return
      setDados(r)
      setErro('')
    } catch (err) {
      if (!controle.current.atual(id)) return
      setDados(null) // sem valores antigos ou inventados quando a API falha
      setErro(err.message)
    } finally {
      if (controle.current.atual(id)) setCarregando(false)
    }
  }, [])

  useEffect(() => { recarregar() }, [recarregar, versao])

  return { dados, erro, carregando, recarregar }
}
